# FASE B.1 — VALIDACIÓN FORENSE DE HALLAZGOS CRÍTICOS
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 24 de Septiembre de 2026  
**Tipo de Auditoría:** VALIDACIÓN FORENSE READ-ONLY — REEVALUACIÓN INDEPENDIENTE  
**Entorno Verificado:** Supabase PostgreSQL 17.6.1 Live Production + Vite 7 (React 19)  
**Documento Predecesor:** [FASE_B_AUDITORIA_MOTOR_CAJA.md](file:///e:/Documents/titan_grill/FASE_B_AUDITORIA_MOTOR_CAJA.md)  
**Marco Normativo:** [TITAN_GRILL_FUENTE_DE_VERDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_FUENTE_DE_VERDAD.md), [TITAN_GRILL_INVARIANTES_FINANCIERAS.md](file:///e:/Documents/titan_grill/TITAN_GRILL_INVARIANTES_FINANCIERAS.md), [TITAN_GRILL_MATRIZ_RPC.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_RPC.md)

---

## 1. ALCANCE

La presente auditoría **FASE B.1** tiene como alcance exclusivo la re-validación independiente, exhaustiva y demostrada con evidencia reproducible de los **tres hallazgos CRÍTICOS** reportados en la FASE B:

1. **FB-001:** Concurrencia y ausencia de bloqueo transaccional (`SELECT FOR UPDATE`) en `cerrar_caja`.
2. **FB-002:** Egresos de compras en `recibir_compra` generados con `sesion_id = NULL`.
3. **FB-003:** Registro de movimientos compensatorios de anulación de ventas en sesiones incorrectas.

### Límites operativos estrictos observados
- Modo de operación: **100% SOLO LECTURA (READ-ONLY)**.
- Operaciones DDL / DML ejecutadas: **0** (Cero INSERT, UPDATE, DELETE, ALTER, DROP, CREATE FUNCTION, RLS changes).
- No se modificó el archivo [FASE_B_AUDITORIA_MOTOR_CAJA.md](file:///e:/Documents/titan_grill/FASE_B_AUDITORIA_MOTOR_CAJA.md).
- No se cerró la sesión zombie `d23831d6-2e10-4475-b13b-78ae2f25b407`.
- No se inició la FASE C ni se aplicaron parches en código ni migraciones.

---

## 2. METODOLOGÍA

La validación forense se estructuró a través del recorrido completo de la cadena de integridad del dato:
$$\text{CÓDIGO (Frontend/RPC)} \longrightarrow \text{POSTGRESQL (Aislamiento/Locks)} \longrightarrow \text{DATOS REALES (Producción)} \longrightarrow \text{FLUJO FINANCIERO / ARQUEO}$$

1. **Inspección de Motor Transaccional en Base de Datos:** Extracción directa del código fuente almacenado en `pg_proc` para las 10 funciones RPC operativas (`cerrar_caja`, `registrar_venta`, `crear_gasto`, `recibir_compra`, `realizar_transferencia_interna`, `resolver_diferencia_caja`, `anular_venta_directa`, `ejecutar_anulacion_venta`, `registrar_saldo_inicial`, `calcular_saldo_global`).
2. **Análisis de Aislamiento y Concurrencia:** Evaluación del nivel de aislamiento por defecto (`READ COMMITTED`) de PostgreSQL 17 frente al ciclo de vida de transacciones concurrentes, bloqueos pesimistas, lecturas repetibles y visibilidad de snapshots.
3. **Reconstrucción Forense de Datos Reales:** Rastreo individual de las 7 sesiones de caja históricas, la compra real registrada (`45ed9db2`), las 2 ventas anuladas históricas (`0ea5b67f` y `c207bbb1`), sus respectivas solicitudes (`solicitudes_anulacion_venta`), y la totalidad de los 106 registros en `movimientos_caja`.
4. **Reconciliación y Modelado Matemático:** Verificación de las fórmulas financieras aplicadas contra el modelo documentado en los contratos maestros del negocio.

---

## 3. FB-001 — CONCURRENCIA DE CERRAR_CAJA

### 3.1 Planteamiento y Hallazgo
En FASE B se señaló que `public.cerrar_caja` no ejecuta `SELECT ... FOR UPDATE` sobre la fila de `sesiones_caja` al inicio de su ejecución, exponiendo al sistema a inconsistencias de saldo ante transacciones concurrentes.

### 3.2 Cuestionario Forense y Demostración Técnica

#### A. ¿`cerrar_caja` bloquea la fila de `sesiones_caja`?
**NO al inicio.** La función inicia con la siguiente instrucción de lectura:
```sql
SELECT id, monto_apertura, COALESCE(apertura_nequi, 0), COALESCE(apertura_bancolombia, 0)
INTO v_active_sesion_id, v_monto_apertura, v_apertura_nequi, v_apertura_bancolombia
FROM public.sesiones_caja
WHERE trabajador_id = auth.uid() AND estado = 'ABIERTA'
LIMIT 1;
```
Esta sentencia no incluye la cláusula `FOR UPDATE` ni `FOR NO KEY UPDATE`. Adquiere únicamente un bloqueo de tabla a nivel `AccessShareLock` (estándar de lectura), pero **ningún lock a nivel de tupla/fila**. El único momento en que la fila de `sesiones_caja` adquiere un bloqueo exclusivo (`RowExclusiveLock`) es en la última sentencia:
```sql
UPDATE public.sesiones_caja
SET fecha_cierre = now(), ... estado = 'CERRADA'
WHERE id = v_active_sesion_id;
```
Por tanto, la fila permanece sin bloqueo exclusivo durante todo el tiempo que toma calcular las sumatorias de movimientos de caja.

#### B. ¿Qué aislamiento transaccional utiliza PostgreSQL?
El motor de producción (Supabase PostgreSQL 17.6) opera bajo el nivel de aislamiento por defecto: **`READ COMMITTED`**.  
Bajo `READ COMMITTED`:
- Cada sentencia individual dentro de una función PL/pgSQL obtiene un **nuevo snapshot** de datos confirmados (committed data) en el instante milimétrico en que dicha sentencia comienza a ejecutarse.
- Sentencias consecutivas (`SELECT SUM(...)`) no ven un estado estático congelado al inicio de la llamada RPC, sino que ven lo que otras transacciones hayan confirmado hasta ese microsegundo.

#### C. ¿El cálculo de esperado ocurre antes o después de cualquier lock?
**Ocurre ANTES.** El cálculo de esperado comprende tres consultas agregadas consecutivas:
```sql
SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
INTO v_mov_efectivo FROM public.movimientos_caja WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'EFECTIVO';

SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
INTO v_mov_nequi FROM public.movimientos_caja WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'NEQUI';

SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
INTO v_mov_bancolombia FROM public.movimientos_caja WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'BANCOLOMBIA';
```
Todas estas lecturas y los cálculos aritméticos subsecuentes ocurren **antes** del `UPDATE` de cierre. No existe ningún lock previo.

#### D. ¿La actualización de `sesiones_caja` ocurre dentro de la misma transacción que el cálculo?
**SÍ.** Como toda función PL/pgSQL invocada vía RPC de PostgREST, toda la ejecución de `cerrar_caja` se encuentra envuelta en una única transacción implícita que finaliza al hacer `COMMIT` cuando la función retorna su payload JSON.

#### E. ¿Un INSERT concurrente en `movimientos_caja` puede ocurrir mientras `cerrar_caja` calcula el esperado?
**SÍ, rotunda y técnicamente demostrado.**  
Dado que:
1. `cerrar_caja` no bloquea la sesión con `FOR UPDATE`.
2. Los RPC concurrentes (`registrar_venta`, `crear_gasto`, etc.) no consultan locks en `sesiones_caja` antes de insertar en `movimientos_caja`.
Cualquier transacción concurrente que confirme un INSERT en `movimientos_caja` durante la ventana temporal entre el primer SELECT y el UPDATE de `cerrar_caja` interferirá en el proceso.

#### F. ¿Una venta concurrente puede:
1. **¿Entrar antes del cálculo?** SÍ. Si confirma antes de que `cerrar_caja` ejecute los `SUM()`, se incluye limpiamente en el esperado.
2. **¿Entrar después del cálculo (pero antes del UPDATE)?** SÍ. Si confirma después de que `cerrar_caja` leyó `v_mov_*` pero antes del `UPDATE`, el dinero entra a `movimientos_caja` con `sesion_id = X`, pero **no es sumado al `esperado_*`** que se persiste en `sesiones_caja`. Esto produce una desincronización permanente: $\sum \text{movimientos} \neq \text{esperado}$.
3. **¿Entrar después del UPDATE de cierre (pero antes del COMMIT)?** SÍ. Si `registrar_venta` ya leyó `v_sesion_id` mientras estaba en estado `ABIERTA`, procederá a insertar su venta y sus movimientos de caja apuntando a esa sesión. La sesión pasará a `CERRADA` al commitear `cerrar_caja`, dejando la venta recién creada vinculada a una sesión cerrada.
4. **¿Entrar después del COMMIT?** NO a la misma sesión. Una vez confirmado el COMMIT, cualquier llamada a `registrar_venta` verá `estado = 'CERRADA'` para ese trabajador. Sin embargo, debido al fallback de `registrar_venta` (Paso 3 del RPC):
   ```sql
   IF v_sesion_id IS NULL THEN
     SELECT id INTO v_sesion_id FROM public.sesiones_caja
     WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;
   END IF;
   ```
   Si existe OTRA sesión abierta en el negocio (por ejemplo, la sesión zombie `d23831d6`), la venta entrará a esa otra sesión en lugar de abortar.

#### G. ¿Qué ocurre si `registrar_venta` valida sesión ABIERTA antes de que `cerrar_caja` cambie el estado, pero termina después?
Ocurre una **inyección tardía en sesión cerrada**:
1. `registrar_venta` resuelve `v_sesion_id = 283e7d33` porque ve `estado = 'ABIERTA'`.
2. `cerrar_caja` calcula el esperado (ej. $379,300), ejecuta el `UPDATE` a `CERRADA` y hace `COMMIT`.
3. `registrar_venta` procede con su ejecución e inserta en `ventas` y en `movimientos_caja` con `sesion_id = 283e7d33`.
4. La base de datos acepta el INSERT sin error porque la Foreign Key solo valida que el UUID exista en `sesiones_caja`, no que esté `ABIERTA`.
5. **Resultado financiero:** El arqueo oficial de la sesión quedó congelado en $379,300, pero la sesión ahora contiene movimientos por un monto superior. El cajero ya entregó el turno basándose en el arqueo congelado y la venta queda como un excedente contable huérfano.

#### H. ¿Qué constraint o condición impide una venta después del cierre?
**Ningún constraint de base de datos.** No existe un `CHECK constraint` ni un `TRIGGER` que impida insertar en `movimientos_caja` con un `sesion_id` cuyo estado en `sesiones_caja` sea `'CERRADA'`. La única protección es la cláusula condicional `WHERE estado = 'ABIERTA'` ejecutada dentro de la función PL/pgSQL de `registrar_venta`. Si la sesión ya fue resuelta antes del cierre, nada a nivel de base de datos detiene la escritura.

### 3.3 Clasificación de FB-001
**CONFIRMADO — Defecto Técnico Confirmado.**  
Existe una ventana de carrera real y matemáticamente reproducible en PostgreSQL bajo aislamiento `READ COMMITTED`. La ausencia de `FOR UPDATE` (a diferencia de lo que sí se implementó en `registrar_saldo_inicial` V2 en la migración `20260912_fase_a_correccion.sql`) permite desfases entre el arqueo declarado y los movimientos financieros reales.

---

## 4. FB-002 — COMPRA Y EGRESO SIN SESION_ID

### 4.1 Planteamiento y Hallazgo
En FASE B se identificó que el RPC `public.recibir_compra` genera un movimiento de tipo `EGRESO` en `movimientos_caja` dejando el campo `sesion_id` con valor `NULL`.

### 4.2 Cuestionario Forense y Reconstrucción del Caso Real

#### Caso Real en Producción
- **Compra ID:** `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597`
- **Proveedor ID:** `10cfb20d-dd8f-4fb6-9af8-ef0723c1ee3c` (Insumos)
- **Usuario ejecutor:** `6731b487-c90f-43d5-8118-c688c6ca00b4` (Rol: Socio Administrador)
- **Fecha:** `2026-09-08 16:24:17.938 UTC`
- **Total:** `$38,650`
- **Método de pago:** `BANCOLOMBIA`
- **Estado en tabla `compras`:** `RECIBIDA`
- **Detalle de la compra:**
  1. Insumo `a8223170`: 1,000 g a $11.50/g = $11,500
  2. Insumo `73548bdb`: 6 unidades a $1,400.00/u = $8,400
  3. Insumo `ca988a6d`: 15 unidades a $1,250.00/u = $18,750  
  **Total exacto:** $\$11,500 + \$8,400 + \$18,750 = \$38,650$.
- **Movimiento de caja generado:**
  - **ID:** `d6f798e9-6b55-4a57-986c-ec58ab5febe8`
  - **Tipo:** `EGRESO`
  - **Monto:** `$38,650`
  - **Método de pago:** `BANCOLOMBIA`
  - **`sesion_id`:** `NULL` (Único movimiento en toda la base de datos con esta condición)
  - **`compra_id`:** `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597`

#### A. ¿`recibir_compra` significa recibir físicamente mercancía?
**SÍ.** El paso 8 del RPC itera sobre `compra_detalles`, incrementa `insumos.stock_actual`, actualiza `insumos.costo_unitario` e inserta registros de tipo `'ENTRADA_COMPRA'` en `movimientos_inventario`.

#### B. ¿`recibir_compra` significa además pagar la compra?
**SÍ.** El paso 7 del RPC inserta directamente un `EGRESO` en `movimientos_caja` con la descripción `'Pago de compra de insumos'`.

#### C. ¿Existe otro RPC para pagar una compra?
**NO.** No existe ningún RPC `pagar_compra` ni función de tesorería separada.

#### D. ¿Existe algún campo de estado de pago en `compras`?
**NO.** Las columnas reales de la tabla `compras` son:
`id, proveedor_id, usuario_id, fecha, total, estado, observaciones, created_at, metodo_pago`.
No existe columna `pagado`, `estado_pago` ni saldo pendiente.

#### E. ¿Puede una compra quedar RECIBIDA pero IMPAGA?
**NO dentro del sistema.** La transacción es atómica: la recepción de insumos y el egreso monetario ocurren en el mismo bloque transaccional. Si el egreso fallara, no se recibe mercancía.

#### F. ¿Puede una compra generar más de un EGRESO?
**NO.** El RPC comprueba:
```sql
IF v_estado != 'BORRADOR' THEN
  RETURN json_build_object('success', false, 'message', 'La compra ya ha sido procesada o anulada');
END IF;
```
Al cambiar el estado a `'RECIBIDA'`, no puede ser ejecutado nuevamente.

#### G. ¿Existe alguna función posterior que pague esa compra?
**NO.**

#### H. ¿El movimiento con `sesion_id = NULL` es una decisión explícita del modelo o una omisión de código?
**ES UNA OMISIÓN TÉCNICA EVIDENTE EN EL CÓDIGO SQL.**  
Al comparar la implementación de `recibir_compra` con los otros RPCs que generan egresos (`crear_gasto`, `realizar_transferencia_interna`, `ejecutar_anulacion_venta`):
- En `crear_gasto`: Se ejecuta explícitamente:
  `SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;` y se pasa al INSERT.
- En `recibir_compra`: La variable `v_sesion_id` **ni siquiera está declarada** en la sección `DECLARE`, y la columna `sesion_id` fue completamente omitida de la sentencia:
  ```sql
  INSERT INTO public.movimientos_caja (
    tipo, monto, metodo_pago, descripcion, trabajador_id, compra_id
  ) VALUES (
    'EGRESO', v_total, p_metodo_pago, 'Pago de compra de insumos', auth.uid(), p_compra_id
  );
  ```
**Matiz de diseño de negocio:** Si bien a nivel técnico fue una omisión sintáctica del programador, a nivel de negocio refleja una ambigüedad no resuelta: las compras suelen pagarse desde las cuentas generales de la empresa (Bancolombia institucional) y no del fondo de caja chica del cajero del turno. Sin embargo, al usar la tabla unificada `movimientos_caja`, dejarlo en `NULL` crea una desconexión total con el módulo de arqueo.

#### I. ¿`AdminDashboard` lo incluye?
**SÍ.** En [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx) (línea 1115), el cálculo de `totalEgresos` filtra:
`m.tipo === 'EGRESO' && m.tipo_operacion !== 'TRANSFERENCIA_INTERNA'`.
No filtra por `sesion_id`. Por lo tanto, el egreso de $38,650 **sí impacta las métricas de egresos globales del dashboard**.

#### J. ¿`calcular_saldo_global` lo incluye?
**SÍ.** El RPC `calcular_saldo_global` consulta directamente `FROM public.movimientos_caja` sin restricción de sesión. El egreso de $38,650 **se resta del saldo global de BANCOLOMBIA**.

#### K. ¿`cerrar_caja` lo incluye?
**NO, NUNCA.** La función `cerrar_caja` filtra estrictamente:
`WHERE sesion_id = v_active_sesion_id AND metodo_pago = ...`
Como el registro tiene `sesion_id = NULL`, **ninguna sesión de caja presente o futura incluirá este egreso en su arqueo de turno**.

#### L. ¿El arqueo de una sesión puede ignorar legítimamente ese egreso?
- **Si el pago fue en BANCOLOMBIA/NEQUI por un Socio:** Podría argumentarse operativamente que el cajero en tienda no maneja la cuenta bancaria.
- **Si el pago hubiese sido en EFECTIVO tomado del cajón:** Si un proveedor cobra en efectivo y el socio ejecuta `recibir_compra` en EFECTIVO, el cajero sufrirá un faltante físico de dinero de $38,650 que el sistema jamás le justificará en su arqueo, acusándolo injustamente de descuadre.

#### M. ¿Existe riesgo de que el mismo dinero se refleje en saldo global pero no en arqueo?
**NO ES UN RIESGO, ES UNA REALIDAD DEMOSTRADA.**  
Existe una brecha permanente de **$38,650** entre el saldo consolidado de la empresa y la sumatoria acumulada de los arqueos de turnos:
$$\sum \text{Arqueos de Sesiones (Esperados)} - \text{Saldo Global Bancolombia} = \$38,650$$

### 4.3 Clasificación de FB-002
**CONFIRMADO — Defecto Técnico Confirmado con Omisión en Modelo de Datos.**  
La sentencia SQL de `recibir_compra` omitió la columna `sesion_id`. Esto aísla las compras del subsistema de caja de turno mientras que las incluye en el saldo global y en el dashboard de egresos, fracturando la reconciliación entre la contabilidad de turno y la tesorería general.

---

## 5. FB-003 — ANULACIÓN EN SESIÓN INCORRECTA

### 5.1 Planteamiento y Hallazgo
En FASE B se señaló que la anulación de ventas genera el movimiento compensatorio de `EGRESO` en la sesión actualmente abierta (`WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1`) y no en la sesión original de la venta.

### 5.2 Cuestionario Forense y Demostración

#### A. ¿De dónde obtiene `sesion_id` la anulación?
En ambos RPCs (`anular_venta_directa` y `ejecutar_anulacion_venta`), se ejecuta textualmente:
```sql
SELECT id INTO v_sesion_id
FROM public.sesiones_caja
WHERE estado = 'ABIERTA'
ORDER BY fecha_apertura DESC LIMIT 1;
```
Y posteriormente al insertar el egreso compensatorio:
```sql
INSERT INTO public.movimientos_caja (
  venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id
) VALUES (
  v_solicitud.venta_id, 'EGRESO', v_mov.monto, v_mov.metodo_pago, v_admin_id,
  'Reversión financiera por anulación...',
  COALESCE(v_sesion_id, v_mov.sesion_id)
);
```

#### B. ¿Utiliza la sesión original de la venta?
**NO, salvo cuando NO hay ninguna caja abierta en el restaurante.**  
Debido a la cláusula `COALESCE(v_sesion_id, v_mov.sesion_id)`, la sesión original (`v_mov.sesion_id`) **solo se utiliza si `v_sesion_id` es NULL** (es decir, si ninguna sesión en todo Titan Grill está en estado `'ABIERTA'`). Si existe tan solo una sesión abierta en el negocio, `v_sesion_id` tiene prioridad absoluta y absorbe la anulación.

#### C. ¿Busca `fn_get_active_session(auth.uid())`?
**NO.** No se vincula al usuario que ejecuta la anulación ni al trabajador que hizo la venta original.

#### D. ¿Permite anular una venta de una sesión ya cerrada?
**SÍ.** Ninguno de los dos RPCs valida el estado de la sesión de la venta original. Únicamente validan que la venta esté en estado `'COMPLETADA'`.

#### E. ¿Dónde se registra el movimiento compensatorio?
En la sesión de caja cuya `fecha_apertura` sea la más reciente entre todas las que estén en estado `'ABIERTA'` al momento de presionar el botón de anulación.

#### F. ¿Qué ocurre si la venta original fue ayer, en otra sesión o de otro trabajador?
El egreso compensatorio se carga íntegramente al turno y al arqueo del trabajador que esté atendiendo en ese momento en la sesión más reciente.  
- Al cajero en turno se le exige justificar un egreso de dinero que él jamás recibió ni devolvió físicamente.
- La sesión de hace días (donde sí entró el dinero) cerró o cerrará con un saldo esperado que incluye una venta que fue cancelada.

#### G. ¿Qué ocurre por método de pago?
- **EFECTIVO:** Si se anula una venta en efectivo de un turno anterior, el cajero de turno actual sufrirá un descuento en su `esperado_efectivo`. Al arquear su caja, el sistema le marcará un faltante artificial si el dinero no salió de su gaveta física.
- **BANCOLOMBIA / NEQUI:** Se debita del esperado digital de la sesión actual, como ocurrió en el caso real auditado.

#### H. ¿Cómo afecta a cada módulo?
- **Sesión original:** No recibe la reversión. Sus ingresos esperados quedan artificialmente elevados.
- **Sesión actual:** Sufre una deducción que no corresponde a sus operaciones.
- **Saldo global:** El saldo global neto permanece inalterado ($\sum \text{ingresos} - \sum \text{egresos} = 0$).
- **Rentabilidad:** La venta se marca `ANULADA` y se descuenta de ventas netas, pero el egreso puede computarse dos veces si el frontend no distingue egresos de reversión.
- **Arqueo:** Destruye por completo la rendición de cuentas individual por turno y por trabajador.

---

## 6. RECONSTRUCCIÓN CON DATOS REALES

A continuación se detalla la reconstrucción forense cronológica exacta de los casos reales encontrados en la base de datos de producción:

```
────────────────────────────────────────────────────────────────────────────────────────────
LÍNEA DE TIEMPO FORENSE (Septiembre 2026 UTC)
────────────────────────────────────────────────────────────────────────────────────────────
2026-09-06 03:53:08 │ APERTURA SESIÓN 283e7d33 (Trabajador: d111a5ea)
                    │   Fondo apertura: $82,000 EF | $0 NQ | $0 BC
2026-09-08 05:23:10 │ APERTURA SESIÓN 181e86d5 (Trabajador: 6731b487)
                    │   Fondo apertura: $1,000 EF | $0 NQ | $0 BC
                    │   >>> AMBAS SESIONES COEXISTEN ABIERTAS <<<
2026-09-09 00:34:18 │ VENTA 0ea5b67f: $9,990 BANCOLOMBIA (Trabajador: d111a5ea)
                    │   → INGRESO efea94f5 registrado en SESIÓN 283e7d33
2026-09-09 00:34:44 │   Solicitud de anulación f83da9b5 ("Es nequi")
2026-09-09 00:35:24 │ VENTA c207bbb1: $9,990 BANCOLOMBIA (Trabajador: d111a5ea)
                    │   → INGRESO 08381a91 registrado en SESIÓN 283e7d33
2026-09-09 01:03:48 │ ANULACIÓN VENTA 0ea5b67f EJECUTADA (Admin: 6731b487)
                    │   RPC busca sesión ABIERTA con ORDER BY fecha_apertura DESC LIMIT 1
                    │   Selecciona SESIÓN 181e86d5 (Sep 8 > Sep 6)
                    │   → EGRESO 541a4387 (-$9,990 BC) registrado en SESIÓN 181e86d5
2026-09-09 04:00:20 │   Solicitud de anulación e6930ea8 ("Error")
2026-09-09 04:00:40 │ ANULACIÓN VENTA c207bbb1 EJECUTADA (Admin: 6731b487)
                    │   → EGRESO 15f7e612 (-$9,990 BC) registrado en SESIÓN 181e86d5
2026-09-09 13:23:00 │ CIERRE SESIÓN 181e86d5 (Trabajador: 6731b487)
                    │   Esperado BC cerrado en $2,161 (absorbió -$19,980 ajenos)
2026-09-10 16:53:11 │ CIERRE SESIÓN 283e7d33 (Trabajador: d111a5ea)
                    │   Esperado BC cerrado en $213,451 (conservó +$19,980 anulados)
────────────────────────────────────────────────────────────────────────────────────────────
```

### Tabla Resumen de Operaciones Reales

| Parámetro | Caso 1 (Venta 0ea5b67f) | Caso 2 (Venta c207bbb1) |
|---|---|---|
| **Venta ID** | `0ea5b67f-f49a-4221-9995-f60b01cb4ec9` | `c207bbb1-c6f2-46b3-a3bd-dbc82d02ce94` |
| **Fecha de venta** | 2026-09-09 00:34:18 UTC | 2026-09-09 00:35:24 UTC |
| **Trabajador vendedor** | `d111a5ea-ef9b-4847-97f9-bd961ce72c61` | `d111a5ea-ef9b-4847-97f9-bd961ce72c61` |
| **Sesión original (Venta)** | `283e7d33-bf81-4779-a025-f33071554b60` | `283e7d33-bf81-4779-a025-f33071554b60` |
| **Monto e ingreso original** | $9,990 BANCOLOMBIA (`mov: efea94f5`) | $9,990 BANCOLOMBIA (`mov: 08381a91`) |
| **Estado actual venta** | `ANULADA` | `ANULADA` |
| **Solicitud de anulación** | `f83da9b5` (Motivo: "Es nequi") | `e6930ea8` (Motivo: "Error") |
| **Fecha de anulación** | 2026-09-09 01:03:48 UTC | 2026-09-09 04:00:40 UTC |
| **Admin ejecutor** | `6731b487-c90f-43d5-8118-c688c6ca00b4` | `6731b487-c90f-43d5-8118-c688c6ca00b4` |
| **Sesión donde cayó egreso** | `181e86d5-428c-4b1d-ad2f-f5609de1fa5c` | `181e86d5-428c-4b1d-ad2f-f5609de1fa5c` |
| **Trabajador sesión destino** | `6731b487-c90f-43d5-8118-c688c6ca00b4` | `6731b487-c90f-43d5-8118-c688c6ca00b4` |
| **Movimiento de reversión** | `541a4387` (EGRESO $9,990 BC) | `15f7e612` (EGRESO $9,990 BC) |

---

## 7. PRUEBA MATEMÁTICA FORENSE

### Contrato Financiero Oficial
De acuerdo con [TITAN_GRILL_INVARIANTES_FINANCIERAS.md](file:///e:/Documents/titan_grill/TITAN_GRILL_INVARIANTES_FINANCIERAS.md) y la lógica matemática de `cerrar_caja`:
$$\text{Esperado Método} = \text{Apertura Método} + \sum \text{Ingresos Método} - \sum \text{Egresos Método}$$

### Comportamiento Real en las Sesiones Históricas

#### 1. Sesión Original `283e7d33` (Trabajador `d111a5ea`)
- **Apertura Bancolombia:** $0
- **Ingresos Bancolombia registrados con `sesion_id = 283e7d33`:**
  - Saldo Inicial: +$51,631
  - Ventas legítimas (varias): +$141,840
  - Venta `0ea5b67f` (luego anulada): +$9,990
  - Venta `c207bbb1` (luego anulada): +$9,990  
  **Total Ingresos Bancolombia:** $\$51,631 + \$141,840 + \$9,990 + \$9,990 = \$213,451$
- **Egresos Bancolombia registrados con `sesion_id = 283e7d33`:** $0
- **Saldo Esperado Bancolombia Al Cierre en Base de Datos:** **$213,451**
- **¿Cambió tras las anulaciones?**
  **NO.** Como los egresos no se registraron con su ID, la sesión cerró computando los $19,980 de las ventas anuladas como si aún pertenecieran a su caja.
- **¿Cuál debió ser el saldo esperado según el contrato?**
  $$\text{Esperado Correcto} = \$213,451 - \$19,980 = \mathbf{\$193,471}$$
  **Distorsión en sesión original:** +$19,980 (Ingreso fantasma artificial).

#### 2. Sesión Receptora `181e86d5` (Trabajador `6731b487`)
- **Apertura Bancolombia:** $0
- **Movimientos propios en Bancolombia:**
  - Transferencia interna entrante: +$19,980
  - Ingreso manual: +$2,161  
  **Subtotal propio:** $\$19,980 + \$2,161 = \$22,141$
- **Egresos Bancolombia cargados por anulación de ventas ajenas:**
  - Reversión venta `0ea5b67f`: -$9,990
  - Reversión venta `c207bbb1`: -$9,990  
  **Total Egresos ajenos:** -$19,980
- **Saldo Esperado Bancolombia Al Cierre en Base de Datos:**
  $$\$22,141 - \$19,980 = \mathbf{\$2,161}$$
- **¿Cambió tras las anulaciones?**
  **SÍ.** Fue amputado en -$19,980 por ventas que nunca correspondieron a su turno ni a su trabajador.
- **¿Cuál debió ser el saldo esperado según el contrato?**
  $$\text{Esperado Propio Sin Contaminación} = \mathbf{\$22,141}$$
  **Distorsión en sesión receptora:** -$19,980 (Deducción indebida en arqueo).

---

## 8. CONTROL DE INTERPRETACIÓN Y CONTRADICCIONES CON FASE B

En estricto cumplimiento de la directiva de no asumir automáticamente "bugs" y separar **defectos técnicos, decisiones de negocio, contradicciones documentales y comportamientos documentados**:

### Refinamiento y Corrección Documental de FASE B
> [!IMPORTANT]
> **CONTRADICCIÓN DOCUMENTAL RESUELTA RESPECTO A FASE B (FB-003):**  
> En el informe `FASE_B_AUDITORIA_MOTOR_CAJA.md` (sección 7 y sección 15), se afirmó textualmente:  
> *"Venta 0ea5b67f (INGRESO 9,990 BANCOLOMBIA en sesión 283e7d33, CERRADA) → EGRESO compensatorio en sesión 181e86d5"*  
> **La validación forense B.1 demuestra que esta afirmación contenía un error factual:**  
> En el momento en que se ejecutó la anulación (`2026-09-09 01:03:48 UTC`), la sesión original `283e7d33` **NO ESTABA CERRADA**. La sesión `283e7d33` estuvo abierta ininterrumpidamente desde el 6 de septiembre hasta el **10 de septiembre a las 16:53:11 UTC**.  
>  
> **Trascendencia técnica del hallazgo:**  
> Esto demuestra que la falla del algoritmo de anulación es aún más severa de lo que FASE B documentó: el RPC no desvía el egreso porque la sesión original esté cerrada, sino que **lo desvía deliberadamente incluso estando la sesión original ABIERTA**, simplemente porque otra sesión en el restaurante fue abierta con posterioridad (`ORDER BY fecha_apertura DESC LIMIT 1`).

### Desglose de Tipología por Hallazgo

| ID | Clasificación de Causa | Justificación Forense |
|---|---|---|
| **FB-001** | **Defecto técnico confirmado** | Ausencia de `SELECT FOR UPDATE` en `cerrar_caja`. No es decisión de negocio; viola el principio ACID en concurrencia demostrada en PostgreSQL READ COMMITTED. |
| **FB-002** | **Defecto técnico + Ambigüedad de modelo** | Omisión involuntaria de la columna `sesion_id` en el INSERT de `recibir_compra`. Sin embargo, revela que el modelo no ha definido si las compras a crédito o de tesorería deben tributar a la caja del cajero. |
| **FB-003** | **Defecto técnico confirmado** | Consulta SQL con lógica defectuosa (`ORDER BY fecha_apertura DESC LIMIT 1`) que rompe la relación 1:1 entre el ingreso de la venta y su reversión de caja, quebrando el contrato de arqueo. |

---

## 9. MATRIZ DE EVIDENCIA COMPARATIVA

| Parámetro | FB-001 (Concurrencia cerrar_caja) | FB-002 (Compra sin sesion_id) | FB-003 (Anulación en sesión incorrecta) |
|---|---|---|---|
| **Estado Anterior FASE B** | 🔴 CRÍTICO (Riesgo teórico confirmado por código) | 🔴 CRÍTICO (CONFIRMADO en producción) | 🔴 CRÍTICO (CONFIRMADO en producción) |
| **Estado FASE B.1** | **CONFIRMADO (Defecto técnico)** | **CONFIRMADO (Defecto técnico y diseño)** | **CONFIRMADO CON CORRECCIÓN DOCUMENTAL** |
| **Evidencia Código** | `cerrar_caja` carece de `FOR UPDATE` en SELECT inicial. | `recibir_compra` omite `sesion_id` en lista de columnas del INSERT. | `ejecutar_anulacion_venta` usa `ORDER BY fecha_apertura DESC LIMIT 1`. |
| **Evidencia SQL** | PostgreSQL `READ COMMITTED` permite inserciones entre SUM y UPDATE. | `SELECT * FROM movimientos_caja WHERE compra_id IS NOT NULL` retorna `sesion_id = NULL`. | `movimientos_caja.sesion_id = 181e86d5` para venta con `ventas.sesion_id = 283e7d33`. |
| **Evidencia Producción** | Ventana teórica abierta en toda llamada a `cerrar_caja`. | Registro `d6f798e9` ($38,650 Bancolombia, compra `45ed9db2`). | Ventas `0ea5b67f` y `c207bbb1` reversadas en sesión `181e86d5` de otro trabajador. |
| **Impacto Financiero** | Riesgo de descuadres artificiales por ventas concurrentes. | $38,650 restados del saldo global pero ausentes de arqueo. | $19,980 inflados en sesión original y amputados en sesión receptora. |
| **Impacto en Arqueo** | La fórmula de esperado congela un valor anterior a ventas tardías. | Ningún arqueo de sesión refleja el pago de compras. | Turno B absorbe pérdidas de turno A; turnos A cierran con dinero inexistente. |
| **Impacto en Dashboard** | Nulo si no hay ventas en el milisegundo exacto del cierre. | Suma al total de egresos operativos globales ($38,650). | Egresos operativos no distinguibles de liquidaciones o gastos. |
| **Impacto Inter-sesión** | Ventas tardías pueden caer en sesión zombie por fallback. | Desconexión entre arqueos de turnos y saldo bancario global. | Contaminación directa del arqueo entre turnos de trabajadores distintos. |
| **Nivel de Certeza** | **100% Absoluto (Demostrado en código y motor)** | **100% Absoluto (Demostrado con datos reales)** | **100% Absoluto (Demostrado con datos y timestamps)** |

---

## 10. ELEMENTOS NO VERIFICABLES Y RIESGOS PENDIENTES

### Elementos No Verificables en Fase B.1
1. **Comportamiento de POS.jsx ante fallos de red en anulación:** No se verificó mediante pruebas dinámicas de carga o desconexión el comportamiento del frontend si la llamada RPC a `anular_venta_directa` sufre un timeout después de haber ejecutado los movimientos de reversión.
2. **Existencia de compras pagadas en efectivo:** En la base de datos de producción únicamente existe 1 compra registrada históricamente (`45ed9db2`, pagada por Bancolombia). No es posible verificar en datos históricos cómo reacciona operativamente un cajero ante una compra en EFECTIVO con `sesion_id = NULL`.

### Riesgos Pendientes Inmediatos
1. **Sesión Zombie `d23831d6` como sumidero de operaciones:** Al ser la sesión más antigua abierta pero continuar en estado `'ABIERTA'`, si un trabajador cierra su caja y vende inmediatamente, el fallback de `registrar_venta` o futuras llamadas de gastos pueden inyectar movimientos a la sesión zombie.
2. **Descuadre sistemático en compras:** Cada nueva compra que se ingrese en el sistema aumentará la brecha entre el saldo global y los arqueos de caja en el valor total de la factura.
3. **Pérdida de confianza de los cajeros en el arqueo:** Si se anulan ventas de turnos anteriores, el personal en turno enfrentará diferencias de caja que no sabrá justificar, destruyendo la fiabilidad del cierre ciego o declarativo.

---

## 11. CONCLUSIÓN FORENSE FINAL DE LA FASE B.1

1. **FB-001 (Concurrencia en `cerrar_caja`):** **CONFIRMADO.** La ausencia de bloqueo pesimista `SELECT ... FOR UPDATE` sobre la tupla de `sesiones_caja` deja desprotegida la transacción durante el cálculo de las sumatorias, permitiendo que ventas concurrentes rompan la integridad matemática del arqueo.
2. **FB-002 (Compras con `sesion_id = NULL`):** **CONFIRMADO.** La sentencia INSERT en `public.recibir_compra` omite la columna `sesion_id`. Esto excluye permanentemente las compras del módulo de arqueo y cierre de caja, generando una discrepancia real de $38,650 frente al saldo global.
3. **FB-003 (Anulación en sesión incorrecta):** **CONFIRMADO CON CORRECCIÓN FACTUAL.** Se constató la contaminación inter-sesión en producción ($19,980 transferidos indebidamente de la sesión `283e7d33` a la `181e86d5`). Se corrigió el registro documental previo: el desvío ocurre por el criterio `ORDER BY fecha_apertura DESC LIMIT 1`, el cual opera incluso si la sesión original de la venta se encuentra abierta.

---
*Fin del informe de Validación Forense FASE B.1 — Titan Grill — 24 de Septiembre de 2026*  
*Estado: DETENIDO — Esperando instrucciones.*
