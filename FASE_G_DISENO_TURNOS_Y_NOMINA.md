# FASE G — DISEÑO: TURNOS Y NÓMINA POR TURNO

> **Fecha:** 2026-09-27
> **Rama:** `audit/titan-grill-forensic-handoff`
> **Estado:** diseño aprobado por el dueño. Pendiente de implementación.

---

## 1. REGLA DE NEGOCIO (confirmada por el dueño)

- El trabajador labora aproximadamente de **4:00 p. m. a 9:00 p. m.** (hora de Bogotá).
- **No trabaja todos los días.** Puede ser lunes, o martes y miércoles, etc.
- Cada día que trabaja equivale a **1 turno**.
- Al cerrar la caja, el **administrador** confirma el turno y **paga inmediatamente $40.000**.
- El pago es **fijo por turno**. No se calcula por horas.
- Solo se registra cuando **efectivamente trabajó**. No hay turnos automáticos.
- **Un solo turno por trabajador por fecha**, inicialmente.
- Una vez pagado, el valor pagado queda **históricamente congelado**.
- **`sesiones_caja` NO es fuente de asistencia.** Los turnos son independientes.

El turno es la **fuente oficial de la nómina**.

---

## 2. POR QUÉ ESTO CORRIGE LA CONTABILIDAD, NO SOLO LA NÓMINA

Hoy el costo laboral entra al P&L por dos vías simultáneas:

| Vía | Monto en septiembre | Problema |
|---|---|---|
| `costos_configuracion` → `trabajador1 - Diego`, VARIABLE, $40.000 **DIARIO** | $720.000 (18 días calendario) | Cobra por **día calendario**, pero solo se paga por **día trabajado** |
| `liquidaciones` estado PAGADO | $80.000 | Se suma aparte |

Si el trabajador labora ~3 días por semana, el costo real de ese período es ~$320.000. **El P&L está cargando ~$400.000 de nómina fantasma**, más el doble conteo de los $80.000.

Con turnos como fuente única, el costo laboral del período pasa a ser exactamente `$40.000 × turnos pagados`. Verificable contra los movimientos de caja.

---

## 3. MODELO DE DATOS

### 3.1 Tabla `turnos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `trabajador_id` | `uuid` NOT NULL | FK → `perfiles_trabajadores` |
| `fecha` | **`date`** NOT NULL | Día real trabajado, en hora de **Bogotá**. Ver §4. |
| `estado` | `text` NOT NULL | `REGISTRADO` \| `PAGADO` \| `ANULADO`. Default `REGISTRADO`. |
| `tarifa_aplicada` | `numeric(14,2)` NOT NULL | Snapshot de `perfiles_trabajadores.tarifa_pago` al registrar. `> 0`. |
| `liquidacion_id` | `uuid` NULL | FK → `liquidaciones`. Se llena al pagar. |
| `confirmado_por` | `uuid` NOT NULL | FK → `perfiles_trabajadores`. Quién cerró el turno. |
| `observaciones` | `text` NULL | |
| `created_at` | `timestamptz` NOT NULL | Cuándo se **registró** (distinto de `fecha`) |
| `updated_at` | `timestamptz` NOT NULL | |

### 3.2 El anti-doble-pago es una restricción, no código

```sql
CREATE UNIQUE INDEX idx_turno_unico_por_dia
  ON turnos (trabajador_id, fecha)
  WHERE estado <> 'ANULADO';
```

Parcial a propósito: un turno registrado por error se anula y el día queda libre otra vez. Pero **no pueden coexistir dos turnos vigentes del mismo trabajador el mismo día**, ni por doble clic, ni por dos pestañas, ni por una condición de carrera. La base lo rechaza.

### 3.3 Restricciones adicionales

- `CHECK (tarifa_aplicada > 0)` — un turno de valor 0 es un error silencioso, no un turno.
- `CHECK (fecha <= (now() AT TIME ZONE 'America/Bogota')::date)` — fechas pasadas sí, futuras no.
- `CHECK (estado IN ('REGISTRADO','PAGADO','ANULADO'))`
- `CHECK ((estado = 'PAGADO') = (liquidacion_id IS NOT NULL))` — un turno pagado **siempre** tiene liquidación, y uno no pagado nunca la tiene. Hace imposible el estado inconsistente.

### 3.4 Solo perfiles con rol TRABAJADOR

Por decisión del dueño, los administradores no reciben turnos. Se valida **en la RPC** (`rol = 'TRABAJADOR' AND estado = 'ACTIVO'`), no por constraint, porque un cambio de rol futuro no debe invalidar turnos históricos.

---

## 4. ZONA HORARIA — EL RIESGO PRINCIPAL DEL DISEÑO

La jornada es **4:00 p. m. – 9:00 p. m. en Bogotá** (UTC−5). En UTC, la jornada del 27 de septiembre va de `2026-09-27 21:00Z` a **`2026-09-28 02:00Z`**.

**La jornada cruza la medianoche en UTC.** Por eso:

1. `fecha` es un `date` **elegido explícitamente**, con default `(now() AT TIME ZONE 'America/Bogota')::date`. **Nunca derivado de un timestamp sin convertir.**
2. Toda comparación de `fecha` contra `timestamptz` (ventas, movimientos) debe convertir: `(v.fecha AT TIME ZONE 'America/Bogota')::date`.
3. Si esto se ignorara, las últimas dos horas de cada jornada caerían al día siguiente, el índice único fallaría en los casos límite, y se pagarían turnos con fecha equivocada.

> **Pendiente relacionado, no verificado aún:** `getDateRange()` en el frontend construye las fechas con la hora local del navegador. Con este horario, las ventas de 7–9 p. m. podrían estar cayendo en el día siguiente al filtrar. Hay que comprobarlo aparte.

---

## 5. INTEGRACIÓN CON LIQUIDACIONES

Se **reutiliza** `liquidaciones` tal como está. No se reemplaza ni se duplica.

```
turno (REGISTRADO)
   │  pagar_turno
   ▼
liquidaciones   modalidad='POR_TURNO', monto_calculado=tarifa_aplicada, estado→PAGADO
   │            (vía la RPC pagar_liquidacion existente)
   ▼
movimientos_caja   EGRESO con liquidacion_id
   │
   ▼
turno.liquidacion_id = <id>,  turno.estado = 'PAGADO'
```

Razones:

1. **El motor contable no cambia.** `fn_estado_resultados` ya lee `liquidaciones WHERE estado='PAGADO'` para la nómina del período.
2. **No se rompe la exclusión anti-doble-conteo.** El P&L ya excluye los `movimientos_caja` con `liquidacion_id`. Un flujo de pago paralelo obligaría a replicar esa lógica.
3. **El historial existente sigue válido.** Las 2 liquidaciones actuales ($80.000) se conservan como historial **sin turno asociado**. No se crean turnos retroactivos ficticios.

**`turnos.liquidacion_id` habilita 1:N sin costo.** Hoy se usa 1:1 (un turno, un pago inmediato). Si después se paga la semana junta, varios turnos apuntan a la misma liquidación con `monto_calculado = SUM(tarifa_aplicada)`. Sin tabla intermedia ni migración.

---

## 6. CONGELAMIENTO DEL VALOR PAGADO

Se necesitan **dos capas**, porque las políticas de `liquidaciones` llamadas `..._rpc_only` **no lo son**: `INSERT` y `UPDATE` están abiertos a cualquier socio vía REST, que podría alterar `monto_calculado` o marcar `PAGADO` sin generar el egreso.

1. **`turnos.tarifa_aplicada`** es un snapshot al registrar. Subir la tarifa a $45.000 no altera los turnos ya registrados.
2. **Trigger `BEFORE UPDATE` sobre `turnos`**: si `OLD.estado = 'PAGADO'`, bloquea cambios en `tarifa_aplicada`, `fecha`, `trabajador_id` y `liquidacion_id`. Solo permite `observaciones`.
3. **Trigger equivalente sobre `liquidaciones`**: si `OLD.estado = 'PAGADO'`, bloquea `monto_calculado`, `trabajador_id` y `movimiento_caja_id`. Hoy nada protege ese número, y es el que el P&L usa como nómina.

Reutiliza el patrón de `fn_immutable_cost_snapshot` ya presente en el proyecto desde la Fase D2.1.

---

## 7. RPCs

| RPC | Guard | Comportamiento |
|---|---|---|
| `registrar_turno(trabajador, fecha, tarifa?, obs?)` | `fn_is_socio()` | Valida rol TRABAJADOR + ACTIVO, fecha no futura, tarifa > 0. Copia `tarifa_pago` del perfil (o el override). Traduce la violación del índice único a un mensaje claro. |
| `pagar_turno(turno_id, cuenta_origen)` | `fn_is_socio()` | `SELECT … FOR UPDATE` sobre el turno. Crea la liquidación y delega en `pagar_liquidacion`. Enlaza y marca PAGADO. Una sola transacción. |
| `cerrar_y_pagar_turno(trabajador, fecha, cuenta_origen)` | `fn_is_socio()` | Registra + paga atómicamente. Es la que usa el botón de la UI. |
| `anular_turno(turno_id, motivo)` | `fn_is_socio()` | Si está REGISTRADO, anula. Si está PAGADO, **se niega** e indica anular primero la liquidación. Mover dinero hacia atrás debe ser explícito. |
| `actualizar_tarifa_trabajador(trabajador_id, tarifa)` | `fn_is_socio()` | Editor seguro de `tarifa_pago`. Hoy **no existe forma de editarlo desde la UI** y pasa a ser la fuente de la nómina. |
| `fn_turnos_periodo(desde, hasta)` | `fn_is_socio()` | Listado + totales para la UI y la conciliación. |

Todas `SECURITY DEFINER` con `SET search_path TO 'public'`, y sin `EXECUTE` para `anon`.

---

## 8. PERMISOS (RLS)

- `turnos` **SELECT**: `fn_is_socio() OR trabajador_id = auth.uid()`. El dueño ve todos; el trabajador solo los suyos.
- `turnos` **INSERT / UPDATE / DELETE**: **ninguna política**. Solo por RPC. Evita repetir el problema de `liquidaciones`.

---

## 9. ARREGLOS ARRASTRADOS (aceptados por el dueño)

`pagar_turno` delega en `pagar_liquidacion`, así que se corrigen de paso:

1. **Fallback de caja ajena:** si `p_sesion_id` es NULL, `pagar_liquidacion` toma **cualquier caja abierta**. Mismo patrón que se cerró en `registrar_venta`. Debe exigir sesión explícita o la del propio socio.
2. **Falta de `FOR UPDATE`:** lee la liquidación sin bloqueo, así que dos clics simultáneos pueden pagar dos veces.

---

## 10. DATOS A AJUSTAR (decisiones del dueño)

| Acción | Detalle |
|---|---|
| `tarifa_pago = 40000` | Para el perfil con `rol = 'TRABAJADOR'`. Por migración controlada, porque no existe UI. Queda editable después vía `actualizar_tarifa_trabajador`. |
| Desactivar `trabajador1 - Diego` | `costos_configuracion.activo = false`. El costo laboral pasa a venir solo de turnos/liquidaciones. Elimina el doble conteo. |
| Liquidaciones existentes | **Se conservan intactas** como historial sin turno. No se crean turnos retroactivos ficticios. |

---

## 11. CRITERIOS DE ACEPTACIÓN

Cada criterio es una aserción verificable. La implementación no se considera terminada si alguno falla.

### CA-1 · Doble clic y concurrencia
Dos llamadas simultáneas a `cerrar_y_pagar_turno` para el mismo trabajador y la misma fecha producen **exactamente un turno**, **una liquidación** y **un movimiento de caja**. La segunda devuelve un error de negocio claro, no un error crudo de Postgres ni un duplicado.

### CA-2 · Doble turno el mismo día
`registrar_turno` para un trabajador y fecha que ya tiene turno vigente **falla** con mensaje explicativo. Tras anular el turno, registrar la misma fecha **sí** funciona.

### CA-3 · Pago duplicado
`pagar_turno` sobre un turno ya `PAGADO` **falla** y **no** crea una segunda liquidación ni un segundo egreso. El conteo de `movimientos_caja` no cambia.

### CA-4 · Cambio posterior de tarifa
Con un turno pagado a $40.000, cambiar `tarifa_pago` a $45.000 **no altera** `tarifa_aplicada` ni `monto_calculado` del turno pagado. Un `UPDATE` directo sobre esos campos es **rechazado por el trigger**. El turno siguiente se registra a $45.000.

### CA-5 · Turno pasado
Registrar un turno con fecha de hace 3 días **funciona**. `fecha` refleja el día trabajado y `created_at` refleja hoy — son distintos y ambos quedan guardados.

### CA-6 · Fecha futura
Registrar un turno con fecha de mañana **falla**. Se prueba tanto por la RPC como por `INSERT` directo, para confirmar que el `CHECK` también lo bloquea.

### CA-7 · Anulación
- Anular un turno `REGISTRADO` funciona y libera la fecha.
- Anular un turno `PAGADO` **se niega** con instrucción de anular primero la liquidación.
- Tras `anular_liquidacion`, el movimiento compensatorio existe y la nómina del período vuelve al valor anterior.

### CA-8 · Rollback completo
Toda la migración se ensaya dentro de `BEGIN … ROLLBACK`. Al terminar: `turnos` no existe, los conteos de `ventas`, `clientes`, `liquidaciones`, `movimientos_caja` e `insumos` son idénticos a los previos, y `costos_configuracion` conserva su estado original.

### CA-9 · Conciliación con liquidaciones y caja
Para un período dado se cumple simultáneamente:
```
SUM(turnos.tarifa_aplicada WHERE estado='PAGADO')
  = SUM(liquidaciones.monto_calculado WHERE id IN (turnos.liquidacion_id) AND estado='PAGADO')
  = SUM(movimientos_caja.monto WHERE tipo='EGRESO' AND liquidacion_id IN (...))
```
Y `fn_estado_resultados` reporta esa misma cifra como nómina del período, **sin duplicarla** con `costos_configuracion`.

### CA-10 · Aislamiento de `sesiones_caja`
Ninguna RPC de turnos lee `sesiones_caja` para decidir asistencia. El único uso permitido es como destino del egreso, vía el parámetro explícito de `pagar_liquidacion`.

### CA-11 · Permisos
`anon` no puede ejecutar ninguna RPC de turnos ni leer la tabla. Un `TRABAJADOR` ve solo sus propios turnos y **no** puede registrar ni pagar. Un administrador que no sea socio tampoco puede.

### CA-12 · Solo TRABAJADOR
`registrar_turno` sobre un perfil con `rol = 'ADMINISTRADOR'` **falla** con mensaje claro.

---

## 12. FUERA DE ALCANCE (explícito)

- Pago por horas. La tarifa es fija por turno.
- Más de un turno por día. El índice único lo impide; extender requiere una columna `secuencia` y quitar el índice.
- Vínculo formal `turno ↔ sesion_caja`. **Se omite a propósito:** una columna así invita a la interpretación automática de asistencia que el dueño quiere evitar. En su lugar se ofrece un **reporte de conciliación** ("días con sesión de caja sin turno" y viceversa), que avisa de olvidos sin que el sistema asuma nada y sin cambiar el esquema.
- Turnos para administradores.
