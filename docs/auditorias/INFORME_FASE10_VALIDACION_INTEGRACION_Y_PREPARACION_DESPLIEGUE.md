# TITAN GRILL — INFORME FASE 10: VALIDACIÓN DE INTEGRACIÓN Y PREPARACIÓN SEGURA PARA DESPLIEGUE

**Fecha y hora:** 2026-10-10 01:17:00 UTC-5  
**Proyecto Supabase:** `[PROJECT_REF_REDACTADO]`  
**Rama Git:** `audit/titan-grill-forensic-handoff`  
**HEAD verificado:** `60cd590fdec62b0ba0f0bb3e81a1d44227d692a0`  
**Carácter de la fase:** Auditoría técnica estática, validación arquitectural de despliegue, inspección de catálogo SQL y planificación segura (cero escrituras en producción, cero migraciones aplicadas, cero despliegues, cero commits ni push).

---

## 1. ESTADO GIT INICIAL Y FINAL

### 1.1 Registro del árbol de trabajo
- **Rama:** `audit/titan-grill-forensic-handoff`
- **HEAD:** `60cd590` (`docs(despliegue): runbook de f1_3 y h1_2, y validacion del Dockerfile para EasyPanel`)
- **`git status --short`:**
  ```text
   M newpromt.md
   M src/components/AdminDashboard.jsx
  ?? scratch/
  ?? supabase/migrations/20261010_i1_1_recibir_compra_sesion_por_trabajador.sql
  ?? supabase/migrations/20261010_i1_2_recibir_compra_definitiva.sql
  ```

### 1.2 Integridad de archivos preservados
- **src/components/AdminDashboard.jsx:**
  - Líneas 841–857: Guarda de sesión abierta + parámetro explícito `p_sesion_id: targetSesionId` en `registrar_saldo_inicial`. Preservado intacto.
  - Líneas 3150–3156: Chequeo `sesion.diferencia != null` y etiqueta "Sin arqueo" para sesiones cerradas administrativamente. Preservado intacto.
- **newpromt.md:** Preservado con especificaciones de Fase 10.
- **scratch/:** Preservado con diagnósticos y suite test_recibir_compra_suite.sql.
- **Migraciones candidatas:**
  - I1.1: `supabase/migrations/20261010_i1_1_recibir_compra_sesion_por_trabajador.sql`
  - I1.2: `supabase/migrations/20261010_i1_2_recibir_compra_definitiva.sql`

---

## 2. HASHES SHA-256 DE LAS MIGRACIONES EXAMINADAS

| Archivo | Algoritmo | Hash SHA-256 Verificado | Rol en la Arquitectura |
| :--- | :---: | :--- | :--- |
| `20261010_i1_1_recibir_compra_sesion_por_trabajador.sql` | SHA-256 | `0ADC9DB3843F665F0D1DB93D54DA07E124F0FC6F64583181F2587E8495A7F216` | Propuesta Fase 6 (Sustituida/Obsoleta) |
| `20261010_i1_2_recibir_compra_definitiva.sql` | SHA-256 | `0077AF7E97B8773002BEBCBE4C78B56B3F5A9374C755D2E1000F31467D5AC429` | Propuesta Definitiva Fase 8/9 (Principal) |

---

## 3. ARQUITECTURA REALMENTE VERIFICADA DE EASYPANEL Y SUPABASE

Tras auditar `Dockerfile`, `package.json`, `nginx.conf`, `src/lib/supabaseClient.js` y el catálogo de proyectos de Supabase mediante herramientas MCP, se concluye:

1. **EasyPanel ejecuta ÚNICAMENTE el frontend estático:**
   - El `Dockerfile` es un build multi-stage de Node 20 que compila el frontend con Vite (`npm run build`) y lo copia a un contenedor `nginx:alpine` para servirlo en el puerto 80.
   - EasyPanel **no contiene ningún servidor backend en Node.js ni ejecuta procesos en segundo plano**.
   - EasyPanel **no tiene conexión directa a la base de datos PostgreSQL** ni ejecuta `supabase db push` o migraciones.
2. **Supabase es un servicio independiente que aloja toda la lógica del negocio:**
   - La base de datos PostgreSQL (versión 17.6.1) alberga las tablas, RLS, triggers y las funciones RPC transaccionales (`registrar_venta`, `recibir_compra`, `cerrar_caja`, etc.).
   - El cliente web en el navegador del usuario se conecta directamente a la API PostgREST de Supabase utilizando `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **Desacoplamiento total entre despliegues:**
   - Desplegar una nueva versión en EasyPanel solo actualiza el bundle estático de HTML/JS/CSS en Nginx.
   - Las migraciones de Supabase se deben aplicar de forma completamente separada e independiente a nivel de base de datos.
4. **Ausencia de CLI local de Supabase:**
   - No existe archivo `supabase/config.toml` (el CLI de Supabase no ha sido inicializado en este repositorio).

---

## 4. EXISTENCIA O AUSENCIA DE STAGING VERIFICADO

- **Consulta a la API de Supabase (`list_projects`):**
  Existe **UN ÚNICO PROYECTO** en toda la organización:
  - ID: `[PROJECT_REF_REDACTADO]` (Nombre: `mdeviajob-ui's Project`, Región: `us-east-2`, Estado: `ACTIVE_HEALTHY`).
  - **No existe ningún proyecto de staging en Supabase.**
- **Instancia local:**
  Existe un servicio PostgreSQL local de Windows (`postgresql-x64-18`), pero no está provisionado con el esquema de Titan Grill ni conectado como réplica.
- **Declaración formal de la condición de parada:**
  Al no existir un entorno de staging real, aislado y verificable en Supabase, **las pruebas de integración con escritura quedan estrictamente BLOQUEADAS**. Ninguna prueba que mute datos puede ser ejecutada contra el proyecto de producción `[PROJECT_REF_REDACTADO]`.

---

## 5. AUDITORÍA ESTÁTICA DETALLADA DE I1.2

### B.1 Resolución de la función RPC
- I1.2 ejecuta `DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);`.
- Define `public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text, p_idempotency_key uuid DEFAULT NULL::uuid)`.
- *Resultado:* Se elimina el riesgo de error de función ambigua (`ERROR 42725`) en PostgreSQL cuando se invocan 1 o 2 parámetros. El frontend pasa los 3 parámetros de forma nombrada (`AdminDashboard.jsx:L1860, L1896`), lo que garantiza compatibilidad del 100%.

### B.2 Validación de parámetros y Hallazgo en Lógica de Tres Valores
- `p_compra_id`: Si es nulo o no existe, L70–72 retorna `{ success: false, message: 'Compra no encontrada' }`. Correcto.
- `p_idempotency_key`: Maneja de forma diferenciada la recuperación cuando coincide la clave vs. rechazo cuando la clave difiere o es nula en compras ya recibidas. Correcto.
- **HALLAZGO TÉCNICO (Severidad Media — Lógica de Tres Valores en SQL):**
  En la línea 60:
  ```sql
  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
  ```
  Si un cliente envía `p_metodo_pago = NULL`, la expresión `NULL NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA')` evalúa a `NULL` (UNKNOWN). En PL/pgSQL, una condición `IF` solo ejecuta la rama `THEN` si la expresión es `TRUE`. Por ende, **si el parámetro es NULL, la validación se salta silenciosamente**, y la ejecución continúa hasta la sentencia `INSERT INTO public.movimientos_caja`, donde detona una excepción por violación del check constraint de base de datos (`movimientos_caja_metodo_pago_check`), provocando un error 500 no amigable en vez de una respuesta controlada `{ success: false }`.
  - *Corrección recomendada para futura versión:*
    `IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN`

### B.3 Integridad transaccional y Rollback
- Toda la función es atómica dentro del motor PL/pgSQL.
- No utiliza bloques `EXCEPTION WHEN OTHERS THEN NULL` que enmascaren errores.
- Los rechazos lógicos retornan antes de cualquier mutación (`UPDATE`/`INSERT`). Si falla la actualización de stock o la inserción del movimiento de caja, PostgreSQL revierte automáticamente el estado de la compra.

### B.4 Concurrencia e idempotencia
- `SELECT ... FOR UPDATE` sobre `compras` garantiza exclusión mutua estricta a nivel de fila.
- Dos recepciones simultáneas de la misma compra son serializadas: la primera transiciona a `RECIBIDA`, y la segunda lee el nuevo estado y activa la guarda de idempotencia.
- Unicidad respaldada por índices en producción:
  - `compras_idempotency_key_key`: `UNIQUE (idempotency_key)`.
  - `movimientos_caja_idempotency_key_key`: `UNIQUE (idempotency_key)`.
  - `idx_sesion_unica_abierta`: `UNIQUE (trabajador_id) WHERE (estado = 'ABIERTA')`.

### B.5 Tratamiento Contable: Caja vs. Tesorería General
- **Efectivo:** Requiere sesión abierta propia. Si no existe, rechaza. (Previene faltantes en el cajón).
- **Bancos (Nequi/Bancolombia) sin sesión:** Asigna `sesion_id = NULL`. (Permite recepciones de tesorería fuera de turno sin crear cajas ficticias).
- **Bancos (Nequi/Bancolombia) con sesión activa del socio:** I1.2 actualmente vincula el egreso a la caja de turno del socio (`v_sesion_id`).
  - *Impacto:* Si el socio paga la compra con fondos corporativos de tesorería (cuenta general de la empresa) y no con el flujo de caja del turno, se le restará ese monto de su arqueo esperado al cerrar caja en el POS.
  - *Decisión pendiente del propietario:* Se requiere definir si los pagos bancarios realizados por un socio con caja abierta deben afectar el arqueo de turno o si debe crearse un selector `origen_fondos: 'CAJA_TURNO' | 'TESORERIA_GENERAL'`.

### B.6 Inventario y costos
- Recalcula el total de la compra desde `compra_detalles` (`SUM(subtotal)`).
- Actualiza existencias en `insumos` y actualiza `costo_unitario` solo si es mayor a cero.
- Inserta snapshots históricos inmutables en `movimientos_inventario` con `idempotency_key = NULL` para evitar conflictos con el índice único parcial multilínea.

---

## 6. MATRIZ DE RIESGOS

| Severidad | Riesgo Identificado | Evidencia | Impacto | Recomendación / Mitigación |
| :---: | :--- | :--- | :--- | :--- |
| **Media** | `p_metodo_pago = NULL` evade la guarda `NOT IN` por lógica trivaluada de SQL | I1.2 Línea 60 | Falla en BD con check constraint en vez de respuesta controlada | Cambiar a `IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN (...)` |
| **Media** | Descuadre en arqueo bancario de turno si el socio paga compra de tesorería teniendo caja abierta | I1.2 Línea 95 y 128 | Arqueo esperado de Bancolombia/Nequi se reduce en el monto de la compra | Decisión pendiente del propietario sobre selector de origen de fondos |
| **Baja** | Incompatibilidad con clientes externos no documentados | Retiro de firma de 2 params | Ninguna detectada en el código | La firma de 3 params con DEFAULT absorbe llamadas de 2 params |

---

## 7. MATRIZ DE LAS 18 PRUEBAS DE INTEGRACIÓN

Detalladas formalmente en `scratch/test_recibir_compra_suite.sql`:

| Caso | Descripción del Escenario | Estado Formal | Justificación Metodológica |
| :---: | :--- | :---: | :--- |
| **1** | Efectivo válido con sesión propia | **Bloqueada para ejecución / Aprobada estáticamente** | Sin base de datos de staging aislada; lógica y flujo validados |
| **2** | Efectivo sin sesión abierta | **Bloqueada para ejecución / Aprobada estáticamente** | Guarda L98–103 validada; rechazo seguro sin mutaciones |
| **3** | NEQUI sin sesión abierta | **Bloqueada para ejecución / Aprobada estáticamente** | Asigna `sesion_id = NULL` correctamente |
| **4** | BANCOLOMBIA sin sesión abierta | **Bloqueada para ejecución / Aprobada estáticamente** | Asigna `sesion_id = NULL` correctamente |
| **5** | Pago bancario con sesión propia | **Bloqueada para ejecución / Aprobada estáticamente** | Asigna sesión del socio; pendiente política contable |
| **6** | Método de pago NULL | **Analizada / Hallazgo detectado** | Falla amigable no capturada; interceptada por check de BD |
| **7** | Método de pago no permitido | **Bloqueada para ejecución / Aprobada estáticamente** | Lista blanca en L60 rechaza métodos extraños |
| **8** | Compra inexistente | **Bloqueada para ejecución / Aprobada estáticamente** | Retorna "Compra no encontrada" antes de mutaciones |
| **9** | Compra ya recibida (misma clave) | **Bloqueada para ejecución / Aprobada estáticamente** | Idempotencia probada por código; retorna `recovered: true` |
| **10** | Compra ya recibida (clave distinta) | **Bloqueada para ejecución / Aprobada estáticamente** | Rechaza reintento con clave errónea |
| **11** | Clave nula en operación repetida | **Bloqueada para ejecución / Aprobada estáticamente** | Rechaza reintento sin clave |
| **12** | Reutilización de clave en otra compra | **Bloqueada para ejecución / Aprobada estáticamente** | Protegido por índice único `compras_idempotency_key_key` |
| **13** | Concurrencia simultánea en compra | **Bloqueada para ejecución / Aprobada estáticamente** | Serializada por `FOR UPDATE` |
| **14** | Rollback por fallo en inventario | **Bloqueada para ejecución / Aprobada estáticamente** | Atomicidad PL/pgSQL garantiza reversión completa |
| **15** | Compra multilínea (varios insumos) | **Bloqueada para ejecución / Aprobada estáticamente** | Manejo de snapshots y clave nula en detalle validado |
| **16** | No duplicación de inventario | **Bloqueada para ejecución / Aprobada estáticamente** | Entradas de inventario excluidas de rama recovered |
| **17** | Compatibilidad RPC (1, 2 y 3 args) | **Aprobada en análisis estático** | Argumentos con defaults en catálogo Postgres |
| **18** | Aislamiento de sesión ajena | **Aprobada en análisis estático** | `fn_get_active_session(auth.uid())` impide sesión ajena |

---

## 8. RESULTADOS DE VALIDACIONES LOCALES

| Comando / Verificación | Código de Salida | Diagnóstico Real |
| :--- | :---: | :--- |
| `npm run lint` | `0` | Exitoso sin errores de ESLint |
| `npm run build` | `0` | Exitoso (2848 módulos en 18.54s, bundle Vite en `dist/`) |
| `git diff --check` | `0` | Exitoso sin espacios en blanco corruptos ni conflictos |
| Análisis estático AST / SQL | N/A | Completado; 1 hallazgo de lógica SQL reportado |

---

## 9. MOVIMIENTO HISTÓRICO DE $38.650

- Movimiento: `d6f798e9-6b55-4a57-986c-ec58ab5febe8`, EGRESO, $38.650, BANCOLOMBIA, `sesion_id = NULL`.
- Compra asociada: `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597`.
- Sesión candidata: `181e86d5-428c-4b1d-ad2f-f5609de1fa5c` (cerrada con diferencia $0, esperado Bancolombia $2.161).
- **Ratificación:**
  El movimiento permanece intacto con `sesion_id = NULL`. Asignarlo retroactivamente crearía una contradicción con el arqueo cerrado de turno ($2.161 esperados vs. -$36.489 resultantes). No se ejecutó ninguna acción sobre este registro.

---

## 10. PLAN DE DESPLIEGUE FUTURO (PROPUESTA SEPARADA)

### Operación 1: Supabase (Base de Datos)
1. **Paso 1 — Aprovisionamiento de Staging:** Crear o configurar un proyecto de pruebas aislado para correr la suite `test_recibir_compra_suite.sql`.
2. **Paso 2 — Corrección Menor en I1.2:** Incorporar `p_metodo_pago IS NULL OR` en el guard de método de pago antes del despliegue.
3. **Paso 3 — Backup:** Exportar backup de `compras`, `insumos`, `movimientos_caja` y DDL de funciones en producción.
4. **Paso 4 — Aplicación en Producción:** Ejecutar exclusivamente `20261010_i1_2_recibir_compra_definitiva.sql` en el SQL Editor de Supabase.
5. **Paso 5 — Verificación:** Consultar `pg_proc` para confirmar eliminación de la sobrecarga de 2 parámetros y vigencia de la nueva función.

### Operación 2: EasyPanel (Frontend)
1. **Evaluación de necesidad:** **NO se requiere nuevo despliegue en EasyPanel** para que la migración I1.2 funcione, ya que el frontend actual ya envía `{ p_compra_id, p_metodo_pago, p_idempotency_key }`.
2. **Despliegue opcional:** Solo si el propietario desea publicar los dos cambios locales de `AdminDashboard.jsx` (guarda de saldo inicial y visualización "Sin arqueo"), se compilará la imagen en EasyPanel usando los build args `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

---

## 11. DECISIONES PENDIENTES DEL PROPIETARIO

1. **Aceptación o ajuste de la política contable para compras bancarias:**
   - ¿Se aprueba que los pagos por Bancolombia/Nequi de un socio con caja abierta se resten de su arqueo de turno?
   - O por el contrario, ¿se prefiere agregar un selector en pantalla `Origen de fondos: [ ] Caja del Turno  [X] Cuenta de la Empresa (Tesorería)` para dejar `sesion_id = NULL` en compras corporativas?
2. **Aprobación de la corrección menor en el guard de método de pago:**
   - Ajustar la condición a `IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN ...`.
3. **Aprobación de la decisión de mantener `sesion_id = NULL` en el movimiento histórico de $38.650.**

---

## 12. DICTAMEN FINAL

### Dictamen Técnico: **APROBADA CON CONDICIONES**
*(BLOQUEADA PARA DESPLIEGUE DIRECTO EN PRODUCCIÓN)*

**Criterios de salida justificados:**
1. La auditoría estática de I1.2 confirma que resuelve la asignación por trabajador y la ambigüedad de sobrecargas de forma sólida.
2. Sin embargo, no se puede desplegar directamente a producción porque:
   - No existe un entorno de staging verificado donde ejecutar las pruebas de integración con mutaciones.
   - Existe un hallazgo menor en la validación de `p_metodo_pago = NULL` que debe refinarse.
   - La política contable sobre compras bancarias de socios con caja abierta requiere la decisión explícita del propietario.

---

## 13. CONFIRMACIÓN EXPLÍCITA DE INTEGRIDAD

- **Cero escrituras en producción:** No se ejecutó ningún `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP` ni `CREATE` en la base de datos de producción.
- **Cero migraciones aplicadas:** No se ejecutó `supabase db push` ni se aplicaron archivos SQL en producción.
- **Cero despliegues:** No se inició ningún despliegue en EasyPanel ni se alteraron variables de entorno.
- **Cero operaciones Git remotas:** No se realizaron `git commit`, `git push`, rebase ni cambios de rama.
- **Archivos protegidos:** `AdminDashboard.jsx`, `newpromt.md`, `scratch/`, I1.1 e I1.2 permanecen íntegros.
