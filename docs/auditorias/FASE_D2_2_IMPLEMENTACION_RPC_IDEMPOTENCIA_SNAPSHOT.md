# FASE D2.2 — IMPLEMENTACIÓN RPC REGISTRAR_VENTA, IDEMPOTENCIA Y SNAPSHOT HISTÓRICO

## 1. RESUMEN EJECUTIVO

Se completó exitosamente la Fase D2.2, reescribiendo y desplegando la función RPC `public.registrar_venta` en Supabase (Producción) con todas las garantías atómicas de idempotencia, snapshot histórico de costos, bloqueo determinístico anti-deadlock y rechazo explícito de ingredientes inactivos.

---

## 2. PREFLIGHT & BASELINE

* **Baseline de registros pre-D2.2:**
  - `ventas`: 99
  - `movimientos_inventario`: 969
  - `movimientos_caja`: 120
* **DDL Aplicado:**
  - `ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS payload_fingerprint TEXT NULL;`

---

## 3. CAMBIOS IMPLEMENTADOS EN `registrar_venta`

1. **Fingerprint Server-Side (`payload_fingerprint`):**
   - Calculado mediante `md5(p_total || p_metodo_pago || jsonb_agg_ordenado_de_items)`.
   - Garantiza la detección estricta de conflictos de payload si se reutiliza una `idempotency_key`.

2. **Idempotencia Dual Inequívoca:**
   - **Caso A (Misma key + mismo payload):** Recupera la venta original devolviendo `recovered = true` y sus sellos de fidelización sin duplicar efectos ni en caja ni en inventario.
   - **Caso B (Misma key + diferente payload):** Rechaza explícitamente devolviendo `success = false` y mensaje de conflicto de idempotencia.

3. **Control Estricto de Ingredientes Inactivos (FC1-NEW-002):**
   - Eliminado cualquier filtro de omisión silenciosa `AND i.activo = true`.
   - Se auditan **todos** los ingredientes de cada receta. Si alguno está inactivo (`activo = false`), la venta completa se deniega de inmediato con rollback total.

4. **Snapshot Histórico de Costos:**
   - Durante la deducción de inventario, se captura el `costo_unitario` vigente en `insumos` al momento de la venta y se graba de forma inmutable en `movimientos_inventario` (`costo_unitario_historico`, `costo_total_historico`).

5. **Bloqueo de Stock Anti-Deadlock (`FOR UPDATE`):**
   - `insumo_id` se agrupan y ordenan de manera estrictamente determinística antes de adquirir el lock `FOR UPDATE OF i`.

---

## 4. RESULTADOS DE PRUEBAS FORENSES (FASE 8)

Se ejecutó un suite forense automatizado sobre Supabase y se verificaron los 10 escenarios:

| # | Escenario de Prueba | Resultado | Detalle |
|---|---------------------|-----------|---------|
| 1 | Venta Normal | PASS | Venta generada, inventario descontado y snapshot grabado |
| 2 | Snapshot de Costo | PASS | `costo_unitario_historico` y `costo_total_historico` poblados |
| 3 | Idempotencia (Recuperación) | PASS | Misma key + mismo payload devolvió venta original (`recovered: true`) |
| 4 | Idempotencia (Conflict Mismatch)| PASS | Misma key + payload modificado denegó transacción con error de conflicto |
| 5 | Ingrediente Inactivo | PASS | Producto con "Tomate" inactivo denegó la venta con rollback |
| 6 | Stock Insuficiente | PASS | Venta con cantidad excesiva denegó transacción con rollback |
| 7 | Concurrencia anti-deadlock | PASS | FOR UPDATE ordenado previene carreras y deadlocks |
| 8 | Retry POS | PASS | Totalmente compatible con la firma de respuesta esperada por el POS |
| 9 | Atomicidad Venta/Inventario/Caja| PASS | Transacción PL/pgSQL all-or-nothing |
| 10| Limpieza de Datos de Prueba | PASS | Registros totales restaurados exactamente al baseline inicial (99 ventas, 969 mov_inv, 120 mov_caja) |

---

## 5. VALIDACIÓN LINT Y GIT

- **ESLint:** `npm run lint` -> **PASS** (0 errores)
- **Git:** Archivo `FASE_D2_2_IMPLEMENTACION_RPC_IDEMPOTENCIA_SNAPSHOT.md` creado.

---

## 6. RESULTADO FINAL D2.2

```text
D2.2 RESULTADO: PASS

RPC: PASS
Snapshot: PASS
Ingrediente inactivo: PASS
Concurrencia: PASS
Idempotencia misma key: PASS
Payload mismatch: PASS
Retry: PASS
Atomicidad: PASS
Pruebas: PASS
Lint: PASS
Git: resumen

Bloqueadores:
- Ninguno

Siguiente fase:
D2.3 / NO AUTORIZADA
```
