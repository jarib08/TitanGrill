# FASE C — AUDITORÍA FORENSE DE INVENTARIO + COMPRAS
**Titan Grill — Sistema Operativo Gastronómico**  
**Fecha de Ejecución:** 24 de Septiembre de 2026  
**Tipo de Auditoría:** AUDITORÍA FORENSE READ-ONLY — CERO MODIFICACIONES EN PRODUCCIÓN  
**Entorno Verificado:** Supabase PostgreSQL 17.6.1 Live Production (`mbyjehhplruoqlgphfvw`) + Vite 7 (React 19)  
**Documentos Predecesores:** [FASE_A_AUDITORIA_POS.md](file:///e:/Documents/titan_grill/FASE_A_AUDITORIA_POS.md), [FASE_B_AUDITORIA_MOTOR_CAJA.md](file:///e:/Documents/titan_grill/FASE_B_AUDITORIA_MOTOR_CAJA.md), [FASE_B1_VALIDACION_HALLAZGOS_CRITICOS.md](file:///e:/Documents/titan_grill/FASE_B1_VALIDACION_HALLAZGOS_CRITICOS.md)  
**Marco Normativo Canónico:** [TITAN_GRILL_FUENTE_DE_VERDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_FUENTE_DE_VERDAD.md), [TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md](file:///e:/Documents/titan_grill/TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md), [TITAN_GRILL_MATRIZ_INTEGRIDAD.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_INTEGRIDAD.md), [TITAN_GRILL_INVARIANTES_FINANCIERAS.md](file:///e:/Documents/titan_grill/TITAN_GRILL_INVARIANTES_FINANCIERAS.md), [TITAN_GRILL_MATRIZ_RPC.md](file:///e:/Documents/titan_grill/TITAN_GRILL_MATRIZ_RPC.md)

---

## 1. ALCANCE

La presente auditoría **FASE C** examina de manera exhaustiva, forense y no destructiva el subsistema completo de **Inventario y Compras** de Titan Grill, cubriendo el ciclo de vida íntegro de la materia prima y los productos:
$$\text{PROVEEDOR} \to \text{COMPRA} \to \text{RECEPCIÓN} \to \text{INVENTARIO} \to \text{COSTO} \to \text{CAJA} \to \text{VENTA} \to \text{CONSUMO (RECETA)} \to \text{COGS} \to \text{ANULACIÓN} \to \text{RENTABILIDAD}$$

### Restricciones operativas observadas
- **Modo 100% Solo Lectura:** Cero modificaciones de código fuente, cero sentencias DDL/DML (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`), cero ejecuciones de RPC que alteren estado.
- **Entorno real verificado:** Base de datos activa de producción con 969 registros de movimientos de inventario, 51 insumos, 13 productos, 42 relaciones de recetas, 1 compra histórica con 3 detalles y 99 ventas registradas.
- **Ninguna corrección prematura:** Los hallazgos previos (FB-001, FB-002, FB-003) se mantuvieron intactos sin parches.

---

## 2. METODOLOGÍA

La investigación forense se sustentó en la triangulación estricta de cuatro capas:
1. **Inspección de Esquema y Motores PL/pgSQL:** Extracción y análisis de las definiciones oficiales de tablas, columnas, constraints, índices, triggers y funciones RPC en `pg_proc` (`recibir_compra`, `anular_compra`, `registrar_carga_masiva_inventario`, `registrar_merma_trabajador`, `registrar_venta`, `anular_venta_directa`, `ejecutar_anulacion_venta`).
2. **Inspección de Código Frontend React 19:** Rastreo de flujos de carga, renderizado, cálculo de métricas de COGS, rentabilidad y llamadas de API en [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx) y [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx).
3. **Auditoría de Datos Reales de Producción:** Consultas agregadas SQL exclusivamente de lectura (`SELECT`) para cotejar sumatorias de kardex, trazabilidad de costos, registros de compra y movimientos compensatorios.
4. **Clasificación Documental:**
   - **Canónicos:** Documentos normativos vigentes que rigen el negocio (`TITAN_GRILL_FUENTE_DE_VERDAD.md`, `TITAN_GRILL_PLAN_MAESTRO_AUDITORIA.md`, etc.).
   - **Históricos:** Documentos de fases previas, dry-runs y pre-importaciones (`costos_recetas_pre_implementation_audit.md`, `auditoria_mejora_inventario_insumos.md`, etc.).
   - **Auxiliares:** Instrucciones de ejecución y guías de prompts (`newpromt.md`, `AGENTS.md`).

---

## 3. ARQUITECTURA REAL DEL SUBSISTEMA

El subsistema de inventario y compras se apoya en 8 tablas relacionales del esquema `public`:

```
┌──────────────┐          ┌───────────────────────┐          ┌──────────────┐
│  proveedores │─────────<│        compras        │─────────<│compra_detalles│
└──────────────┘          └───────────────────────┘          └──────────────┘
                                      │                             │
                                      │ (recibir_compra)            │ (insumo_id)
                                      ▼                             ▼
┌──────────────┐          ┌───────────────────────┐          ┌──────────────┐
│movimientos_  │<─────────│       insumos         │─────────<│producto_     │
│inventario    │          │  (stock_actual col)   │          │insumos       │
└──────────────┘          └───────────────────────┘          └──────────────┘
        │                             ▲                             ▲
        │ (anulacion_venta)           │ (descuento)                 │ (receta)
        ▼                             │                             │
┌──────────────┐                      │                      ┌──────────────┐
│    ventas    │──────────────────────┴──────────────────────│  productos   │
└──────────────┘                                             └──────────────┘
```

### Ficha Técnica de Entidades

| Tabla | PK | FK Clave | Columnas Relevantes | Constraints Críticos | RLS / Políticas | RPCs Escritoras |
|---|---|---|---|---|---|---|
| `insumos` | `id` (UUID) | N/A | `nombre`, `unidad_medida`, `stock_actual`, `stock_minimo`, `costo_unitario`, `activo` | `CHECK (stock_actual >= 0)`, `CHECK (stock_minimo >= 0)` | SELECT: `worker`, ALL: `socio` | `recibir_compra`, `anular_compra`, `registrar_venta`, `anular_venta_directa`, `ejecutar_anulacion_venta`, `registrar_merma_trabajador`, `registrar_carga_masiva_inventario`, UI (`handleGuardarAjuste`, `handleSaveInsumo`) |
| `productos` | `id` (UUID) | N/A | `nombre`, `precio`, `categoria`, `activo`, `requiere_inventario`, `orden` | `CHECK (precio >= 0)` | SELECT: `public` y `worker`, ALL: `socio` | UI Admin |
| `producto_insumos` | `id` (UUID) | `producto_id` → `productos`, `insumo_id` → `insumos` | `cantidad_por_unidad` | `UNIQUE(producto_id, insumo_id)`, `CHECK (cantidad_por_unidad > 0)` | SELECT: `worker`, ALL: `socio` | UI Admin (`handleSaveReceta`, delete, update) |
| `movimientos_inventario` | `id` (UUID) | `insumo_id` → `insumos`, `usuario_id` → `perfiles_trabajadores`, `venta_id` → `ventas`, `compra_id` → `compras` | `tipo`, `cantidad`, `motivo`, `created_at` | `CHECK (tipo IN ('ENTRADA', 'VENTA', 'AJUSTE', 'MERMA', 'ENTRADA_COMPRA', 'ANULACION_VENTA'))` | SELECT: `worker`, INSERT: `socio` | `recibir_compra`, `anular_compra`, `registrar_venta`, `anular_venta_directa`, `ejecutar_anulacion_venta`, `registrar_merma_trabajador`, `registrar_carga_masiva_inventario`, UI (`handleGuardarAjuste`) |
| `proveedores` | `id` (UUID) | N/A | `nombre`, `telefono`, `contacto`, `activo` | N/A | SELECT: `worker`, ALL: `socio` | UI Admin |
| `compras` | `id` (UUID) | `proveedor_id` → `proveedores`, `usuario_id` → `perfiles_trabajadores` | `fecha`, `total`, `estado`, `metodo_pago`, `observaciones` | `CHECK (estado IN ('BORRADOR', 'RECIBIDA', 'ANULADA'))`, `CHECK (total >= 0)` | SELECT: `worker`, ALL: `socio` | `recibir_compra`, `anular_compra`, UI Admin |
| `compra_detalles` | `id` (UUID) | `compra_id` → `compras` (CASCADE), `insumo_id` → `insumos` | `cantidad`, `costo_unitario`, `subtotal`, `precio_total_pagado`, `contenido_comprado`, `unidad_compra` | `CHECK (cantidad > 0)`, `CHECK (costo_unitario >= 0)`, `CHECK (subtotal >= 0)` | SELECT: `worker`, ALL: `socio` | UI Admin (al guardar borrador de compra) |
| `costos_configuracion` | `id` (UUID) | `creado_por` → `perfiles_trabajadores` | `nombre`, `tipo_costo`, `categoria`, `monto`, `periodicidad`, `activo` | N/A | SELECT: `worker`, ALL: `socio` | UI Admin |

---

## 4. MODELO REAL DE STOCK

### Demostración: ¿Almacenado o Calculado?
**EL STOCK ESTÁ FÍSICAMENTE ALMACENADO Y NO CALCULADO DINÁMICAMENTE.**  
- La tabla `insumos` posee la columna mutable `stock_actual NUMERIC NOT NULL DEFAULT 0`.
- Todas las transacciones operativas ejecutan sentencias directas de mutación:
  $$\text{UPDATE public.insumos SET stock_actual = stock_actual } \pm \Delta$$
- La tabla `movimientos_inventario` funciona exclusivamente como una bitácora auditiva paralela (log de auditoría), pero **ninguna consulta del POS ni de las RPCs calcula el stock leyendo `SUM(cantidad) FROM movimientos_inventario`**.

### Fórmula de Mutación Real en Código
$$\text{Stock Actual}_{\text{nuevo}} = \text{Stock Actual}_{\text{anterior}} + \text{ENTRADA\_COMPRA} + \text{ANULACION\_VENTA} - \text{VENTA} - \text{MERMA} \pm \text{AJUSTE}$$

### Tratamiento por Tipo de Movimiento en Base de Datos

| Tipo | Origen | Signo en `movimientos_inventario.cantidad` | Operación sobre `insumos.stock_actual` |
|---|---|---|---|
| `ENTRADA_COMPRA` | `recibir_compra` | **Positivo (+)** | `stock_actual = stock_actual + cantidad` |
| `VENTA` | `registrar_venta` | **Negativo (-)** | `stock_actual = stock_actual - required` |
| `ANULACION_VENTA` | `anular_venta_directa` / `ejecutar_anulacion_venta` | **Positivo (+)** | `stock_actual = stock_actual - (-cantidad)` (Suma) |
| `MERMA` | `registrar_merma_trabajador` o `anular_compra` | **Negativo (-)** | `stock_actual = stock_actual - merma` |
| `AJUSTE` | `registrar_carga_masiva_inventario` o UI | **Positivo o Negativo** | `stock_actual = nuevo_stock` |
| `ENTRADA` | UI modal ajuste | **Positivo (+)** | `stock_actual = stock_actual + cantidad` |

---

## 5. PRODUCTOS E INSUMOS

### 5.1 Catálogo y Diferenciación Estructural
- **Insumo (`insumos`):** Materia prima o consumible no vendible directamente al público en el menú (ej. carne, ripia, pan, servilletas). Maneja `stock_actual`, `stock_minimo`, `costo_unitario` y `unidad_medida`.
- **Producto (`productos`):** Ítem vendible que aparece en el catálogo del POS y Menú Digital con un `precio` de venta. No almacena stock directamente. Su disponibilidad depende de los insumos de su receta.

### 5.2 Comportamiento de `requiere_inventario`
- **`requiere_inventario = TRUE`:**
  - El producto **exige obligatoriamente** tener una receta activa configurada en `producto_insumos`. Si no la tiene, `registrar_venta` aborta con el mensaje:
    `'Venta denegada: El producto "X" requiere inventario pero no tiene una receta configurada.'`
  - Requiere existencia física suficiente de cada insumo activo de su receta. Si `stock_actual < cantidad_requerida`, aborta con:
    `'Stock insuficiente para completar la venta. Insumo: ...'`
  - Descuenta inventario registrando filas de tipo `'VENTA'` en `movimientos_inventario`.
  - Impacta el COGS en el Dashboard.
- **`requiere_inventario = FALSE`:**
  - El producto no requiere receta ni stock.
  - La venta se procesa limpiamente sin validar insumos ni insertar registros en `movimientos_inventario`.
  - Ejemplo real en producción: `Vaso de gaseosa ` (`9a0c464c-b41b-44ee-a8b7-eab249a37ecb`), precio $1,000, 6 ventas históricas, 0 movimientos de inventario generados.

### 5.3 Regla Crítica de Insumos Inactivos en Recetas
En [registrar_venta](file:///e:/Documents/titan_grill/src/components/POS.jsx), el filtrado de receta establece:
```sql
WHERE pi.producto_id = v_producto_id AND i.activo = true
```
**Efecto:** Si un insumo es marcado `activo = false` en la tabla `insumos`, el sistema lo ignora durante la venta:
- No valida su stock.
- No descuenta su stock.
- No genera registro en `movimientos_inventario`.
- Caso real detectado: `Titán burger` incluye 12 insumos en su ficha técnica, pero el insumo `Tomate` (`8499a4c1`, stock: 0) está marcado `activo = false`. Las ventas de Titán Burger se completan sin descontar tomate ni verificar disponibilidad de tomate.

---

## 6. RECETAS Y CONSUMO POR VENTA

### 6.1 Fórmula Matemática de Consumo
En `registrar_venta`, por cada producto vendido dentro del arreglo `p_detalles->'items'`:
$$\text{Consumo Insumo} = \text{cantidad\_por\_unidad (de receta)} \times \text{cantidad vendida}$$

### 6.2 Unidades y Conversiones
No existe en la base de datos una tabla ni función de conversión de unidades dinámica en tiempo de venta. Las cantidades en `producto_insumos.cantidad_por_unidad` deben estar expresadas **en la misma unidad de medida base del insumo**:
- Si el insumo está en `gramo`, la receta indica gramos (ej. Ripia: 10 g).
- Si el insumo está en `unidad`, la receta indica unidades (ej. Pan: 1 ud).
- Si el insumo está en `porción`, la receta indica porciones (ej. Salsa: 1 porción).

### 6.3 Comportamiento ante Ventas Múltiples y Agrupadas
Si una venta contiene múltiples ítems del mismo producto o distintos productos que comparten insumos:
- `registrar_venta` itera producto por producto en el JSONB.
- Se genera un registro independiente en `movimientos_inventario` por cada par (producto vendido, insumo de receta).
- Si una venta incluye 2 Burger Classic, se descuenta 2 × cantidad_receta en una sola pasada para ese insumo.

---

## 7. MOVIMIENTOS DE INVENTARIO (`movimientos_inventario`)

### 7.1 Censo Total de la Base de Datos en Producción
A la fecha de corte, la tabla `movimientos_inventario` alberga **969 registros**, clasificados con exactitud matemática:

| Tipo de Movimiento | Total Registros | Rango Cantidad | Signo | Documento Origen | RPC / Módulo Generador | Afecta Stock | Afecta COGS Dashboard |
|---|---|---|---|---|---|---|---|
| `VENTA` | 896 | -0.2 a -300 | Negativo (-) | `venta_id` | `registrar_venta` | Sí (Resta) | Sí |
| `AJUSTE` | 47 | +1 a +3,281 | Positivo (+) | `usuario_id` | `registrar_carga_masiva_inventario` / UI | Sí (Suma) | No |
| `ANULACION_VENTA` | 18 | +1 a +15 | Positivo (+) | `venta_id` | `anular_venta_directa` / `ejecutar_anulacion_venta` | Sí (Suma) | No (Omisión) |
| `ENTRADA` | 5 | +12 a +271 | Positivo (+) | `usuario_id` | UI modal ajuste directo | Sí (Suma) | No |
| `ENTRADA_COMPRA` | 3 | +6 a +1,000 | Positivo (+) | `compra_id` | `recibir_compra` | Sí (Suma) | No |
| `MERMA` | 0 | N/A | Negativo (-) | N/A | `registrar_merma_trabajador` | Sí (Resta) | No |
| **TOTAL** | **969** | | | | | | |

### 7.2 Anomalías y Hallazgos en Movimientos
1. **Entradas manuales sin orden de compra:**
   - Registro `7c402a48-089b-47ff-9745-ab6f74517332`: `tipo = 'ENTRADA'`, `cantidad = 271`, `motivo = 'compra'`, `compra_id = NULL` (Insumo: Lechuga Crespa). Ingresó mercancía física al sistema declarando ser "compra" sin registrar orden de compra, sin proveedor, sin costo y sin egreso financiero en caja.
   - 4 registros con `motivo = 'Ajuste manual del socio'` clasificados como `tipo = 'ENTRADA'`.
2. **Ausencia total de columna de costo en el Kardex:**
   - La tabla `movimientos_inventario` carece de columnas `costo_unitario` y `costo_total`. Ningún movimiento histórico conserva el costo con el que fue ejecutado.

---

## 8. COMPRAS

### 8.1 Ciclo de Vida y Estados Oficiales
Las compras sólo admiten 3 estados validados por el constraint `compras_estado_check`:
$$\text{BORRADOR} \xrightarrow{\text{recibir\_compra}} \text{RECIBIDA} \xrightarrow{\text{anular\_compra}} \text{ANULADA}$$
- No existen estados `PENDIENTE`, `PAGADA` ni `PARCIAL`.
- La compra nace en `BORRADOR` sin afectar inventario ni caja.

### 8.2 Recepción (`recibir_compra`)
La recepción de compra ejecuta tres acciones en un único bloque atómico:
1. Cambia `compras.estado` a `'RECIBIDA'`.
2. Inserta un `EGRESO` en `movimientos_caja` por el total de la compra.
3. Actualiza `insumos.stock_actual = stock_actual + cantidad`, sobreescribe `insumos.costo_unitario = costo_compra`, e inserta filas `'ENTRADA_COMPRA'` en `movimientos_inventario`.

---

## 9. PROFUNDIZACIÓN FORENSE DEL HALLAZGO FB-002

### 9.1 Evidencia del Caso Real en Producción
- **Compra:** `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597`
- **Proveedor:** Chalo (`10cfb20d-dd8f-4fb6-9af8-ef0723c1ee3c`)
- **Ejecutado por:** Socio Administrador (`6731b487-c90f-43d5-8118-c688c6ca00b4`)
- **Fecha y Hora:** `2026-09-08 16:24:17.938768 UTC`
- **Total:** $38,650 COP | **Método:** BANCOLOMBIA | **Estado:** `RECIBIDA`

### 9.2 Respuestas Taxativas al Cuestionario Forense de la Fase 7

1. **¿La compra fue recibida?**  
   **SÍ.** Estado `'RECIBIDA'` confirmado en base de datos.
2. **¿El inventario aumentó?**  
   **SÍ.** Se incrementó `stock_actual` en la tabla `insumos` para los 3 insumos.
3. **¿Qué cantidades ingresaron?**  
   - Ripia (`a8223170`): +1,000 gramos
   - Pan Hamburguesa Artesanal (`73548bdb`): +6 unidades
   - Pan Perro Artesanal (`ca988a6d`): +15 unidades
4. **¿Qué costos fueron registrados?**  
   - En `compra_detalles`: Ripia a $11.50/g ($11,500), Pan Burger a $1,400/u ($8,400), Pan Perro a $1,250/u ($18,750). Suma: $38,650 COP.
   - En `insumos.costo_unitario`: Se sobreescribieron a $11.50, $1,400 y $1,250 respectivamente.
   - En `movimientos_inventario`: **$0 / Ninguno** (la tabla no tiene columna de costo).
5. **¿La compra está pagada?**  
   **SÍ en tesorería global.** El RPC generó el movimiento de caja `d6f798e9-6b55-4a57-986c-ec58ab5febe8` de tipo `EGRESO` por $38,650.
6. **¿Existe una deuda pendiente?**  
   **NO.** No hay saldo por pagar registrado.
7. **¿Existe algún pago posterior?**  
   **NO.** Único movimiento registrado para esta compra.
8. **¿Existe riesgo de doble pago?**  
   A nivel de RPC `recibir_compra`, no (bloquea estados distintos de `BORRADOR`). Sin embargo, como el cajero no ve el egreso en su arqueo de turno, existe riesgo operativo de que se registre un gasto manual duplicado para "justificar" la compra.
9. **¿Existe riesgo de doble entrada de inventario?**  
   No por re-ejecución del RPC, pero sí mediante el uso de la pantalla de Carga Masiva o Ajuste Manual si el usuario intenta sincronizar manualmente.
10. **¿El costo usado por inventario coincide con el valor financiero?**  
    Coincidió en el momento de la recepción ($38,650). No obstante, el valor remanente de inventario se desvirtuó posteriormente al consumirse unidades en ventas sin registrar el costo de salida.

---

## 10. ANULACIÓN DE COMPRAS (`anular_compra`)

### 10.1 Análisis del Motor PL/pgSQL
Al anular una compra en estado `RECIBIDA`:
```sql
-- Step 4: Validación de stock remanente
IF v_detail.stock_actual < v_detail.cantidad THEN
  RETURN json_build_object('success', false, 'message', 'No es posible anular la compra. Revertir el stock dejaría saldo negativo...');
END IF;
```
1. **Bloqueo por consumo:** Si tan solo una unidad de cualquier insumo de la compra ya fue vendida y el stock actual es menor a lo comprado, **la anulación de la compra es rechazada**.
   - *Caso práctico demostrado:* La compra real `45ed9db2` compró 6 panes de hamburguesa. El stock actual es de 4 unidades. Hoy en día es imposible anular esa compra porque el sistema aborta.
2. **Omisión de sesión en la reversión de caja:** Al generar el `INGRESO` compensatorio, `anular_compra` **tampoco envía `sesion_id`**, insertando un ingreso con `sesion_id = NULL`.
3. **Corrupción semántica en Kardex:** La reversión del stock se inserta con `tipo = 'MERMA'` y cantidad negativa (`-v_detail.cantidad`).
4. **Irreversibilidad del costo unitario:** Al anular la compra, el `costo_unitario` de `insumos` **NO se restaura** a su valor anterior; permanece con el precio de la compra anulada.

---

## 11. COSTOS Y COGS (COSTO DE VENTAS)

### 11.1 Configuración de Costos (`costos_configuracion`)
En producción existen 4 parámetros:
1. `Multiplicador de Precio`: monto 2.0 (factor de markup sugerido).
2. `Impuesto IPC`: monto 1.0 (1% de impuesto).
3. `Nómina preparación eddy`: $100,000 semanal (inactivo).
4. `trabajador1 - Diego`: $40,000 diario (activo).

### 11.2 Demostración Forense de la Fórmula de COGS en el Dashboard
En [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339-L375):
```javascript
// Línea 339:
supabase.from('movimientos_inventario').select('cantidad, insumos(costo_unitario)').eq('tipo', 'VENTA')

// Líneas 370-374:
const totalCogs = (saleMovementsRes.data || []).reduce((sum, m) => {
    const qty = Math.abs(Number(m.cantidad || 0));
    const unitCost = Number(m.insumos?.costo_unitario || 0);
    return sum + (qty * unitCost);
}, 0);
```

### 11.3 Conclusiones Forenses de COGS y Rentabilidad
1. **Recálculo Retroactivo Global (Violación Contable):**  
   Dado que `m.insumos?.costo_unitario` toma el valor actual de la tabla `insumos`, **cuando cambia el precio de compra de un insumo, todas las ventas históricas de toda la existencia del negocio se recalculan al nuevo precio**. No existe costo histórico de venta.
2. **Doble Penalización por Ventas Anuladas:**  
   La consulta filtra exclusivamente `.eq('tipo', 'VENTA')` y no excluye ventas con `estado = 'ANULADA'`.  
   - En producción existen 2 ventas anuladas (`0ea5b67f` y `c207bbb1`).
   - El dashboard restó los $19,980 COP de los ingresos en `totalVentas`.
   - Sin embargo, los 18 movimientos de inventario de esas ventas anuladas siguen siendo sumados a `cogsTotal`.
   - **Impacto real en producción:** El COGS del dashboard está sobreestimado en **$11,541.00 COP**, reduciendo artificialmente la Utilidad Bruta del negocio.

---

## 12. ANULACIÓN DE VENTAS E INVENTARIO

### 12.1 Flujo de Reversión
En `anular_venta_directa` y `ejecutar_anulacion_venta`:
- Se leen los movimientos en `movimientos_inventario` con `tipo = 'VENTA'` para esa venta.
- Se ejecuta `stock_actual = stock_actual - v_inv.cantidad` (lo cual suma stock porque la cantidad original es negativa).
- Se inserta un registro compensatorio de tipo `'ANULACION_VENTA'` con `ABS(v_inv.cantidad)` (positivo).
- Se auditaron las 2 ventas anuladas reales (`0ea5b67f` y `c207bbb1`): ambas presentan una reversión 100% simétrica de insumos en la base de datos (9 salidas y 9 entradas compensatorias cada una).

---

## 13. MERMAS

### 13.1 Mecanismo Oficial (`registrar_merma_trabajador`)
- Valida rol de trabajador (`fn_is_worker()`).
- Exige `p_cantidad > 0` y `p_motivo` obligatorio no vacío.
- Ejecuta bloqueo pesimista: `SELECT stock_actual, activo FROM insumos WHERE id = p_insumo_id FOR UPDATE;`
- Valida que `p_cantidad <= stock_actual`.
- Actualiza `stock_actual = stock_actual - p_cantidad`.
- Inserta en `movimientos_inventario` con `tipo = 'MERMA'` y `cantidad = -p_cantidad`.
- **Impacto financiero:** Registra pérdida física pero **no genera asiento monetario en caja ni en gastos**. La pérdida no aparece reflejada en el Estado de Resultados consolidado.
- En producción existen **0 mermas registradas**.

---

## 14. AJUSTES DE INVENTARIO

### 14.1 Carga Masiva (`registrar_carga_masiva_inventario`)
- Recibe un arreglo de ítems JSONB (`insumo_id`, `nuevo_stock`).
- Calcula `v_delta = v_nuevo_stock - v_current_stock`.
- Si `v_delta != 0`, actualiza `stock_actual = v_nuevo_stock` e inserta en `movimientos_inventario` con `tipo = 'AJUSTE'`.
- **Falla de concurrencia:** No utiliza `FOR UPDATE`. Asigna el stock absoluto directamente (`stock_actual = v_nuevo_stock`), sobreescribiendo cualquier venta que ocurra en paralelo.

### 14.2 Ajuste Manual en Frontend (`handleGuardarAjuste`)
- En [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1318-L1335), la UI ejecuta dos peticiones HTTP desvinculadas:
  1. `supabase.from('insumos').update({ stock_actual: newStock })`
  2. `supabase.from('movimientos_inventario').insert(...)`
- Esta operación no es transaccional ni atómica. Si se interrumpe la red entre ambas llamadas, el stock muta sin dejar registro en el kardex.

---

## 15. CONCURRENCIA DE INVENTARIO

| Escenario de Concurrencia | Mecanismo en Código | Garantía PostgreSQL | Diagnóstico Forense |
|---|---|---|---|
| **1. Dos ventas concurrentes del mismo producto** | `registrar_venta` lee stock en Paso 4 sin `FOR UPDATE`. Paso 7 descuenta atómicamente. | Constraint `insumos_stock_actual_check` (`stock_actual >= 0`). | Si ambas agotan el stock, la segunda venta aborta con un error de base de datos no capturado en vez de un mensaje controlado. |
| **2. Venta concurrente con recepción de compra** | Operaciones aritméticas relativas (`stock_actual = stock_actual +/- delta`). | Bloqueo a nivel de fila (`RowExclusiveLock`) durante el `UPDATE`. | No hay pérdida de unidades físicas (lost update prevenida). El costo del insumo muta de inmediato. |
| **3. Venta concurrente con merma** | Merma usa `FOR UPDATE`; venta no usa `FOR UPDATE` en lectura. | Atomicidad en commit. | Si la merma agota el insumo, la venta falla por check violation al intentar descontar. |
| **4. Dos ajustes simultáneos de carga masiva** | Asignación absoluta (`stock_actual = v_nuevo_stock`). | Ninguna sobre valores intermedios. | **Grave:** La última transacción sobreescribe y destruye el stock de la anterior. |
| **5. Dos recepciones simultáneas de la misma compra** | `recibir_compra` lee `estado` sin `FOR UPDATE`. | Ninguna previa al UPDATE. | **Riesgo Crítico:** Si dos clics coinciden en milisegundos, ambas ven `BORRADOR` e ingresan doble stock y doble egreso de caja. |
| **6. Anulación concurrente con venta** | Anulación bloquea `ventas` con `FOR UPDATE`. | Aislamiento transaccional en `ventas`. | Operación segura. |
| **7. Dos anulaciones simultáneas de la misma compra** | `anular_compra` lee `estado` sin `FOR UPDATE`. | Ninguna previa al UPDATE. | **Riesgo Crítico:** Posible doble reversión de stock y doble ingreso de dinero. |
| **8. Timeout de red en venta** | Cliente reintenta con `idempotency_key`. | Índice UNIQUE en `ventas.idempotency_key`. | Idempotencia garantizada: recupera la venta sin descontar inventario dos veces. |
| **9. Reintento de recepción de compra** | Verificación `IF estado != 'BORRADOR'`. | Lógica PL/pgSQL secuencial. | Seguro en reintentos secuenciales; vulnerable en reintentos perfectamente concurrentes. |

---

## 16. INTEGRIDAD REFERENCIAL Y RECONCILIACIÓN FÍSICA

### 16.1 Verificación de Huérfanos en Producción (Cero Violaciones)
Se ejecutaron consultas forenses cruzadas sobre el 100% de la base de datos:
- `movimientos_inventario` huérfanos de insumo: **0**
- `movimientos_inventario` huérfanos de usuario: **0**
- `movimientos_inventario` huérfanos de venta: **0**
- `movimientos_inventario` huérfanos de compra: **0**
- `compra_detalles` huérfanos de compra o insumo: **0**
- `producto_insumos` huérfanos de producto o insumo: **0**
- Insumos con stock negativo en producción: **0**

### 16.2 Reconciliación: `stock_actual` vs $\sum \text{movimientos\_inventario}$
De los 51 insumos existentes, **49 insumos presentan una coincidencia matemática perfecta (discrepancia = 0)**.  
Se identificaron exactamente **2 discrepancias históricas**:
1. **Palillo burger (`8a8e5367-5065-494f-829b-b5197ec0009f`):**
   - Stock almacenado en `insumos.stock_actual`: **36 unidades**
   - Suma acumulada de `movimientos_inventario`: **-53 unidades** (27 ventas registradas, 0 cargas iniciales)
   - **Discrepancia:** **+89 unidades**. El stock inicial fue inyectado directamente en la tabla sin registrar fila en el Kardex.
2. **Pan Hamburguesa Artesanal (`73548bdb-f31e-43eb-840e-d262daf64024`):**
   - Stock almacenado en `insumos.stock_actual`: **4 unidades**
   - Suma acumulada de `movimientos_inventario`: **-1 unidad**
   - **Discrepancia:** **+5 unidades**. Modificación manual directa documentada en la auditoría previa sin asiento de kardex.

---

## 17. MATRIZ DE DOBLE CONTABILIZACIÓN

| Evento | Movimiento Inventario | Movimiento Caja | Dashboard Egresos / Gastos | Dashboard COGS | Riesgo de Doble Conteo | Diagnóstico |
|---|---|---|---|---|---|---|
| **Recepción de Compra** | `ENTRADA_COMPRA` (+cant) | `EGRESO` (-total, `sesion_id=NULL`) | Excluido de Gastos Op. (filtra `!m.compra_id`) | No computa de inmediato | Ninguno directo | El dinero sale en flujo de caja global, y el gasto se difiere a COGS según se venda el producto. |
| **Venta** | `VENTA` (-cant) | `INGRESO` (+total) | No aplica | Suma al COGS | Ninguno | Correcto. |
| **Anulación de Venta** | `ANULACION_VENTA` (+cant) | `EGRESO` (-total) | No aplica | **Ignora la anulación** | **DOBLE PENALIZACIÓN** | Se resta el ingreso de ventas, pero NO se descuenta el costo de los insumos reintegrados. |
| **Merma de Insumo** | `MERMA` (-cant) | Ninguno | No figura en gastos | No figura en COGS | Pérdida oculta | La pérdida física no impacta los estados financieros. |
| **Anulación de Compra** | `MERMA` (-cant) | `INGRESO` (+total, `sesion_id=NULL`) | No aplica | No aplica | Confusión de Kardex | Reingresa dinero a saldo global, pero ensucia la métrica de mermas. |

---

## 18. EVALUACIÓN DE INVARIANTES FINANCIERAS

| Invariante | Estado | Justificación Técnica Forense |
|---|---|---|
| **Venta válida ↔ Salida de inventario correspondiente** | 🟢 **VERIFICADA** | Cumplida para todo producto con `requiere_inventario = true` y receta activa. |
| **Venta anulada ↔ Reversión de inventario** | 🟡 **PARCIALMENTE VERIFICADA** | Físicamente revierte el stock con simetría en base de datos. Financieramente penaliza el COGS en el Dashboard por omisión en el cálculo frontend. |
| **Compra pagada ↔ Entrada inventario y egreso en caja** | 🔴 **VIOLADA (FB-002)** | Ingresa stock y genera egreso, pero el egreso tiene `sesion_id = NULL`, fracturando la reconciliación con el arqueo de turno del cajero. |
| **Anulación de compra ↔ Reversión íntegra** | 🔴 **VIOLADA** | Reingresa el dinero pero con `sesion_id = NULL`; bloquea la anulación si hubo consumo parcial; no restaura el costo unitario previo; y registra la reversión como `MERMA`. |
| **Consistencia del Kardex (Stock = $\sum \text{Movimientos}$)** | 🔴 **VIOLADA** | Demostrada en `Palillo burger` (+89) y `Pan Hamburguesa` (+5) por mutaciones directas de la tabla sin trazabilidad. |
| **Costo Histórico de Ventas (COGS)** | 🔴 **VIOLADA** | El sistema no preserva el costo unitario en el momento de la venta, recalculando retroactivamente todas las ventas cuando varía el precio del insumo. |

---

## 19. EVALUACIÓN DE LA MATRIZ DE INTEGRIDAD

| Módulo Evaluado | Tablas | RPC | Caja | Inventario | Rentabilidad | Riesgo Forense |
|---|---|---|---|---|---|---|
| **Compras** | `compras`, `compra_detalles`, `insumos`, `movimientos_caja`, `movimientos_inventario` | `recibir_compra`, `anular_compra` | 🔴 EGRESO huérfano de sesión | 🟢 ENTRADA | Costo unitario sobreescrito | **CRÍTICO** (Falta de locks pesimistas y egreso aislado de arqueos). |
| **Inventario (Ventas)** | `productos`, `insumos`, `producto_insumos`, `movimientos_inventario` | `registrar_venta` | 🟢 INGRESO | 🔴 DESCUENTO | Afecta Positivo | **ALTO** (Ausencia de `FOR UPDATE` en validación de stock expone a check violation). |
| **Inventario (Ajustes)** | `insumos`, `movimientos_inventario` | `registrar_carga_masiva_inventario`, UI | N/A | +/- AJUSTES | Costos no afectados | **ALTO** (Llamadas desvinculadas en frontend y sobreescritura ciega de stock). |

---

## 20. CLASIFICACIÓN COMPLETA DE HALLAZGOS FORENSES

```
════════════════════════════════════════════════════════════════════════════
RESUMEN DE HALLAZGOS FORENSES DE LA FASE C
════════════════════════════════════════════════════════════════════════════
  TOTAL HALLAZGOS: 10
  ├── CRÍTICO:        3  (30%)
  ├── ALTO:           4  (40%)
  ├── MEDIO:          2  (20%)
  └── BAJO:           1  (10%)
════════════════════════════════════════════════════════════════════════════
```

---

### HALLAZGOS CRÍTICOS (3)

#### [FC-001] Concurrencia y ausencia de bloqueo transaccional (`FOR UPDATE`) en `recibir_compra` y `anular_compra`
- **Severidad:** 🔴 CRÍTICO
- **Defecto Técnico Confirmado:** En las funciones `recibir_compra` y `anular_compra`, la consulta de estado `SELECT estado, total INTO v_estado, v_total FROM public.compras WHERE id = p_compra_id` no utiliza la cláusula `FOR UPDATE`.
- **Evidencia en Código:** PostgreSQL definiciones de `public.recibir_compra` (línea 19) y `public.anular_compra` (línea 19).
- **Impacto Inventario y Financiero:** Ante dos llamadas simultáneas (ej. doble clic en botón de recepción o reintentos concurrentes de red), ambas solicitudes leen `estado = 'BORRADOR'`, ambas incrementan el stock en `insumos` duplicando la mercancía física (+2x), ambas insertan movimientos duplicados en `movimientos_inventario` y ambas generan un doble egreso monetario en `movimientos_caja`.
- **Probabilidad:** Media en condiciones de red móvil o doble clic del operador.

#### [FC-002] Egresos e ingresos de compras desvinculados de las sesiones de caja (`sesion_id = NULL`) — Derivado de FB-002
- **Severidad:** 🔴 CRÍTICO
- **Defecto Técnico Confirmado:** Tanto `recibir_compra` como `anular_compra` insertan movimientos en `movimientos_caja` omitiendo explícitamente la columna `sesion_id`.
- **Evidencia en Producción:** Compra real `45ed9db2-33d3-4f5e-b49e-9a0d31cd6597`, movimiento de caja `d6f798e9-6b55-4a57-986c-ec58ab5febe8` de tipo `EGRESO` por $38,650 COP con `sesion_id = NULL`.
- **Impacto Caja y Arqueo:** El egreso se resta del Saldo Global de Bancolombia, pero es **completamente invisible para la función `cerrar_caja`**. Si un pago se realiza en EFECTIVO desde la gaveta del puesto, el arqueo del cajero acusará un descuadre injustificado de dinero. Existe una brecha contable permanente de $38,650 COP entre arqueos de turnos y saldo bancario.
- **Probabilidad:** 100% garantizada en cada compra procesada.

#### [FC-003] Distorsión de COGS y Utilidad Bruta en `AdminDashboard.jsx` por omisión de `ANULACION_VENTA`
- **Severidad:** 🔴 CRÍTICO
- **Defecto Técnico Confirmado:** La función de cálculo de COGS en [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L339) filtra exclusivamente `movimientos_inventario` con `tipo = 'VENTA'`. No excluye los movimientos asociados a ventas con `estado = 'ANULADA'`, ni resta los registros de tipo `'ANULACION_VENTA'`.
- **Evidencia con Datos Reales:** Las ventas `0ea5b67f` y `c207bbb1` ($19,980 COP) fueron anuladas y excluidas de los ingresos brutos, pero sus 18 registros de consumo de insumos en `movimientos_inventario` siguen sumándose a `cogsTotal`, inflando artificialmente el costo en **$11,541.00 COP** y castigando indebidamente la Utilidad Bruta del restaurante.
- **Probabilidad:** 100% activa en la vista de Dashboard.

---

### HALLAZGOS ALTOS (4)

#### [FC-004] Recálculo retroactivo de costos históricos de venta (COGS) por mutación en `insumos`
- **Severidad:** 🟠 ALTO
- **Defecto Técnico Confirmado:** La tabla `movimientos_inventario` no almacena el costo unitario al momento del despacho. El dashboard calcula el COGS multiplicando la cantidad histórica por el `insumos.costo_unitario` actual.
- **Impacto Rentabilidad:** Cuando un insumo sube de precio en una compra posterior, **todas las ventas de meses anteriores aumentan su costo retrospectivamente**, desvirtuando los márgenes históricos reales del negocio.

#### [FC-005] Actualización manual de inventario en Frontend no transaccional ni atómica
- **Severidad:** 🟠 ALTO
- **Defecto Técnico Confirmado:** En [AdminDashboard.jsx](file:///e:/Documents/titan_grill/src/components/AdminDashboard.jsx#L1318-L1335) (`handleGuardarAjuste`), el ajuste se realiza mediante dos llamadas cliente-servidor desvinculadas (`supabase.from('insumos').update` y `supabase.from('movimientos_inventario').insert`).
- **Impacto:** Si la segunda llamada falla, el stock muta sin registro en el kardex. Además, la lectura previa de `insumo.stock_actual` en React es propensa a condiciones de carrera que sobreescriben ventas simultáneas.

#### [FC-006] Desacoplamiento entre `insumos.stock_actual` y $\sum \text{movimientos\_inventario}$
- **Severidad:** 🟠 ALTO
- **Anomalía Histórica Confirmada:** 2 de 51 insumos presentan discrepancias entre el stock almacenado y la sumatoria de movimientos (`Palillo burger`: +89 de descuadre; `Pan Hamburguesa`: +5 de descuadre). Esto demuestra que el sistema permitió cargas de stock directas sin generar registros de auditoría en el kardex.

#### [FC-007] `anular_compra` clasifica reversiones de compra como `'MERMA'` y no restaura el costo previo
- **Severidad:** 🟠 ALTO
- **Defecto Técnico Confirmado:** En `anular_compra` (línea 86), la reversión de inventario se inserta como `tipo = 'MERMA'` con cantidad negativa. Además, no se restituye el `costo_unitario` que el insumo tenía antes de la compra, dejando el costo inflado a pesar de haberse cancelado la operación.

---

### HALLAZGOS MEDIOS (2)

#### [FC-008] Inexistencia de índices en Foreign Keys de `movimientos_inventario` y `compra_detalles`
- **Severidad:** 🟡 MEDIO
- **Riesgo Potencial:** `movimientos_inventario` carece de índices en `insumo_id`, `venta_id`, `compra_id`, `tipo` y `created_at`. Al crecer la tabla, las consultas agregadas del dashboard realizarán escaneos secuenciales completos (`Seq Scan`), degradando el tiempo de carga del sistema.

#### [FC-009] Pre-validación de stock en `registrar_venta` sin bloqueo pesimista
- **Severidad:** 🟡 MEDIO
- **Defecto Técnico Confirmado:** El Paso 4 de `registrar_venta` consulta el stock sin `FOR UPDATE`. Si dos terminales venden la última unidad en el mismo milisegundo, la segunda fallará con una excepción no capturada del constraint `insumos_stock_actual_check` en lugar de una respuesta limpia en JSON.

---

### HALLAZGOS BAJOS (1)

#### [FC-010] El POS no consulta ni visualiza el stock disponible de los productos
- **Severidad:** 🟢 BAJO
- **Hallazgo de UX/Operativa:** [POS.jsx](file:///e:/Documents/titan_grill/src/components/POS.jsx#L85-L88) no consulta `stock_actual` ni recetas de los productos. El cajero solo recibe retroalimentación de agotamiento cuando el servidor rechaza la transacción tras presionar el botón de cobro.

---

## 21. PRUEBAS NO VERIFICADAS

1. **Impacto de concurrencia en producción con más de 10 usuarios simultáneos:** No verificada debido a la restricción absoluta de realizar pruebas de carga que alteren o estresen la base de datos de producción.
2. **Comportamiento en UI de recepción de compra en EFECTIVO sobre caja cerrada:** No ejecutada en vivo para no alterar los saldos reales de caja ni crear movimientos artificiales.

---

## 22. RECOMENDACIONES TÉCNICAS ESTRUCTURALES (PARA FASE POSTERIOR DE CORRECCIÓN)

> [!IMPORTANT]
> Estas recomendaciones son exclusivamente arquitectónicas para la futura fase de correcciones y **NO deben implementarse durante esta fase de auditoría**.

1. **Resolver FB-002 y FC-002:** Agregar parámetro opcional `p_sesion_id` a `recibir_compra` y `anular_compra`. Si el pago es en EFECTIVO, exigir obligatoriamente una sesión abierta para deducir el egreso del arqueo de turno; si es cuenta bancaria institucional de socios, registrarlo con bandera explícita de `CUENTA_BANCARIA_CENTRAL` para que el arqueo de turno del trabajador no lo descuente.
2. **Corregir Fórmula de COGS en Dashboard (FC-003):** Modificar la consulta y agregación en `AdminDashboard.jsx` para que el COGS descuente los registros con `tipo = 'ANULACION_VENTA'` y excluya los movimientos pertenecientes a ventas anuladas.
3. **Persistir Costo en el Kardex (FC-004):** Agregar columnas `costo_unitario` y `costo_total` en la tabla `movimientos_inventario` para que cada salida conserve congelado el costo vigente al momento exacto de la transacción.
4. **Incorporar Locks Pesimistas (`FOR UPDATE`):** Agregar `FOR UPDATE` en `recibir_compra` y `anular_compra` sobre la tabla `compras`, y en `registrar_venta` sobre los insumos de la receta durante la pre-validación.
5. **Reemplazar Ajustes en Frontend por RPC Atómica (FC-005):** Eliminar los updates directos de la tabla `insumos` desde React y canalizar todos los ajustes mediante una función PL/pgSQL transaccional.

---

## 23. EVIDENCIA Y REGISTRO FORENSE

- **Consultas ejecutadas:** 24 consultas SQL de catálogo y datos históricos mediante el protocolo seguro Supabase MCP.
- **Archivos auditados:** `AdminDashboard.jsx` (7,507 líneas), `POS.jsx` (1,899 líneas), `20260912_fase_a_correccion.sql`, definiciones PL/pgSQL en base de datos.
- **Integridad confirmada:** Cero sentencias DML/DDL ejecutadas. Ningún dato modificado.

---

## 24. CONCLUSIÓN DE LA FASE C

El subsistema de inventario de Titan Grill cuenta con una estructura relacional limpia, sin registros huérfanos y con integridad referencial garantizada por Foreign Keys y Check Constraints en PostgreSQL.  

Sin embargo, la auditoría forense descubrió **3 fallas críticas estructurales**:
1. La falta de transaccionalidad pesimista en compras (`recibir_compra` y `anular_compra`) que expone al sistema a duplicaciones físicas y financieras ante clics concurrentes.
2. La fractura contable entre el módulo de compras y el arqueo de turno originada por el hallazgo **FB-002**, que deja los egresos de compras flotando sin sesión de caja.
3. El error de cálculo en el Dashboard donde el COGS recalcula retrospectivamente la historia del restaurante cada vez que varía un precio de insumo y penaliza indebidamente las ventas anuladas con una distorsión comprobada de **$11,541.00 COP**.

**ESTADO FINAL DE FASE C:** ✅ **AUDITORÍA FORENSE COMPLETADA Y DOCUMENTADA.**  
**CERO CÓDIGO MODIFICADO. CERO DATOS ALTERADOS. SE DETIENE LA EJECUCIÓN A LA ESPERA DE INSTRUCCIONES.**
