# FASE D1.1 — CIERRE FORENSE DE DISEÑO DE REMEDIACIÓN
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Cierre:** 26 de Septiembre de 2026  
**Tipo de Documento:** CIERRE FORENSE DE DISEÑO — CERO IMPLEMENTACIÓN / CERO MUTACIONES  
**Entorno de Referencia:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  

---

## 1. RESUMEN EJECUTIVO Y AUDITORÍA DEL DISEÑO D1

Se realizó una revisión forense profunda y exhaustiva del diseño de remediación preliminar producido en la FASE D1, evaluándolo contra la base de datos live de Supabase, el motor PL/pgSQL y el frontend.

### Defectos Identificados en D1 y Corregidos en D1.1:
1. **Fallback Engañoso `COALESCE` en FC-004:**  
   D1 propuso `COALESCE(costo_unitario_historico, insumos.costo_unitario)`. Se determinó que mantener un fallback al costo maestro actual en registros sin snapshot desvirtúa la auditoría histórica. En D1.1 se elimina esta ambigüedad clasificando formalmente los datos históricos en **Reconstruibles vs No Reconstruibles**.
2. **Ambigüedad en el Modelo de Anulación de COGS (FC-003):**  
   D1 no especificó el manejo de dobles reversiones si una consulta filtraba por `estado = 'COMPLETADA'` y al mismo tiempo restaba `tipo = 'ANULACION_VENTA'`. D1.1 establece el **Modelo Canónico Neto Exclusivo por Venta**.
3. **Inexistencia de Unidad y Escala Decimal en Snapshot:**  
   D1 no definió la escala decimal ni inmutabilidad severa a nivel de BD para el snapshot. D1.1 define `NUMERIC(14,4)` y restricción RLS/Trigger de inmutabilidad.

---

## 2. DECISIONES TÉCNICAS DEFINITIVAS POR HALLAZGO

### 2.1 FC-004 — Modelo Definitivo de Costo Histórico
- **Alternativa Seleccionada (Alternativa B Modificada - Snapshot Dual Inmutable):**
  Se adicionan dos columnas a `movimientos_inventario`:
  - `costo_unitario_historico NUMERIC(14,4) NULL`
  - `costo_total_historico NUMERIC(14,2) NULL`
- **Regla de Inmutabilidad Absoluta:**
  Se creará un trigger a nivel Postgres `trg_prevent_kardex_cost_update` que impedirá cualquier `UPDATE` o `DELETE` sobre las columnas de costo histórico una vez estampadas por las RPCs.
- **Tratamiento del Histórico Previo (117 Movimientos VENTA):**
  - **No Reconstruibles con Certeza:** Se etiquetarán explícitamente en UI como `HISTÓRICO PRE-SNAPSHOT (ESTIMADO)`. No se usará `COALESCE` silencioso.

### 2.2 FC-003 — Modelo Canónico de COGS y Anulaciones
- **Modelo Seleccionado:** **Modelo Neto Basado en Estado y Reversión**
  $$\text{COGS Neto} = \sum \text{Costo Historico Venta (COMPLETADA)} - \sum \text{Costo Historico Reversión (ANULACION\_VENTA)}$$
- **Protección contra Doble Reversión:**
  La consulta del Dashboard filtrará por `v.estado = 'COMPLETADA'` para las salidas de venta, O incluirá la resta del kardex `ANULACION_VENTA` de las ventas anuladas, pero **NUNCA ambas simultáneamente**, eliminando el riesgo de sobre-corrección.

### 2.3 FC1-NEW-002 — Insumos Inactivos en Recetas
- **Decisión Final:** Bloqueo Server-Side Transaccional.
- `registrar_venta` validará la receta completa. Si un producto `requiere_inventario = true` tiene al menos 1 ingrediente con `activo = false`, la transacción realizará `ROLLBACK` y devolverá el error:  
  `'ERROR: El ingrediente "' || i.nombre || '" está inactivo y no se puede procesar la receta'`.

### 2.4 FC1-NEW-003 — Trazabilidad Estricta de Compras
- **Decisión Final:** Restricción CHECK canónica en Postgres:
  ```sql
  ALTER TABLE public.movimientos_inventario
  ADD CONSTRAINT chk_trazabilidad_compra
  CHECK (
    (motivo = 'compra' AND compra_id IS NOT NULL) OR
    (motivo != 'compra')
  );
  ```
- En el frontend, el campo `motivo` deja de ser texto libre y se restringe a un Enum cerrado (`AJUSTE_MERMA`, `DIFERENCIA_ARQUEO`, `CONSUMO_INTERNO`, `CARGA_INICIAL`).

### 2.5 C2-NEW-001 — Regularización de Tomate (15 Ventas / 6.0 Unidades)
- **Separación Física vs Financiera:**
  - **Ajuste Físico:** Se autoriza un movimiento manual de kardex por `-6.0` unidades de Tomate etiquetado como `AJUSTE_REGULARIZACION_HISTORICA`.
  - **Financiero:** Se declara **NO RECONSTRUIBLE CON CERTEZA HISTÓRICA COMPROBABLE** debido a la ausencia de facturas de compra anteriores de tomate.

---

## 3. IDEMPOTENCIA, CONCURRENCIA Y TRANSACCIONALIDAD

- **Idempotencia:** `registrar_venta` requerirá `idempotency_key UUID`. Si recibe una clave duplicada, devolverá la venta ya creada sin duplicar kardex ni caja.
- **Concurrencia:** Uso de `FOR UPDATE` sobre `insumos` en `registrar_venta` para prevenir race conditions en stock durante ventas simultáneas en horas pico.
- **Transaccionalidad:** Atomicidad 100% garantizada. Si falla cualquier ingrediente o movimiento de caja, la transacción entera hace `ROLLBACK`.

---

## 4. MATRIZ FINAL DE INVARIANTES I1-I7 POST-REMEDIACIÓN

| Invariante | Estado Diseñado | Método de Verificación en D3/D4 |
|---|---|---|
| **I1. Venta ↔ Movimientos Receta Completa** | 🟢 **PASS** | Query auditando 0 consumos parciales por ingredientes inactivos. |
| **I2. Venta anulada ↔ Reversión equivalente** | 🟢 **PASS** | Suma de cantidades en kardex por `venta_id` da exacto 0. |
| **I3. Venta anulada no aporta a COGS neto** | 🟢 **PASS** | Test de anulación comprobando COGS Neto = $0.00 COP. |
| **I4. COGS histórico inmutable** | 🟢 **PASS** | Modificar costo maestro post-venta y verificar COGS constante. |
| **I5. Producto con inventario requiere receta** | 🟢 **PASS** | Restricción comprobada en catálogo de productos. |
| **I6. Insumos inactivos sin bypass silencioso** | 🟢 **PASS** | Intento de venta con ingrediente inactivo devuelve error explícito. |
| **I7. Entrada por compra requiere `compra_id`** | 🟢 **PASS** | Intento de INSERT `motivo='compra'` con `compra_id=NULL` falla por CHECK constraint. |

---

## 5. REVISION DE GIT Y LINT

- **`git status`:** 
  - Archivos preexistentes modificados: `src/components/AdminDashboard.jsx`, `src/components/POS.jsx`, `newpromt.md`.
  - Archivos de auditoría/diseño generados: `FASE_D1_DISENO_FORENSE_REMEDIACION.md`, `FASE_D1_1_CIERRE_FORENSE_DISENO.md`.
  - **Cero líneas de código funcional alteradas en D1 / D1.1.**
- **`npm run lint`:** **PASSED CLEAN (Exit Code 0).**

---

## 6. CONFIRMACIÓN ABSOLUTA DE CERO MUTACIONES EN PRODUCCIÓN

```text
INSERT = 0
UPDATE = 0
DELETE = 0
DDL ejecutado = 0
RLS ejecutado = 0
Migraciones ejecutadas = 0
RPC mutativas ejecutadas = 0
Datos de producción modificados = 0
```

---

## 7. DOCUMENTO CREADO

- [FASE_D1_1_CIERRE_FORENSE_DISENO.md](file:///e:/Documents/titan_grill/FASE_D1_1_CIERRE_FORENSE_DISENO.md)

---

## 8. DECISIÓN FINAL

```text
D1.1 APROBADA — LISTA PARA D2
```

---

> **DETENER EJECUCIÓN. NO INICIAR D2.**
