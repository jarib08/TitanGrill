# TITAN GRILL — DRY-RUN DE IMPORTACIÓN
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY | **Supabase modificado:** NO

---

## 1. AUDITORÍA DEL SCHEMA REAL DE SUPABASE

### Tabla `insumos`
| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| nombre | text | NO | — |
| unidad_medida | text | NO | 'unidad' |
| stock_actual | numeric | NO | 0 |
| stock_minimo | numeric | NO | 0 |
| activo | boolean | NO | true |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |

**Columnas inexistentes:** `costo_unitario`, `precio_presentacion`, `equivalencia_unidades`

### Tabla `producto_insumos`
| Columna | Tipo | FK |
|---|---|---|
| id | uuid | — |
| producto_id | uuid | → productos.id |
| insumo_id | uuid | → insumos.id |
| cantidad_por_unidad | numeric | — |

### Tabla `compra_detalles`
| Columna | Tipo | FK |
|---|---|---|
| id | uuid | — |
| compra_id | uuid | → compras.id |
| insumo_id | uuid | → insumos.id |
| cantidad | numeric | — |
| **costo_unitario** | numeric | — |
| subtotal | numeric | — |

### Tabla `compras`
| Columna | Tipo | FK |
|---|---|---|
| id | uuid | — |
| proveedor_id | uuid | → proveedores.id |
| usuario_id | uuid | → perfiles_trabajadores.id |
| fecha | timestamptz | — |
| total | numeric | default 0 |
| estado | text | default 'BORRADOR' |

### RPCs relevantes
| Función | Impacto |
|---|---|
| `registrar_venta` | Descuenta inventario vía movimientos_inventario |
| `recibir_compra` | Aumenta stock + crea movimientos_inventario |
| `anular_compra` | Revierte stock |
| `abrir_caja` / `cerrar_caja` | Gestión de sesiones |

### Análisis: ¿Necesitamos `costo_unitario` en `insumos`?

| Opción | Pros | Contras |
|---|---|---|
| **A) Agregar `costo_unitario` a `insumos`** | ✅ Cálculo rápido de margen por receta. ✅ UI muestra costo actual. ✅ `compra_detalles.costo_unitario` ya existe como historial. | ⚠️ Requiere ALTER TABLE. ⚠️ Hay que mantenerlo actualizado con cada compra. |
| **B) NO agregar, calcular desde `compra_detalles`** | ✅ No toca schema. ✅ Siempre usa el precio más reciente. | ❌ Consulta compleja (subconsulta o JOIN). ❌ Sin compras registradas, no hay costo. ❌ UI lenta. |
| **C) Agregar `costo_unitario` + `precio_presentacion` + `equivalencia`** | ✅ Máxima trazabilidad. ✅ Reproduce exactamente la lógica del Excel. | ⚠️ 3 columnas nuevas. ⚠️ `precio_presentacion` y `equivalencia` serán sobrescritas en cada compra. |

**Recomendación: Opción A — Solo `costo_unitario`**

La tabla `compra_detalles` YA tiene `costo_unitario` como historial por compra. No necesitamos duplicar `precio_presentacion` ni `equivalencia` en `insumos`. Basta con:

```sql
ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
```

Flujo: Al registrar compra → `compra_detalles.costo_unitario` = historial → se actualiza `insumos.costo_unitario` = último costo.

---

## 2. EXCEL — RE-LECTURA DIRECTA

### Inventario de hojas

| # | Hoja | Estado real | ¿Fuente válida? |
|---|---|---|---|
| 0 | EQUIVALENCIA | visible | ✅ |
| 1 | burger | visible | ✅ |
| 2 | perro clasicc | visible | ✅ |
| 3 | salchipapa | visible | ✅ |
| 4 | salchip especial | visible | ✅ |
| 5 | CLASSIC-BURGER | ⚠️ oculta* | ❌ EXCLUIDA |
| 6 | TOCI-BURGE | ⚠️ oculta* | ❌ EXCLUIDA |
| 7 | CHICKEN-BURGER | ⚠️ oculta* | ❌ EXCLUIDA |
| 8 | DOBLE-CARNE | ⚠️ oculta* | ❌ EXCLUIDA |
| 9 | COMBO-MINI | ⚠️ oculta* | ❌ EXCLUIDA |
| 10 | PEDIDOS actual | ⚠️ oculta* | ❌ EXCLUIDA |
| 11 | CONTABILIDD | ⚠️ oculta* | ❌ EXCLUIDA |
| 12 | salsas | visible | ✅ |
| 13 | CONTABILID 2026 | visible | 🔵 Referencia |
| 14 | PEDIDOS Enero-Abril | ⚠️ oculta* | ❌ EXCLUIDA |
| 15 | Registro | ⚠️ oculta* | ❌ EXCLUIDA |
| 16 | inventario | visible | ✅ |
| 17 | planeación | visible | ⚪ Referencia |

> [!NOTE]
> *La librería XLSX no preserva el flag `hidden` en lectura. La exclusión de hojas 5-11, 14-15 se confirma por: (1) verificación previa con metadata del workbook, (2) estas hojas contienen recetas históricas/duplicadas/pedidos que no representan el catálogo actual.

### EQUIVALENCIA — 66 elementos, 65 con MATH_OK

**Hallazgo:** Fila 29 `PAPA` presenta `MATH_DIFF`:
- La fila contiene columnas extra: `"800-454"` y `2500` además del precio real `$16.700`
- El valor `pres=800` leído es en realidad un dato adicional; el precio real es `$16.700/2.500g = $6,68/g`
- El `costo_unitario = $6,68` es correcto y es el que usan las recetas
- **Resolución:** Error de lectura por columnas extra. El costo $6,68/g está verificado por coincidencia con `papa bolsa premiun` (f66: $16.700/2.500 = $6,68)

---

## 3. INSUMOS NORMALIZADOS — DRY-RUN

### REUTILIZAR_EXISTENTE (1)

```
Pan Hamburguesa Artesanal
→ REUTILIZAR_EXISTENTE
→ UUID: 73548bdb-f31e-43eb-840e-d262daf64024
→ Nombre actual: "Pan de Hamburguesa" → actualizar a "Pan Hamburguesa Artesanal"
→ unidad: unidad
→ costo_unitario: 1350
→ stock_actual: 9 (dato de prueba, NO tocar)
→ confianza: 🟢 ALTA
```

### CREAR (39 insumos)

| # | Nombre canónico | Unidad | Costo/ud | Fila EQUIV | Recetas | Conf. |
|---|---|---|---|---|---|---|
| 1 | Tocineta | unidad | 736.67 | f4 | burger, salsas | 🟢 |
| 2 | Cebolla Blanca | unidad | 600 | f7 | burger, salsas | 🟢 |
| 3 | Cebolla Roja | unidad | 500 | f8 | salsas | 🟢 |
| 4 | Tomate | unidad | 800 | f9 | burger | 🟢 |
| 5 | Queso Chalo | unidad | 610 | f10 | burger | 🟢 |
| 6 | Orégano en Polvo | gramo | 100 | f14 | burger | 🟢 |
| 7 | Pimienta Negra | gramo | 56 | f15 | burger, salsas | 🟢 |
| 8 | Ajo en Polvo | gramo | 60 | f16 | salsas | 🟢 |
| 9 | Salsa Tomate Grande | gramo | 6.744 | f17 | burger, perro, salchipapa, especial, salsas | 🟢 |
| 10 | Carne Especial | gramo | 16.556 | f19 | burger | 🟢 |
| 11 | Salsa de Carne | mililitro | 16.471 | f23 | burger | 🟢 |
| 12 | Salsa Inglesa | mililitro | 16.471 | f25 | salsas(Bacon) | 🟢 |
| 13 | Mostaza | gramo | 10.612 | f26 | burger, salsas | 🟢 |
| 14 | Aceite Ideal | mililitro | 7.967 | f28 | perro, salchipapa | 🟢 |
| 15 | Papa | gramo | 6.68 | f29+f66 | salchipapa, especial | 🟢 |
| 16 | Cebollín | gramo | 25 | f30 | burger, salsas | 🟢 |
| 17 | Lechuga Crespa | gramo | 19.444 | f31 | burger, especial | 🟢 |
| 18 | Ripia | gramo | 10.40 | f35 | burger, perro, salchipapa, especial | 🟢 |
| 19 | Salsa Piña | gramo | 9.70 | f37 | burger, perro, salchipapa, especial, salsas | 🟢 |
| 20 | Mayoneza | gramo | 14.70 | f38 | salsas | 🟢 |
| 21 | Pechuga de Pollo | gramo | 22.898 | f39 | especial | 🟢 |
| 22 | Paprika | gramo | 53.333 | f41 | salchipapa, especial, salsas | 🟢 |
| 23 | Pan Perro Artesanal | unidad | 1200 | f43 | perro | 🟢 |
| 24 | Salchicha Perro Jumbo | unidad | 1850 | f44 | perro | 🟢 |
| 25 | Chorizo Don Vitto | unidad | 593.75 | f46 | especial | 🟢 |
| 26 | Queso Duro | gramo | 22.20 | f47 | salchipapa, especial | 🟢 |
| 27 | Sal Refisal | gramo | 3 | f48 | salsas | 🟢 |
| 28 | Azúcar | gramo | 2.15 | f49 | salsas | 🟢 |
| 29 | Cabeza de Ajo | unidad | 600 | f50 | burger, salsas | 🟢 |
| 30 | Porción Salsa Acompañamiento | porción | 600 | f51 | burger, perro, salchipapa, especial | 🟡 |
| 31 | Salchicha Manguera | unidad | 2300 | f53 | salchipapa, especial | 🟢 |
| 32 | Maíz (bolsa 1kg) | gramo | 9.40 | f62 | perro | 🟢 |
| 33 | Queso Mozzarella | gramo | 29.50 | f67 | perro | 🟢 |
| 34 | Lechuga Bola | gramo | 4.40 | f68 | salchipapa | 🟢 |
| 35 | Empaque J1 | unidad | 430 | f11 | salchipapa, especial | 🟢 |
| 36 | Bolsa | unidad | 37 | f20 | salchipapa, especial | 🟢 |
| 37 | Servilleta | unidad | 14 | f27 | burger, perro, salchipapa, especial | 🟢 |
| 38 | Papel Envoltorio 29×29 | unidad | 85.50 | f32 | burger, perro | 🟢 |
| 39 | Porta Perro | unidad | 140 | f45 | perro | 🟢 |

### OMITIR (27)

| Fila | Nombre | Razón |
|---|---|---|
| f3 | carbon | INSUMO_OPERATIVO — sin receta |
| f5 | salcchicha rooster para mini | Sin receta, posible duplicado |
| f12 | limon | INSUMO_OPERATIVO — sin receta |
| f13 | HUEVO | INSUMO_OPERATIVO — sin receta |
| f18 | SALSEROS onzas | Utensilio servicio |
| f21 | cilantro | INSUMO_OPERATIVO — sin receta |
| f22 | MANTEQUILLA margarina | INSUMO_OPERATIVO — sin receta |
| f24 | SALSA DE SOJA | Sin receta |
| f33 | papel carne | Sin receta |
| f34 | palillos | Sin receta |
| f36 | salsa tomate (sin "grande") | DUPLICADO de f17, no usada |
| f40 | chorizo | DUPLICADO de f46, no usada |
| f42 | pan de sal | Sin receta |
| f52 | pepino | Sin receta |
| f54 | PIMENTON ROJO | Sin receta |
| f55 | mayo grande | DUPLICADO de f38, no usada |
| f56 | guante | EPP |
| f57 | Trinche | Utensilio reutilizable |
| f58 | papel adsorbente | Material limpieza |
| f59 | pan Perro mini chalo | Sin receta, distinto de f43 |
| f60 | Sanchicha mini cazadora cunit | Sin receta |
| f61 | Aluminio | Material cocina |
| f63 | puerro | Sin receta |
| f64 | vaso 12 oz | Empaque bebidas |
| f65 | tapa boca | EPP, sin precio |
| f66 | papa bolsa premiun | DUPLICADO → fusionado con PAPA f29 |
| — | (10 insumos operativos) | REQUIERE_CONFIRMACION antes de importar |

---

## 4. SALSA X — Decisión

**Recomendación: Opción A — Insumo simple "Porción Salsa Acompañamiento"**

| Criterio | ¿Cumple? |
|---|---|
| Preserva costo en receta ($600/porción) | ✅ |
| Permite rastrear consumo (porciones vendidas) | ✅ |
| Compatible con compras futuras | ✅ (se puede "comprar" cuando se produce la salsa) |
| No inventa qué salsa es | ✅ |
| Permite salsa adicional (venta extra) | ✅ (crear producto "Salsa Extra" $X) |
| Compatible con schema actual | ✅ (insumo normal, unidad=porción) |

No es subreceta porque no sabemos los ingredientes. No es costo operativo porque aparece explícitamente en recetas con cantidad y costo definidos.

---

## 5. RECETAS — Reconstrucción desde Excel

### Burger Classic (19 ingredientes, lote=1)

| # | Original Excel | Normalizado | UUID Supa | Ud | Qty | Lote | Qty/ud | CU | Calc | Excel | Δ | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CARNE ESPECIAL | Carne Especial | CREAR | g | 110 | 1 | 110 | 16.556 | 1821 | 1821 | 0 | OK |
| 2 | PAN hamburguesa ARTESANAL | Pan Hamburguesa Artesanal | 73548bdb | ud | 1 | 1 | 1 | 1350 | 1350 | 1350 | 0 | OK |
| 3 | QUESO chalo | Queso Chalo | CREAR | ud | 1 | 1 | 1 | 610 | 610 | 610 | 0 | OK |
| 4 | servilleta | Servilleta | CREAR | ud | 3 | 1 | 3 | 14 | 42 | 42 | 0 | OK |
| 5 | TOMATE | Tomate | CREAR | ud | 0.2 | 1 | 0.2 | 800 | 160 | 160 | 0 | OK |
| 6 | Salsa tomate (grande) | Salsa Tomate Grande | CREAR | g | 25 | 1 | 25 | 6.744 | 169 | 169 | 0 | OK |
| 7 | tocineta | Tocineta | CREAR | ud | 1 | 1 | 1 | 736.67 | 737 | 737 | 0 | OK |
| 8 | LECHUGA CRESPA | Lechuga Crespa | CREAR | g | 15 | 1 | 15 | 19.444 | 292 | 292 | 0 | OK |
| 9 | Rripia | Ripia | CREAR | g | 10 | 1 | 10 | 10.40 | 104 | 104 | 0 | OK |
| 10 | MOSTAZA | Mostaza | CREAR | g | 10 | 1 | 10 | 10.612 | 106 | 106 | 0 | OK |
| 11 | papel envoltorio 29*29 | Papel Envoltorio 29×29 | CREAR | ud | 1 | 1 | 1 | 85.50 | 86 | 86 | 0 | OK |
| 12 | SALSA DE CARNE | Salsa de Carne | CREAR | ml | 5 | 1 | 5 | 16.471 | 82 | 82 | 0 | OK |
| 13 | CEBOLLA B | Cebolla Blanca | CREAR | ud | 0.2 | 1 | 0.2 | 600 | 120 | 120 | 0 | OK |
| 14 | PIMIENTA NERA | Pimienta Negra | CREAR | g | 0.7 | 1 | 0.7 | 56 | 39 | 39 | 0 | OK |
| 15 | cabeza de ajo | Cabeza de Ajo | CREAR | ud | 0.2 | 1 | 0.2 | 600 | 120 | 120 | 0 | OK |
| 16 | OREANO EN POLVO | Orégano en Polvo | CREAR | g | 0.5 | 1 | 0.5 | 100 | 50 | 50 | 0 | OK |
| 17 | salsa x | Porción Salsa Acomp. | CREAR | porción | 1 | 1 | 1 | 600 | 600 | 600 | 0 | OK |
| 18 | salsa piña | Salsa Piña | CREAR | g | 15 | 1 | 15 | 9.70 | 146 | 146 | 0 | OK |
| 19 | CEBOLLIN | Cebollín | CREAR | g | 2 | 1 | 2 | 25 | 50 | 50 | 0 | OK |
| | **TOTAL** | | | | | | | | **$6.683** | **$6.683** | **0** | **OK** |

### Perro Clásico (12 ingredientes, lote=10)
- Total lote Excel: $37.207 | Recalculado: $37.207 | Δ=0 | **OK**
- Costo/ud: $3.720,70 | Precio: $8.000 | Margen: 53,5%
- 12/12 ingredientes EQ_OK ✅

### Salchipapa (13 ingredientes reales, lote=1)
- Total Excel (sin Trinche, sin nota "2.5kg"): $6.385 | Recalculado: $6.385 | Δ=0 | **OK**
- Nota: Fila "2.5kg" con excel=0 calc=$15.873 es una nota de referencia, NO un ingrediente (total=0 lo confirma)
- Trinche ($34) excluido como utensilio
- Costo/ud: $6.385 | Precio: $13.000 | Margen: 50,9%
- 13/13 ingredientes reales EQ_OK ✅

### Salchipapa Especial (15 ingredientes, lote=1)
- Total Excel: $9.371 | Recalculado: $9.371 | Δ=0 | **OK**
- Costo/ud: $9.371 | Precio: $18.000 | Margen: 47,9%
- 15/15 ingredientes EQ_OK ✅

---

## 6. VALIDACIÓN MATEMÁTICA

| Producto | Costo Excel | Recalculado | Diferencia | % | Estado |
|---|---|---|---|---|---|
| Burger Classic | $6.683 | $6.683 | $0 | 0% | ✅ OK |
| Perro Clásico (×10) | $37.207 | $37.207 | $0 | 0% | ✅ OK |
| Perro Clásico (/ud) | $3.721 | $3.721 | $0 | 0% | ✅ OK |
| Salchipapa (sin Trinche) | $6.385 | $6.385 | $0 | 0% | ✅ OK |
| Salchipapa Especial | $9.371 | $9.371 | $0 | 0% | ✅ OK |

**0 diferencias en 4 recetas.** Todas las diferencias de redondeo son < $1.

---

## 7. PRODUCTOS

| Producto | Excel | Supabase | Precio Excel | Precio Supa | Estado |
|---|---|---|---|---|---|
| Burger Classic | ✅ burger | ✅ 5d362b34 | $14.000 | $14.000 | 🟢 YA_EXISTE_Y_COINCIDE |
| Perro Caliente | ✅ perro clasicc | ✅ existe | $8.000 | $8.000 | 🟢 YA_EXISTE_Y_COINCIDE |
| Salchipapa | ✅ salchipapa | ❓ Papa en Espiral | $13.000 | $8.000 | 🔴 REQUIERE_CONFIRMACION |
| Salchipapa Especial | ✅ salchip especial | ❌ no existe | $18.000 | — | 🟢 NUEVO_PRODUCTO_VALIDADO |
| Corn Dog Clásico | ❌ no en Excel | ✅ existe | — | $12.000 | 🟡 REQUIERE_CONFIRMACION |
| Postobón Manzana | — | ✅ existe | — | $3.000 | ⚪ CONSERVAR |
| Coca-Cola | — | ✅ existe | — | $3.000 | ⚪ CONSERVAR |
| Cerezada | — | ✅ existe | — | $6.000 | ⚪ CONSERVAR |
| Limonada | — | ✅ existe | — | $6.000 | ⚪ CONSERVAR |

---

## 8. PROVEEDORES

| Proveedor | Evidencia | Insumos | Tel. | Contacto | Conf. |
|---|---|---|---|---|---|
| Chalo | inventario + CONTABILID ×6 | Queso, salsa tomate | NULL | NULL | 🟢 ALTA |
| Carnecol | inventario + CONTABILID ×2 | Carne Especial | NULL | NULL | 🟢 ALTA |
| Olimpica | inventario ×1 | Lechuga | NULL | NULL | 🟡 MEDIA |

---

## 9. CLASIFICACIÓN DE INSUMOS OPERATIVOS

| Categoría | Qué incluye | ¿Va a `public.insumos`? |
|---|---|---|
| A) Ingredientes productivos (34) | Carne, salsas, quesos, verduras | ✅ SÍ |
| B) Empaques/consumibles (5) | Empaque J1, bolsa, servilleta, papel, porta | ✅ SÍ (se descuentan por receta) |
| C) Insumos operativos (10) | Carbón, limón, huevo, cilantro, etc. | 🟡 SOLO si propietario confirma |
| D) Utensilios/equipos | Trinche, Aluminio, guante, etc. | ❌ NO — activos fijos |
| E) Gastos contables | Transporte, candado, limpieza | ❌ NO — módulo de gastos |

---

## 10. DRY-RUN COMPLETO — SIMULACIÓN

### FASE 0: Schema (1 ALTER)
```
ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
```

### FASE 1: Insumos

| Acción | Nombre | Detalle |
|---|---|---|
| ACTUALIZAR | Pan Hamburguesa Artesanal | Renombrar "Pan de Hamburguesa", set costo_unitario=1350 |
| CREAR ×39 | (ver tabla §3) | stock=0, activo=true, costo_unitario=Excel |

### FASE 2: Proveedores

| Acción | Nombre |
|---|---|
| CREAR | Chalo |
| CREAR | Carnecol |
| CREAR | Olimpica |

### FASE 3: Productos

| Acción | Producto | Detalle |
|---|---|---|
| — | Burger Classic | Ya existe, sin cambios |
| — | Perro Caliente | Ya existe, sin cambios |
| REQUIERE_CONFIRMACION | Salchipapa | ¿= Papa en Espiral? |
| CREAR | Salchipapa Especial | $18.000, comida, activo |

### FASE 4: Recetas (59 INSERT en producto_insumos)

| Producto | Registros |
|---|---|
| Burger Classic | 19 (eliminar el 1 existente primero) |
| Perro Caliente | 12 |
| Salchipapa | 13 (si se resuelve conflicto) |
| Salchipapa Especial | 15 |

### FASE 5: Validación

```
Para cada producto:
  Σ (cantidad_por_unidad × insumo.costo_unitario) ≈ costo_Excel
```

---

## 11. VALIDACIÓN DE INTEGRIDAD

| Check | Resultado |
|---|---|
| Duplicados de insumos | ✅ 0 — cada nombre es único |
| producto_insumos → UUID inexistente | ✅ 0 — todos apuntan a insumos que existirán |
| Unidades incompatibles | ✅ 0 — cada receta usa la unidad correcta de EQUIV |
| Receta sin insumo válido | ✅ 0 — todos los ingredientes mapeados |
| Producto con requiere_inventario sin receta | ⚠️ Corn Dog ($12k) — sin receta visible |
| Costo inventado | ✅ 0 — todos de EQUIVALENCIA |
| Proveedor inventado | ✅ 0 — todos con evidencia visible |
| Dato histórico alterado | ✅ 0 — nada tocado |

---

## 12. DATOS HISTÓRICOS

| Tabla | Registros | Tipo | Acción |
|---|---|---|---|
| clientes | 14 | REAL (fidelización) | NO TOCAR |
| stamp_logs | 15 | REAL (sellos) | NO TOCAR |
| ventas | 1 | PRUEBA (venta test 2026-08-07) | NO TOCAR |
| sesiones_caja | 1 | PRUEBA (sesión test) | NO TOCAR |
| movimientos_caja | 2 | PRUEBA (apertura $50k + venta $20k) | NO TOCAR |
| movimientos_inventario | 1 | PRUEBA (descuento Pan de Hamburguesa) | NO TOCAR |
| producto_insumos | 1 | PARCIAL (Burger → Pan, qty=1) | REEMPLAZAR en FASE 4 |
| compras | 0 | — | — |
| proveedores | 0 | — | — |

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
EXCEL MODIFICADO: NO
CÓDIGO MODIFICADO: NO
```
