# FASE D2.3 — IMPLEMENTACIÓN CONTROLADA: COMPRAS, TRAZABILIDAD Y AJUSTES

## 1. RESUMEN EJECUTIVO

Se completó exitosamente la Fase D2.3 en Supabase (Producción), garantizando:
- Snapshot histórico de costo en compras (`costo_unitario_historico` y `costo_total_historico`) derivado directamente del detalle real de la compra.
- Corrección del registro huérfano FC1-NEW-003 (`7c402a48-089b-47ff-9745-ab6f74517332`) convirtiendo su motivo a un ajuste de inventario histórico sin inventar compras ficticias.
- Implementación de la restricción de integridad (`chk_movimientos_compra_trazabilidad`) que impide entradas por motivo `compra` sin `compra_id`.
- Regularización física de -6.0 unidades del ingrediente Tomate (C2-NEW-001) por ventas históricas no descontadas antes de D2.2, sin alterar movimientos históricos ni inventar COGS.
- Protección en `registrar_carga_masiva_inventario` contra selección de `motivo = 'compra'` fuera del módulo de compras.

---

## 2. PREFLIGHT Y DIAGNÓSTICO

1. **`recibir_compra`:** No grababa snapshots de costo histórico en `movimientos_inventario`.
2. **Dato FC1-NEW-003:** ID `7c402a48-089b-47ff-9745-ab6f74517332` tenía `motivo = 'compra'`, `cantidad = 271`, `compra_id = NULL`.
3. **C2-NEW-001:** Tomate tenía omisión histórica de 6.0 unidades por 15 ventas de Burger Classic con Tomate inactivo.

---

## 3. CAMBIOS IMPLEMENTADOS

### A. Snapshot en `recibir_compra`
Se actualizó la RPC `recibir_compra` para capturar `costo_unitario` y `costo_total` de `compra_detalles` e insertarlos inmutablemente en `movimientos_inventario`:
- `costo_unitario_historico`
- `costo_total_historico`

### B. Regularización FC1-NEW-003
El movimiento `7c402a48-089b-47ff-9745-ab6f74517332` fue actualizado:
- `motivo` = `'Ajuste de inventario histórico sin compra asociada'`
- Trazabilidad y cantidades conservadas intactas.

### C. Constraint de Trazabilidad
Se creó la restricción:
```sql
ALTER TABLE public.movimientos_inventario
  ADD CONSTRAINT chk_movimientos_compra_trazabilidad
  CHECK (
    NOT ( (motivo = 'compra' OR motivo = 'Recepción de compra' OR tipo = 'ENTRADA_COMPRA') AND compra_id IS NULL )
  );
```

### D. Regularización Física del Tomate (-6.0 Unidades)
Se aplicó ajuste físico al insumo Tomate (`f4d17d9e-87ba-42cc-abe0-071eb0a6b8d7`):
- `UPDATE public.insumos SET stock_actual = stock_actual - 6` (Stock actual: 316.4)
- Movimiento registrado con `tipo = 'AJUSTE'`, `cantidad = -6`, `motivo = 'regularización física histórica'`, y snapshots `NULL`.

### E. Protección en Ajustes Manuales
Se agregó guard clause en `registrar_carga_masiva_inventario` rechazando intentos de ingresar `motivo = 'compra'` o `tipo = 'ENTRADA_COMPRA'`.

---

## 4. RESULTADO DE PRUEBAS Y VALIDACIÓN

| # | Prueba | Resultado | Estado |
|---|--------|-----------|--------|
| 1 | `recibir_compra` genera snapshot e ID compra | `costo_unitario_historico` y `compra_id` correctos | PASS |
| 2 | Intento de `motivo=compra` sin `compra_id` | Rechazado por constraint `chk_movimientos_compra_trazabilidad` | PASS |
| 3 | Intento de `motivo=compra` en Carga Masiva | Rechazado por Guard Clause | PASS |
| 4 | Regularización Tomate -6 unidades | Stock actualizado a 316.4, registro de auditoría creado | PASS |
| 5 | Invariantes históricas | 969 movimientos históricos con snapshots NULL intactos | PASS |
| 6 | Baseline de Ventas/Caja | Total ventas = 99, Total caja = 120 (Intactos) | PASS |
| 7 | Lint ESLint | `npm run lint` -> Exit code 0 | PASS |

---

## 5. RESULTADO FINAL D2.3

```text
D2.3 RESULTADO: PASS

Compras: PASS
Snapshot compras: PASS
Trazabilidad: PASS
FC1-NEW-003: PASS
Tomate -6: PASS
Ajustes manuales: PASS
Invariantes: PASS
Pruebas: PASS
Lint: PASS
Git: Cambios aplicados en Supabase produccion, ESLint PASS, documentacion FASE_D2_3_COMPRAS_TRAZABILIDAD_AJUSTES.md generada.

Bloqueadores:
- Ninguno

Siguiente fase:
D2.4 / NO AUTORIZADA
```
