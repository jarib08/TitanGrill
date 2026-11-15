# FASE D.1: CORRECCIÓN DEL MOTOR DE COMPRAS E INTEGRIDAD TRANSACCIONAL

> **Documento Oficial de Resultados de Implementación**  
> **Fecha de ejecución:** 24 de Septiembre de 2026  
> **Estado:** COMPLETADO CON ÉXITO  
> **ID de Proyecto Supabase:** `mbyjehhplruoqlgphfvw`  

---

## 1. OBJETIVO DE LA FASE D.1

Corregir exclusivamente los cuellos de botella e inconsistencias de integridad en el módulo de compras del sistema Titan Grill, garantizando que:
1. Una misma compra no pueda ser recibida ni procesada dos veces por condiciones de carrera de red o reintentos manuales del usuario.
2. La recepción y la anulación de compras ejecuten transiciones atómicas de estado en PostgreSQL.
3. Los egresos e ingresos financieros en `movimientos_caja` queden vinculados a la sesión de caja activa (`sesion_id`) cuando corresponda.
4. Las anulaciones de compras generen movimientos de inventario con el tipo explícito `ANULACION_COMPRA`.

---

## 2. HALLAZGOS ATENDIDOS EN FASE D.1

| Hallazgo | Severidad | Solución Implementada | Estado |
|----------|-----------|-----------------------|--------|
| **`FC3-NEW-002`** | **HIGH** | Incorporación de `idempotency_key` (`UUIDv4`) en `compras`, `recibir_compra` y `anular_compra`. Soporte de recuperación de respuesta sin duplicar. | **CORREGIDO** |
| **`CR-01`** | **CRITICAL** | Bloqueo de fila `FOR UPDATE` en `recibir_compra` y `anular_compra` para garantizar atocimidad transaccional frente a concurrencia. | **CORREGIDO** |
| **`FC-002`** | **HIGH** | Asociación automática de la sesión de caja abierta (`sesion_id`) en los movimientos financieros creados por compras. | **CORREGIDO** |
| **`FC-007`** | **MEDIUM** | Actualización de la restricción de verificación (`CHECK constraint`) en `movimientos_inventario` para clasificar las reversiones como `ANULACION_COMPRA`. | **CORREGIDO** |

---

## 3. ARCHIVOS MODIFICADOS

### Frontend:
- **`src/components/AdminDashboard.jsx`**:
  - Modificado para generar un `operationKey = crypto.randomUUID()` antes de llamar a las RPCs `recibir_compra` y `anular_compra`.
  - Envío del parámetro `p_idempotency_key: operationKey` tanto en recepción inmediata de compra como en la recepción manual y en la anulación.
  - Gestión visual de la respuesta recuperada (`recovered: true`).

---

## 4. CAMBIOS SQL APLICADOS (BASE DE DATOS SUPABASE)

- `ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS idempotency_key uuid UNIQUE;`
- Actualización de `CHECK constraint` en `movimientos_inventario` para permitir `ANULACION_COMPRA`.
- Re-creación de `recibir_compra` con bloqueo `FOR UPDATE`, soporte para `p_idempotency_key` e inserción de `sesion_id`.
- Re-creación de `anular_compra` con bloqueo `FOR UPDATE`, soporte para `p_idempotency_key` e inserción de `sesion_id`.

---

## 5. MECANISMO DE IDEMPOTENCIA
El flujo cliente -> servidor opera de la siguiente manera:
1. El cliente en `AdminDashboard.jsx` genera un `UUIDv4` (`operationKey`) inmediatamente al solicitar la recepción o anulación.
2. Se envía la solicitud a PostgreSQL pasando `p_idempotency_key: operationKey`.
3. PostgreSQL ejecuta un bloqueo exclusivo `FOR UPDATE` sobre la fila de la compra.
4. Si la compra ya se encuentra en estado objetivo (`RECIBIDA` o `ANULADA`) y coincide la llave de idempotencia guardada, retorna la respuesta de éxito previa con `recovered: true`.
5. Si no coincide o la compra ya cambió de estado por otra transacción, rechaza la operación sin re-procesar inventarios ni caja.

---

## 6. GESTIÓN DE CONCURRENCIA
- La inclusión de `FOR UPDATE` al inicio de `recibir_compra` y `anular_compra` garantiza serializabilidad a nivel de fila.
- Si dos administradores o peticiones idénticas por fallo de red intentan ejecutar `recibir_compra` sobre el mismo ID al mismo tiempo, la segunda transacción esperará el término de la primera y abortará al encontrar que el estado ya cambió a `RECIBIDA`.

---

## 7. VINCULACIÓN CON SESIONES DE CAJA (`sesion_id`)
- Ambas rutinas buscan la sesión de caja activa (`estado = 'ABIERTA'`).
- Si existe una sesión activa, asignan su `id` a la columna `sesion_id` del movimiento en `movimientos_caja`.
- Esto garantiza que el arqueo final de caja en `cerrar_caja` contabilice correctamente los egresos e ingresos compensatorios generados por las compras.

---

## 8. MATRIZ DE PRUEBAS DE VALIDACIÓN

| Prueba | Escenario de Test | Resultado Esperado | Resultado Real |
|--------|-------------------|--------------------+----------------|
| **TEST 1** | Recepción de compra normal (`BORRADOR` → `RECIBIDA`) | Stock incrementado, `movimientos_caja` EGRESO registrado con `sesion_id`, `ENTRADA_COMPRA` creado. | **PASÓ 100%** |
| **TEST 2** | Solicitud duplicada simultánea por conectividad | 1 solo incremento de stock, 1 solo egreso financiero, segunda llamada rechazada/recuperada. | **PASÓ 100%** |
| **TEST 3** | Reintento enviando la misma `idempotency_key` tras respuesta de red perdida | Retorna `recovered: true` sin re-ejecutar mutaciones de base de datos. | **PASÓ 100%** |
| **TEST 4** | Anulación de compra normal (`RECIBIDA` → `ANULADA`) | Stock descontado, movimiento de inventario `ANULACION_COMPRA`, INGRESO financiero compensatorio. | **PASÓ 100%** |
| **TEST 5** | Doble anulación simultánea | 1 sola reversión de stock, 1 solo ingreso compensatorio. | **PASÓ 100%** |
| **TEST 6** | Intentar anular una compra ya anulada con otra llave | Mensaje de error: *"La compra ya se encuentra anulada"*. | **PASÓ 100%** |

---

## 9. REGISTROS HISTÓRICOS DE DATOS

- **NO SE MODIFICARON DATOS HISTÓRICOS DE PRODUCCIÓN.**
- Las compras y movimientos registrados previamente a esta fase se conservaron intactos para evitar cualquier alteración retroactiva de balances.

---

## 10. RIESGOS PENDIENTES Y PASOS SIGUIENTES

Los siguientes aspectos NO formaban parte del alcance de la FASE D.1 y quedan diferidos para las fases autorizadas posteriormente:
- **FASE D.2**: Resiliencia y resolución del bloqueo de carga inicial en `POS.jsx` ("Cargando caja...").
- **FASE D.3**: Paralelización de consultas iniciales del POS con `Promise.all` e índice `pg_trgm`.

---

## 11. ESTADO DE GIT Y VERIFICACIÓN DE COMPILACIÓN

- `npm run lint`: **0 ERRORES**
- `npm run build`: **COMPILACIÓN EXITOSA EN PRODUCCIÓN (`✓ built in 34.98s`)**
- Commits creados: **0 (Sin commits ni pushes, según restricciones de control)**

---
