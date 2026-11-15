# FASE C.2 — AUDITORÍA FORENSE CRUZADA: VENTA → RECETA → INVENTARIO → COGS
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 24 de Septiembre de 2026  
**Tipo de Auditoría:** AUDITORÍA FORENSE CRUZADA READ-ONLY — CERO MODIFICACIONES EN PRODUCCIÓN  
**Entorno Verificado:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  
**Documentos Predecesores:**  
- [FASE_C1_VALIDACION_HALLAZGOS_INVENTARIO.md](file:///e:/Documents/titan_grill/FASE_C1_VALIDACION_HALLAZGOS_INVENTARIO.md)  
- [FASE_C_AUDITORIA_INVENTARIO_COMPRAS.md](file:///e:/Documents/titan_grill/FASE_C_AUDITORIA_INVENTARIO_COMPRAS.md)  
- [TITAN_GRILL_FUENTE_DE_LA_VERDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_FUENTE_DE_LA_VERDAD.md)  
- [TITAN_GRILL_INVARIANTES_FINANCIERAS.md](file:///e:/Documents/titan_grill/TITAN_GRILL_INVARIANTES_FINANCIERAS.md)  
- [TITAN_GRILL_MATRIZ_INTEGRIDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_INTEGRIDAD.md)  
- [TITAN_GRILL_MATRIZ_RPC.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_RPC.md)  

---

## 1. OBJETIVO

Continuar la investigación forense no destructiva del subsistema de Titan Grill rastreando la cadena transaccional completa:
$$\text{VENTA} \to \text{PRODUCTO} \to \text{RECETA} \to \text{INSUMOS} \to \text{MOVIMIENTOS\_INVENTARIO} \to \text{ANULACIÓN} \to \text{COGS} \to \text{UTILIDAD BRUTA} \to \text{ADMIN DASHBOARD}$$

Determinar con precisión cuantitativa y evidencia fáctica si existen distorsiones financieras adicionales, omisiones silenciosas de inventario en recetas o inconsistencias en la contabilidad de costos.

---

## 2. ALCANCE

- **Modo 100% Solo Lectura:** Cero sentencias DDL/DML (`INSERT`, `UPDATE`, `DELETE`, `ALTER`). Cero mutaciones en base de datos, RLS, índices, triggers o código.
- **Universo de Datos Live de Producción:** 99 ventas registradas, 969 movimientos de kardex, 51 insumos, 13 productos, 42 vínculos de receta (`producto_insumos`), 1 compra histórica de 3 detalles ($38,650 COP) y 120 movimientos de caja.

---

## 3. FUENTES CONSULTADAS

1. **Esquema de Base de Datos Live (Supabase Postgres 17.6.1):** Consultas de auditoría read-only sobre `ventas`, `productos`, `insumos`, `producto_insumos`, `movimientos_inventario`, `compras`, `compra_detalles` y `movimientos_caja`.
2. **Motor PL/pgSQL:** Definiciones de `registrar_venta`, `ejecutar_anulacion_venta`, `anular_venta_directa`, `recibir_compra` y `anular_compra` en `pg_proc`.
3. **Código Frontend:** [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx) (7,495 líneas) y [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx) (1,899 líneas).

---

## 4. METODOLOGÍA

- **Reconciliación Inversa:** Reconstrucción punto por punto de cada movimiento de inventario contra su venta origen y su receta asociada.
- **Censo de Ventas Anuladas:** Análisis al 100% de la tabla `ventas` para identificar de forma exhaustiva cualquier venta con `estado != 'COMPLETADA'`.
- **Triangulación Financiera de COGS:** Comparación entre la fórmula ejecutada por React en [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx) vs el costo real de despacho al momento del pedido.

---

## 5. VALIDACIÓN PROFUNDIZADA FC-003 (COGS Y VENTAS ANULADAS)

### 5.1 Censo de Ventas Anuladas en Producción
La consulta SQL completa sobre `public.ventas` certifica que existen únicamente **2 estados de venta en toda la historia del negocio**:
- `COMPLETADA`: **97 ventas** ($1,438,400 COP brutos).
- `ANULADA`: **2 ventas** ($19,980 COP brutos).

Cero ventas en estado `PENDIENTE`, `BORRADOR` o `EN_PROCESO`.

### 5.2 Reconstrucción Completa de las Ventas Anuladas
1. **Venta `0ea5b67f-f49a-4221-9995-f60b01cb4ec9`:**
   - **Fecha:** `2026-09-09 00:34:18.648974 UTC` | **Total:** $9,990 COP | **Método:** BANCOLOMBIA
   - **Producto Sold:** 1 x `Vulcano Dog` ($9,990)
   - **Movimientos VENTA:** 9 registros de salida (`-1` Pan Perro, `-1` Porta Perro, `-1` Queso Chalo, `-1` Salchicha Jumbo, `-1` Tocineta, `-2` Salsa Acompañamiento, `-15g` Ripia, `-3` Servilleta, `-4` Salsa Piña).
   - **Movimientos ANULACION_VENTA:** 9 registros de entrada compensatoria idénticos y simétricos.
2. **Venta `c207bbb1-c6f2-46b3-a3bd-dbc82d02ce94`:**
   - **Fecha:** `2026-09-09 00:35:24.380494 UTC` | **Total:** $9,990 COP | **Método:** BANCOLOMBIA
   - **Producto Sold:** 1 x `Vulcano Dog` ($9,990)
   - **Movimientos VENTA:** 9 registros de salida idénticos.
   - **Movimientos ANULACION_VENTA:** 9 registros de entrada compensatoria idénticos.

### 5.3 Demostración de la Fórmula de COGS en `AdminDashboard.jsx`
En [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339-L375):
```javascript
// Consulta ejecutada en frontend:
supabase.from('movimientos_inventario').select('cantidad, insumos(costo_unitario)').eq('tipo', 'VENTA')
```
- La consulta toma **exclusivamente `tipo = 'VENTA'`**.
- No realiza JOIN con `ventas` para filtrar `estado = 'COMPLETADA'`.
- Tampoco consulta ni descuenta los registros con `tipo = 'ANULACION_VENTA'`.

### 5.4 Reconciliación Matemática de COGS
| Concepto | Venta `0ea5b67f` | Venta `c207bbb1` | Total Anulaciones |
|---|---|---|---|
| Ingreso Bruto Anulado | $9,990.00 COP | $9,990.00 COP | **$19,980.00 COP** |
| Costo por Insumos Despachados | $5,770.50 COP | $5,770.50 COP | **$11,541.00 COP** |
| Costo por Insumos Reintegrados | -$5,770.50 COP | -$5,770.50 COP | **-$11,541.00 COP** |
| **COGS Neto Real Post-Anulación** | **$0.00 COP** | **$0.00 COP** | **$0.00 COP** |
| **COGS Computado en Dashboard** | **+$5,770.50 COP** | **+$5,770.50 COP** | **+$11,541.00 COP** |
| **Diferencia / Distorsión en COGS** | **+$5,770.50 COP** | **+$5,770.50 COP** | **+$11,541.00 COP** |

**Diagnóstico:** El Dashboard descuenta los $19,980 COP de los ingresos brutos, pero mantiene intactos los $11,541 COP de costo de los productos devueltos al inventario.  
**Efecto:** La Utilidad Bruta del restaurante está castigada indebidamente en **$11,541.00 COP**.

---

## 6. VALIDACIÓN PROFUNDIZADA FC-004 (COSTO HISTÓRICO VS ACTUAL: RECONCILIACIÓN 26 VS 117)

### 6.1 Desglose Fáctico Numérico (26 vs 117)
- **117 movimientos:** Representa el total absoluto de registros de tipo `VENTA` en `movimientos_inventario` ocurridos antes de la recepción de la compra del **08-sep-2026 16:24:17 UTC**.
- **26 movimientos:** Representa la cantidad exacta de movimientos pertenecientes a los **tres insumos adquiridos en esa compra** (Ripia, Pan Burger, Pan Perro) cuyos precios fueron modificados en el catálogo maestro.
- **91 movimientos:** Corresponde a movimientos de venta de otros insumos cuyos precios maestros no cambiaron en esa transacción.

| Métrica | Cantidad |
|---|---|
| Total movimientos VENTA en kardex histórico | 896 |
| Movimientos VENTA antes del cambio de costos (08-sep 16:24 UTC) | 117 |
| Movimientos afectados por Ripia (256g consumidos) | 13 |
| Movimientos afectados por Pan Hamburguesa (7u consumidas) | 4 |
| Movimientos afectados por Pan Perro (14u consumidas) | 9 |
| **Total movimientos de los 3 insumos alterados por la compra** | **26** |
| Movimientos de otros insumos sin variación de costo | 91 |

### 6.2 Demostración del Defecto
1. `movimientos_inventario` no guarda snapshot de costo al momento del despacho.
2. Al ejecutarse `recibir_compra` el 08-sep-2026 16:24 UTC, la función sobreescribió `insumos.costo_unitario` (Ripia $11.50/g, Pan Burger $1,400/u, Pan Perro $1,250/u).
3. [AdminDashboard.jsx:L372](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L372) calcula `COGS = cantidad × insumos.costo_unitario`, por lo cual las 26 ventas de estos insumos anteriores a la compra asumen el precio nuevo en lugar del precio vigente cuando se despacharon.
4. **Disponibilidad de Costos Históricos:** Al no existir registros de compras previas en `compra_detalles` antes del 08-sep-2026, el impacto monetario exacto es **no cuantificable con certeza histórica comprobable**, aunque el defecto estructural está 100% confirmado.

---

## 7. VALIDACIÓN FC1-NEW-002 Y C2-NEW-001 (INSUMOS INACTIVOS EN RECETAS)

### 7.1 Análisis del Motor PL/pgSQL
En `public.registrar_venta` (Paso 4 y Paso 7):
```sql
SELECT pi.insumo_id, (pi.cantidad_por_unidad * v_item_qty) AS required_qty, i.stock_actual, i.nombre
FROM public.producto_insumos pi
JOIN public.insumos i ON pi.insumo_id = i.id
WHERE pi.producto_id = v_producto_id AND i.activo = true;
```
La condición `AND i.activo = true` excluye cualquier insumo marcado `activo = false` del set de datos procesado por el POS.

### 7.2 Reconciliación Exacta de Titán Burger y Tomate (6.0 Unidades)
| Dato | Resultado |
|---|---|
| Pedidos / Ventas de Titán Burger en Producción | 9 ventas |
| Unidades totales vendidas de Titán Burger | 15 unidades |
| Insumo `Tomate` en receta (`cantidad_por_unidad`) | 0.4 unidades |
| **Tomate físicamente esperado** | **6.0 unidades** |
| Tomate descontado en kardex | 0.0 unidades |
| **Diferencia / Tomate omitido silenciosamente** | **6.0 unidades** |

### 7.3 Impacto en COGS y Financiero
- Insumo `Tomate` (`8499a4c1`): `costo_unitario = 600` COP en la tabla `insumos`.
- Valor estimado a precio catálogo actual: $600 \times 6.0 = \mathbf{\$3,600.00\ COP}$.
- Al no registrarse filas `VENTA` en `movimientos_inventario` para Tomate, el costo del tomate **no fue incluido en el COGS del Dashboard**.
- Al no existir facturas de compra previas de tomate en `compra_detalles`, el impacto financiero se clasifica como: **CONFIRMADO CON IMPORTE MONETARIO NO CUANTIFICABLE CON CERTEZA HISTÓRICA COMPROBABLE**.

---

## 8. INTEGRIDAD DE RECETAS (AUDITORÍA COMPLETA DE CATÁLOGO)

Se ejecutaron consultas forenses cruzadas sobre el 100% de `productos`, `producto_insumos` e `insumos`:

| Regla de Integridad de Receta | Resultado | Evidencia en Producción Live |
|---|---|---|
| **Recetas huérfanas de producto (`producto_id` no existe)** | 🟢 **0** | Todas las 42 filas de `producto_insumos` vinculan a un producto válido. |
| **Recetas huérfanas de insumo (`insumo_id` no existe)** | 🟢 **0** | Todos los 42 vínculos apuntan a insumos válidos en `insumos`. |
| **Cantidades nulas o negativas (`cantidad_por_unidad <= 0`)** | 🟢 **0** | Todas las 42 cantidades son estrictamente $> 0$. |
| **Insumos duplicados en la misma receta** | 🟢 **0** | Restricción `UNIQUE(producto_id, insumo_id)` activa y respetada. |
| **Productos activos que requieren inventario sin receta** | 🟢 **0** | Todos los 6 productos activos con `requiere_inventario = true` tienen recetas configuradas. |
| **Insumos inactivos vinculados a productos activos** | 🔴 **1** | `Titán burger` vincula al insumo `Tomate` (`activo = false`). |
| **Productos sin receta** | 🟢 **1** | `Vaso de gaseosa` (`9a0c464c`), pero tiene `requiere_inventario = false` (Comportamiento correcto). |

---

## 9. VALIDACIÓN FC1-NEW-003 (MOVIMIENTO `7c402a48` +271 LECHUGAS)

### 9.1 Evidencia y Trazabilidad de Código
- **Registro:** `7c402a48-089b-47ff-9745-ab6f74517332` (14-sep-2026 15:45:01 UTC)
- **Insumo:** `Lechuga Crespa` | **Tipo:** `ENTRADA` | **Cantidad:** `+271` | **Motivo:** `'compra'` | **`compra_id: NULL`**
- **Origen de Código:** [AdminDashboard.jsx:L1323-L1330](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1323-L1330) (`handleGuardarAjuste`).
- **Verificación de Caja:** La consulta sobre `movimientos_caja` en el rango temporal del 14-sep-2026 demuestra que **no existe ningún egreso ni movimiento monetario relacionado**. Todos los movimientos de caja de esa fecha fueron ingresos por ventas a partir de las 22:48 UTC.
- **Clasificación C2-CHECK-004:** **Opción C — Existe solamente ajuste de inventario.** El socio utilizó el modal de ajuste manual de UI, seleccionó `tipo = ENTRADA` y escribió manualmente el texto libre `'compra'`, creando un ajuste de stock sin orden de compra ni desembolso de caja.

---

## 10. EVALUACIÓN DE INVARIANTES (I1 A I7)

| Invariante | Estado | Justificación Técnica Forense |
|---|---|---|
| **I1. Venta válida ↔ Movimientos de inventario** | 🟡 **PARTIAL** | 97 ventas completadas generaron 896 salidas de kardex. Sin embargo, las 15 ventas de `Titán burger` omitieron silenciosamente el insumo `Tomate` por estar inactivo. |
| **I2. Venta anulada ↔ Reversión equivalente** | 🟢 **PASS** | Cumplida en BD. Las 2 ventas anuladas generaron 18 salidas `VENTA` y 18 entradas `ANULACION_VENTA` simétricas. |
| **I3. Venta anulada no contribuye al COGS neto** | 🔴 **FAIL** | Violada en [AdminDashboard.jsx:L339](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339). Las ventas anuladas sobrecargan el COGS en **$11,541.00 COP**. |
| **I4. COGS histórico no depende de costo actual** | 🔴 **FAIL** | Violada por falta de snapshot en `movimientos_inventario`. 117 salidas históricas se recalculan al costo de compra posterior. |
| **I5. Producto con inventario requiere receta** | 🟢 **PASS** | Todos los productos activos con `requiere_inventario = true` tienen recetas configuradas. |
| **I6. Insumo inactivo no causa bypass silencioso** | 🔴 **FAIL** | Violada en `registrar_venta`. 15 ventas de `Titán burger` ignoraron silenciosamente el descuento del insumo `Tomate`. |
| **I7. Movimiento de compra rastreable a orden** | 🔴 **FAIL** | Violada por registro `7c402a48` (+271 Lechugas) que declaró motivo `'compra'` con `compra_id = NULL`. |

---

## 11. CLASIFICACIÓN FINAL DE HALLAZGOS FASE C.2

| ID | Hallazgo Auditado | Estado C.2 | Severidad Validada | Tipo |
|---|---|---|---|---|
| **FC-003** | Distorsión COGS por ventas anuladas en Dashboard | **CONFIRMADO** | 🔴 CRÍTICO | DEFECTO TÉCNICO CONFIRMADO |
| **FC-004** | Recálculo retroactivo del costo histórico de ventas | **CONFIRMADO** | 🟠 ALTO | DEFECTO TÉCNICO CONFIRMADO |
| **FC1-NEW-002** | Bypass silencioso de recetas por insumos inactivos | **CONFIRMADO** | 🟡 MEDIO | DEFECTO TÉCNICO CONFIRMADO |
| **FC1-NEW-003** | Entrada manual +271 con motivo 'compra' sin `compra_id` | **CONFIRMADO** | 🟡 MEDIO | ANOMALÍA HISTÓRICA / BYPASS OPERATIVO |
| **C2-NEW-001** | Consumo fantasma comprobado en 15 ventas de Titán Burger (6.0 tomates omitidos) | **CONFIRMADO** | 🟡 MEDIO | NUEVO HALLAZGO DEMOSTRADO |

---

## 12. MATRIZ DE IMPACTO INTEGRADA

| Hallazgo | Código Afectado | Tabla Afectada | Módulo Afectado | Impacto Financiero | Impacto Inventario | Impacto COGS | Impacto Dashboard | Datos Reales Afectados | Severidad | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| **FC-003** | [AdminDashboard.jsx:L339](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339) | `movimientos_inventario` | Dashboard / Rentabilidad | Resta $19,980 en ventas pero mantiene $11,541 en COGS | Ninguno (stock revirtió) | **+$11,541.00 COP** | Utilidad Bruta deprimida | Ventas `0ea5b67f` y `c207bbb1` | 🔴 CRÍTICO | CONFIRMADO |
| **FC-004** | [AdminDashboard.jsx:L372](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L372), `recibir_compra` | `insumos`, `movimientos_inventario` | Kardex / Reportes | Alteración retroactiva de costos de venta | Ninguno en cantidades | Descalibre en comparabilidad | COGS histórico alterado | 117 salidas (26 de insumos alterados) | 🟠 ALTO | CONFIRMADO |
| **FC1-NEW-002** | `registrar_venta` (Paso 4 y 7) | `producto_insumos`, `insumos` | POS / Inventario | Ninguno directo | Descuento de stock omitido | COGS subestimado en Tomate | Inconsistencia venta/stock | Insumo `Tomate` (`8499a4c1`) | 🟡 MEDIO | CONFIRMADO |
| **FC1-NEW-003** | [AdminDashboard.jsx:L1323](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1323) | `movimientos_inventario` | Inventario / Compras | Egreso no registrado en caja | Stock +271 lechugas | Ninguno directo | Entrada sin respaldo | Registro `7c402a48` | 🟡 MEDIO | CONFIRMADO |
| **C2-NEW-001** | `registrar_venta` | `ventas`, `producto_insumos` | POS / Cocina | Omitió costo de tomate en COGS | 6.0 unidades de tomate no descontadas | No cuantificable con certeza histórica | 15 ventas sin log de tomate | 15 ventas de Titán Burger | 🟡 MEDIO | CONFIRMADO |

---

## 13. ELEMENTOS NO VERIFICABLES

1. **Costo histórico exacto del insumo Tomate:** Al no existir facturas de compra de tomate en `compra_detalles` ni snapshot de costo en `movimientos_inventario`, el importe monetario exacto del COGS omitido por las 6.0 unidades de tomate es no cuantificable con certeza histórica comprobable.
2. **Intención operativa de la desactivación del Tomate:** No es posible determinar desde el código si el socio desactivó el tomate por falta de insumo en cocina o por error de configuración.

---

## 14. VERIFICACIÓN DE PRODUCCIÓN (CERO MODIFICACIONES)

- **Código fuente modificado:** 0
- **SQL funcional / Migraciones modificadas:** 0
- **Sentencias DDL / RLS / Constraints / Índices:** 0
- **Sentencias `INSERT`, `UPDATE`, `DELETE`:** 0
- **Datos de producción alterados:** 0
- **Sesiones o compras modificadas:** 0

**Integridad de Producción:** **100% PRESERVADA — CERO MUTACIONES.**

---

## 15. CONCLUSIONES FORENSES DE LA FASE C.2

1. **FC-003 queda demostrado con exactitud matemática irrefutable:**  
   El Dashboard de Titan Grill castiga indebidamente la Utilidad Bruta del restaurante en **$11,541.00 COP** debido a que consulta movimientos `VENTA` sin restar `ANULACION_VENTA` ni filtrar ventas anuladas.
2. **Se demuestra el nuevo hallazgo `C2-NEW-001` (Consumo Fantasma de 6.0 Tomates):**  
   Las 15 ventas reales de `Titán burger` en producción omitieron silenciosamente el descuento de **6.0 unidades de Tomate** debido al filtro `AND i.activo = true` en `registrar_venta`.
3. **Se confirma el origen del movimiento `7c402a48` (`FC1-NEW-003`):**  
   El registro de 271 lechugas fue generado desde el modal de ajuste manual de UI en `AdminDashboard.jsx`, donde el usuario seleccionó `tipo = ENTRADA` y escribió el texto libre `'compra'`, sin egreso de caja ni orden de compra asociada.

---

**ESTADO FINAL DE FASE C.2:** ✅ **AUDITORÍA FORENSE CRUZADA COMPLETADA Y RECONCILIADA.**  
**CÓDIGO MODIFICADO: 0. SQL FUNCIONAL MODIFICADO: 0. DATOS DE PRODUCCIÓN MODIFICADOS: 0.**  
**SE DETIENE LA EJECUCIÓN A LA ESPERA DE INSTRUCCIONES.**
