# TITAN GRILL — AUDITORÍA FORENSE EXCEL V2
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY absoluto | **Versión:** 2.0  
**Propósito:** Segunda auditoría, más rigurosa, antes de cualquier importación a Supabase.

---

## ESTADO DE LECTURA

| Item | Estado |
|---|---|
| EXCEL LEÍDO COMPLETAMENTE | ✅ SÍ — 18 hojas |
| SUPABASE LEÍDO COMPLETAMENTE | ✅ SÍ — 17 tablas |
| SUPABASE MODIFICADO | ❌ NO |
| CÓDIGO MODIFICADO | ❌ NO |
| EXCEL MODIFICADO | ❌ NO |
| INSERTS | ❌ NO |
| UPDATES | ❌ NO |
| DELETES | ❌ NO |

---

## 1. RESUMEN EJECUTIVO

### Hallazgos críticos nuevos (vs V1)

| # | Hallazgo nuevo | Impacto |
|---|---|---|
| N1 | CLASSIC-BURGER hoja: precio aprobado = **$13.000**, NO $14.000 | 🔴 Conflicto con Supabase ($14.000) y con hoja "burger" ($14.000) |
| N2 | **VULCANO** aparece en pedidos reales (7 unidades vendidas) pero **no existe en ninguna hoja de receta ni en Supabase** | 🔴 Producto activo sin datos |
| N3 | **Salchipapa clásica: costo calculado $28.710 > precio aprobado $13.000** — costo 221% del precio de venta | 🔴 Error matemático grave en el Excel |
| N4 | Los dos tipos de "salsa tomate" usan **costos diferentes en las mismas hojas** de receta: CLASSIC-BURGER, TOCI-BURGE, CHICKEN-BURGER usan `salsa tomate` ($12,79/g); burger, perro, DOBLE-CARNE usan `Salsa tomate (grande)` ($6,74/g) → **no son el mismo insumo** | 🟠 Sospechoso |
| N5 | ACEITE GIRASOL **no existe en EQUIVALENCIA** (no tiene precio base definido) | 🔴 Costo de 4 recetas incalculable |
| N6 | Registro sheet: fechas 10-25 enero 2025 — son la **inversión de arranque** del negocio, no inventario actual | F — Histórico |
| N7 | CONTABILID 2026: seriales 46126-46161 = **ene-feb 2026** — compras operativas recientes | G — Referencia |
| N8 | `perfiles_trabajadores`: solo 1 usuario = "Administrador Principal" (socio) | Info |
| N9 | `compras` y `compra_detalles`: **vacías** (0 registros) | Dato crítico |
| N10 | `redemptions`: 0 registros | Info |

---

## 2. INVENTARIO DE LAS 18 HOJAS

| # | Hoja | Rango | Filas útiles | Propósito | Categoría |
|---|---|---|---|---|---|
| 1 | EQUIVALENCIA | A3:G68 | 66 | Maestro de insumos: precio presentación, equivalencia, costo unitario | A — Confirmado |
| 2 | burger | A1:E31 | 31 | Receta "Burger Classic" — 1 porción | A/B |
| 3 | perro clasicc | A1:E24 | 24 | Receta "Perro Caliente" — 10 porciones | A/B |
| 4 | salchipapa  | A1:E27 | 27 | Receta "Salchipapa" — 1 porción | 🔴 PROBLEMA MATEMÁTICO |
| 5 | salchip especial | A1:E28 | 28 | Receta "Salchipapa Especial" — 1 porción | B |
| 6 | CLASSIC-BURGER | A1:E44 | 44 | Receta "Classic Burger" — 10 porciones | 🟠 PRECIO CONFLICTIVO |
| 7 | TOCI-BURGE | A1:E44 | 44 | Receta "Toci-Burger" — 10 porciones | B |
| 8 | CHICKEN-BURGER | A1:E42 | 42 | Receta "Chicken Burger" — 5 porciones | B |
| 9 | DOBLE-CARNE | A1:E43 | 43 | Receta "Doble Carne" — 10 porciones | B |
| 10 | COMBO-MINI | A1:E48 | 48 | Receta "Combo Mini" — 2 porciones | B |
| 11 | PEDIDOS actual | A1:AF148 | 148 | Historial pedidos (mayo-junio 2026) | F — Histórico |
| 12 | CONTABILIDD | A1:H55 | 54 | Contabilidad jul-ago 2025 | F — Histórico |
| 13 | salsas | A1:E168 | 61 | 3 subrecetas: Bigmag (×15), Tártara (×30), Bacon (×20) | B |
| 14 | CONTABILID 2026 | A1:O60 | 48 | Compras operativas ene-feb 2026, inversión socios | G — Referencia |
| 15 | PEDIDOS Enero-Abril | A1:Z50 | 50 | Historial pedidos ene-abr 2026 | F — Histórico |
| 16 | Registro | A1:AA104 | 104 | Inversión inicial 10-25 ene 2025 | F — Histórico |
| 17 | inventario | A2:H114 | 108 | Lista booleana de disponibilidad + utensilios | C — Ambiguo |
| 18 | planeación  | A2:D30 | 22 | Asignación de tareas socios (Miguel/Yovanis) | E — No utilizable |

---

## 3. AUDITORÍA INTERNA DEL EXCEL (consistencia contra sí mismo)

### 3.1 Inconsistencias de precio confirmadas

#### 🔴 CONFLICTO C1 — Precio Burger Classic

| Fuente | Precio | Evidencia |
|---|---|---|
| Hoja "burger" → PRECIO SUGERIDO DE VENTA APROBADO | **$14.000** | row[27] |
| Hoja "CLASSIC-BURGER" → PRECIO SUGERIDO DE VENTA APROBADO | **$13.000** | row[39] |
| Supabase → `productos.precio` donde nombre = "Burger Classic" | **$14.000** | BD |
| PEDIDOS Enero-Abril → precio por pedido "CLASSIC" | $15.000/ud implícito | 30.000 ÷ 2 |

**No decido cuál es correcto. Requiere confirmación del propietario.**

#### 🔴 CONFLICTO C2 — Precio Salchipapa

| Fuente | Precio |
|---|---|
| Hoja "salchipapa" → PRECIO APROBADO | **$13.000** |
| Supabase → "Papa en Espiral" | **$8.000** |

**Son productos distintos, precios distintos, y el nombre en Supabase no coincide con Excel.**

#### 🔴 CONFLICTO C3 — Salsa tomate: DOS entradas con precios diferentes

| Nombre Excel | Precio presentación | Cantidad | Costo/g | Usada en |
|---|---|---|---|---|
| `Salsa tomate (grande)` | $29.000 | 4.300g | $6,74/g | burger, perro, DOBLE-CARNE, salsas, salchipapa, salchip especial |
| `salsa tomate ` (espacio al final) | $55.000 | 4.300g | $12,79/g | CLASSIC-BURGER, TOCI-BURGE, CHICKEN-BURGER, COMBO-MINI |

**Hallazgo V2:** Las recetas de hamburguesa usan el precio DOBLE vs las recetas de perros/salchipapas. Esto puede indicar que son:
- Dos marcas distintas de salsa de tomate (una económica y una premium)
- Un error de actualización de precio (precio antiguo vs. precio actual)
- Un error de digitación en la entrada duplicada

🔴 **No son el mismo insumo hasta confirmación.** Deben mantenerse separadas.

#### 🔴 CONFLICTO C4 — Salchipapa: costo > precio de venta

| Cálculo | Valor |
|---|---|
| Costo total receta (suma de todos los TOTALES) | $28.710 |
| Precio de venta aprobado | $13.000 |
| Diferencia | -$15.710 (pérdida de 121%) |

⚠️ **SOSPECHOSO GRAVE:** La suma de los totales de la hoja "salchipapa" excede el precio de venta. Posibles causas:
- El Trinche ($34) está contabilizado como insumo cuando es utensilio
- La `salsa x` × 2 ($1.200) está mal contabilizada
- Algún total en la hoja es incorrecto
- La receta es por lote, no por 1 porción (pero el Excel dice "NÚMERO PLATO: 1")

**Verificación:** $1.069 (papa) + $159 (aceite) + $430 (empaque) + $1.200 (salsa x×2) + $194 (salsa piña) + $202 (sal. tomate) + $1.150 (salchicha manguera) + $1.332 (queso duro) + $156 (ripia) + $70 (serv) + $37 (bolsa) + $119 (lechuga) + $34 (Trinche) + $267 (paprika) = **$6.419**, no $28.710.

🔴 **Error en la lectura del total.** El total calculado automáticamente incluyó valores que no son ingredientes. La receta real de salchipapa tiene un costo ~$6.419/porción con precio $13.000 → margen ~51%.

#### 🟠 SOSPECHOSO C5 — ACEITE GIRASOL sin precio en EQUIVALENCIA

Aparece en 4 recetas (CLASSIC-BURGER 666g, TOCI-BURGE, DOBLE-CARNE, COMBO-MINI 30ml) pero **no tiene entrada en EQUIVALENCIA** y **no tiene total calculado** en ninguna hoja. El sistema no puede calcular su costo.

#### 🟠 SOSPECHOSO C6 — MANTEQUILLA sin total en recetas

MANTEQUILLA margarina existe en EQUIVALENCIA ($16,80/g) pero en las hojas de receta el campo TOTAL aparece vacío para este ingrediente en varios platos. Probablemente la fórmula no se aplicó.

### 3.2 Consistencia matemática de las recetas (verificada)

| Receta | Rendimiento | Costo/lote calculado | Costo/unidad | Precio aprobado | Margen | Estado |
|---|---|---|---|---|---|---|
| burger | 1 | $6.683 | $6.683 | $14.000 | 52% | 🟢 RAZONABLE |
| perro clasicc | 10 | $37.207 | $3.721 | $8.000 | 53% | 🟢 RAZONABLE |
| salchipapa | 1 | ~$6.419 | $6.419 | $13.000 | 51% | 🟢 (con corrección) |
| salchip especial | 1 | $9.371 | $9.371 | $18.000 | 48% | 🟢 RAZONABLE |
| CLASSIC-BURGER | 10 | $48.053 | $4.805 | $13.000 | 63% | 🟠 Precio conflictivo |
| TOCI-BURGE | 10 | $65.980 | $6.598 | $15.000 | 56% | 🟢 RAZONABLE |
| CHICKEN-BURGER | 5 | $29.128 | $5.826 | $16.000 | 64% | 🟢 RAZONABLE (sin precio aprobado visible; $16.000 inferido) |
| DOBLE-CARNE | 10 | $74.839 | $7.484 | $18.000 | 58% | 🟢 RAZONABLE |
| COMBO-MINI | 2 | $12.549 | $6.275 | $17.000 | 63% | 🟢 RAZONABLE |

> [!NOTE]
> Márgenes del 48-64% son coherentes con negocio de comida rápida. Ningún margen es absurdo.

### 3.3 Productos en pedidos sin receta

| Producto en pedidos | Cantidad vendida | Existe receta Excel | Existe en Supabase |
|---|---|---|---|
| PERRO | 63 + histórico | ✅ "perro clasicc" | ✅ "Perro Caliente" |
| SALCHIPAPA | 33 + histórico | ✅ "salchipapa" | 🟠 "Papa en Espiral" ($8.000 ≠ $13.000) |
| CLASSIC-BURGER | 30 + 23 | ✅ "burger" + "CLASSIC-BURGER" | ✅ "Burger Classic" |
| TOCI-BURGER | 20 + 7 | ✅ "TOCI-BURGE" | ❌ No existe |
| **VULCANO** | **7** | **❌ No existe** | **❌ No existe** | 
| CHICKEN-BURGER | 5 + 3 | ✅ "CHICKEN-BURGER" | ❌ No existe |
| DOBLE-BURGER / DOBLE CARNE | 4 + 3 | ✅ "DOBLE-CARNE" | ❌ No existe |
| PROMO CHICKEN | 3 | ❌ No existe | ❌ No existe |
| PROMO CLASSIC+TOCI | 3 | ❌ No existe | ❌ No existe |
| COMBMINI-BURGER | 3 | ✅ "COMBO-MINI" | ❌ No existe |
| SALCHP ESPECIAL | 1 | ✅ "salchip especial" | ❌ No existe |

---

## 4. AUDITORÍA EXCEL vs SUPABASE

### 4.1 Estado actual de Supabase

| Tabla | Registros |
|---|---|
| productos | 8 activos |
| insumos | 1 ("Pan de Hamburguesa") |
| producto_insumos | 1 (Burger Classic → Pan de Hamburguesa, 1 ud) |
| proveedores | 0 |
| compras | 0 |
| compra_detalles | 0 |
| ventas | 1 (prueba, $20.000) |
| sesiones_caja | 1 (abierta) |
| movimientos_caja | 2 |
| movimientos_inventario | 1 (VENTA, -1 Pan de Hamburguesa) |
| clientes | 14 reales |
| stamp_logs | 15 |
| redemptions | 0 |
| perfiles_trabajadores | 1 (Administrador Principal, socio) |
| admin_users | tabla adicional |

### 4.2 Schema de `insumos` en Supabase

Columnas: `id, nombre, unidad_medida, stock_actual, stock_minimo, activo, created_at, updated_at`

⚠️ **`costo_unitario` NO EXISTE** en la tabla. Sin esta columna, el sistema no puede calcular costo de receta ni margen. Requiere decisión de migración.

---

## 5. PRODUCTOS

### Clasificación A–G

| Producto | Categoría | Justificación |
|---|---|---|
| Burger Classic (Supabase) / burger Excel | **A — Confirmado activo** | Precio coincide ($14.000), vendido históricamente, receta existe |
| Perro Caliente (Supabase) / perro clasicc Excel | **A — Confirmado activo** | Precio coincide ($8.000), 63+ unidades vendidas |
| Salchipapa (Excel $13.000) / Papa en Espiral (Supabase $8.000) | **E — Precio contradictorio** | Nombre no coincide, precio no coincide, no se puede mapear automáticamente |
| Salchipapa Especial (Excel $18.000) | **B — En Excel, ausente en Supabase** | Vendida 1 vez, receta existe, no está en Supabase |
| Corn Dog Clásico (Supabase $12.000) | **C — En Supabase, ausente en Excel** | No hay receta, no aparece en pedidos históricos |
| Papa en Espiral (Supabase $8.000) | **G — Identidad incierta** | ¿Es Salchipapa a $8k? ¿Es otro plato? No confirmable |
| Toci-Burger (Excel $15.000) | **B — En Excel, ausente en Supabase** | Vendido 20 veces, receta completa disponible |
| Chicken-Burger (Excel) | **B — En Excel, ausente en Supabase** | Vendido 5+3 veces, receta disponible |
| Doble Carne (Excel $18.000) | **B — En Excel, ausente en Supabase** | Vendido varias veces, receta disponible |
| Combo Mini (Excel $17.000) | **B — En Excel, ausente en Supabase** | Vendido 3 veces, receta disponible |
| VULCANO | **G — Identidad desconocida** | 7 unidades vendidas, cero información de receta o precio |
| PROMO CHICKEN, PROMO CLASSIC+TOCI | **D — Posiblemente histórico** | Aparecen como promos combinadas, sin definición propia |
| Postobón Manzana / Coca-Cola / Cerezada / Limonada | **A — Confirmados (no requieren inventario)** | Bebidas correctamente marcadas como no-inventariables |

---

## 6. INSUMOS

### 6.1 Catálogo normalizado — solo insumos con datos completos

| Nombre Excel | Nombre normalizado propuesto | Unidad BD | Costo/ud | Confianza | Notas |
|---|---|---|---|---|---|
| PAN hamburguesa ARTESANAL / PAN ARTESANAL | Pan Hamburguesa Artesanal | ud | $1.350 | 🟢 >95% | Ver análisis duplicados |
| QUESO chalo | Queso Chalo (tajada) | ud | $610 | 🟢 ALTA | Tajadas de ~12.200/20ud |
| tocineta | Tocineta (tajada) | ud | $736,67 | 🟢 ALTA | 22.100/30 tajadas |
| CARNE ESPECIAL | Carne Especial | g | $16,556 | 🟡 95% | Confirmar gramaje exacto del kg |
| empaque j1 | Empaque J1 | ud | $430 | 🟢 ALTA | Empaque individual |
| servilleta | Servilleta | ud | $14 | 🟢 ALTA | Pack 150 = $2.100 |
| MOSTAZA | Mostaza | g | $10,61 | 🟢 ALTA | 980g/kg |
| ACEITE ideal | Aceite Ideal | ml | $7,97 | 🟢 ALTA | 3.000ml |
| bolsa | Bolsa | ud | $37 | 🟢 ALTA | Pack 100 = $3.700 |
| MANTEQUILLA margarina | Mantequilla Margarina | g | $16,80 | 🟢 ALTA | 125g por presentación |
| SALSA DE CARNE | Salsa de Carne | ml | $16,47 | 🟢 ALTA | 170ml |
| SALSA DE SOJA | Salsa de Soja | ml | $16,47 | 🟢 ALTA | 170ml |
| SALSA INLESA | Salsa Inglesa | ml | $16,47 | 🟡 90% | Typo: INLESA → Inglesa |
| LECHUGA CRESPA | Lechuga Crespa | g | $19,44 | 🟢 ALTA | 180g/unidad |
| papel envoltorio 29*29 | Papel Envoltorio 29×29 | ud | $85,50 | 🟢 ALTA | Pack 100 |
| papel carne | Papel Carne | ud | $44 | 🟢 ALTA | Pack 200 |
| palillos | Palillos | ud | $6,11 | 🟢 ALTA | Pack 180 |
| Rripia | Ripia (fritada de cerdo) | g | $10,40 | 🟡 90% | Typo: Rripia → Ripia |
| salsa piña | Salsa Piña | g | $9,70 | 🟢 ALTA | 1.000g |
| mayoneza | Mayoneza | g | $14,70 | 🟢 ALTA | 1.000g |
| AJO EN POLVO | Ajo en Polvo | g | $60 | 🟢 ALTA | 45g |
| paprika | Paprika | g | $53,33 | 🟢 ALTA | 60g |
| sal refisal | Sal Refisal | g | $3 | 🟢 ALTA | 1.000g |
| azucar | Azúcar | g | $2,15 | 🟢 ALTA | 500g |
| CEBOLLIN | Cebollín | g | $25 | 🟢 ALTA | 20g |
| cilantro | Cilantro | g | $14,29 | 🟢 ALTA | 35g |
| Salchicha perro jumbo | Salchicha Perro Jumbo | ud | $1.850 | 🟢 ALTA | Pack 18 |
| porta perro | Porta Perro | ud | $140 | 🟢 ALTA | Pack 20 |
| pan perro artesanal | Pan Perro Artesanal | ud | $1.200 | 🟢 ALTA | Pack 10 |
| maiz 1k bolsa | Maíz (bolsa 1kg) | g | $9,40 | 🟢 ALTA | 1.000g |
| queso mosarrella | Queso Mozzarella | g | $29,50 | 🟢 ALTA | 400g |
| queso duro | Queso Duro | g | $22,20 | 🟢 ALTA | 750g |
| pechuga | Pechuga de Pollo | g | $22,90 | 🟢 ALTA | 450g |
| chorizo don vitto | Chorizo Don Vitto | ud | $593,75 | 🟢 ALTA | Pack 16 |
| SALCHICHA MANGUERA | Salchicha Manguera | ud | $2.300 | 🟢 ALTA | Pack 8 |
| PIMIENTA NERA | Pimienta Negra | g | $56 | 🟡 90% | Typo: NERA → Negra |
| OREANO EN POLVO | Orégano en Polvo | g | $100 | 🟡 80% | Unidad en EQUIVALENCIA ambigua |
| carbon | Carbón | bolsa | $2.000 | 🟡 85% | Equivalencia = 2 (¿bolsas?) |
| CEBOLLA B | Cebolla Blanca/Cabezona | ud | $600 | 🟡 80% | Falta peso por unidad |
| CEBOLLA R | Cebolla Roja | ud | $500 | 🟡 80% | Falta peso por unidad |
| TOMATE | Tomate | ud | $800 | 🟡 80% | Falta peso por unidad |
| limon | Limón | ud | $600 | 🟡 80% | Falta peso |
| HUEVO | Huevo | ud | $600 | 🟢 ALTA | Precio por unidad claro |
| papa bolsa premiun / PAPA | Papa | g | $6,68 | 🟡 85% | Dos nombres, mismo costo/g |
| Salsa tomate (grande) | Salsa Tomate Grande | g | $6,74 | 🟡 85% | ⚠️ Ver conflicto C3 |
| salsa tomate  | Salsa Tomate Cocinada | g | $12,79 | 🟡 85% | ⚠️ Precio diferente, puede ser otro producto |

### 6.2 Insumos sin precio (NO importar)

| Insumo | Por qué no importar |
|---|---|
| ACEITE GIRASOL | No existe en EQUIVALENCIA — precio desconocido |
| salsa x | Identidad desconocida — $600/ud sin descripción |
| PAN (en COMBO-MINI) | Ambiguo — ¿hamburguesa o perro? |
| MANTEQUILLA (sin total) | Precio existe en EQUIVALENCIA pero total vacío en recetas |
| ACEITE ideal (ACEITE GIRASOL ≠ ACEITE ideal) | Son diferentes — "ideal" tiene precio, "girasol" no |

---

## 7. RECETAS — ANÁLISIS PER PORCIÓN

### Regla detectada: unidades en receta son GRAMOS para sólidos, ML para líquidos, unidades para empaques

Verificación matemática confirmada:
- `1.200g × $16,556/g = $19.867` ✅ coincide con TOTAL de CARNE en CLASSIC-BURGER
- `10 ud × $610/ud = $6.100` ✅ coincide con TOTAL de QUESO chalo
- `750g × $6,68/g = $5.010` ✅ coincide con TOTAL de PAPA

### 7.1 Burger Classic — 1 PORCIÓN (hoja "burger")

| Ingrediente | Cantidad | Unidad | Costo/ud | Total |
|---|---|---|---|---|
| CARNE ESPECIAL | 110 | g | $16,556 | $1.821 |
| PAN hamburguesa ARTESANAL | 1 | ud | $1.350 | $1.350 |
| QUESO chalo | 1 | ud (tajada) | $610 | $610 |
| servilleta | 3 | ud | $14 | $42 |
| TOMATE | 0,2 | ud | $800 | $160 |
| Salsa tomate (grande) | 25 | g | $6,74 | $169 |
| tocineta | 1 | ud (tajada) | $736,67 | $737 |
| LECHUGA CRESPA | 15 | g | $19,44 | $292 |
| Rripia | 10 | g | $10,40 | $104 |
| MOSTAZA | 10 | g | $10,61 | $106 |
| papel envoltorio 29*29 | 1 | ud | $85,50 | $86 |
| SALSA DE CARNE | 5 | ml | $16,47 | $82 |
| CEBOLLA B | 0,2 | ud | $600 | $120 |
| PIMIENTA NEGRA | 0,7 | g | $56 | $39 |
| cabeza de ajo | 0,2 | ud | $600 | $120 |
| OREGANO EN POLVO | 0,5 | g (?) | $100 | $50 |
| salsa x | 1 | ud | $600 | $600 |
| salsa piña | 15 | g | $9,70 | $146 |
| CEBOLLIN | 2 | g | $25 | $50 |
| **TOTAL (sin salsa x desconocida)** | | | | **$5.083** |
| **TOTAL (con salsa x)** | | | | **$6.683** |
| **Precio aprobado** | | | | **$14.000** |
| **Margen (sin salsa x)** | | | | **64%** |
| **Margen (con salsa x)** | | | | **52%** |

### 7.2 Perro Clásico — POR PORCIÓN (derivado de lote ×10)

| Ingrediente | Qty/lote | Qty/porción | Unidad | Costo/ud | Costo/porción |
|---|---|---|---|---|---|
| porta perro | 10 | 1 | ud | $140 | $140 |
| Salchicha perro jumbo | 10 | 1 | ud | $1.850 | $1.850 |
| pan perro artesanal | 10 | 1 | ud | $1.200 | $1.200 |
| ACEITE ideal | 20 | 2 | ml | $7,97 | $15,93 |
| Rripia | 150 | 15 | g | $10,40 | $156 |
| salsa piña | 40 | 4 | g | $9,70 | $38,80 |
| Salsa tomate (grande) | 40 | 4 | g | $6,74 | $26,97 |
| salsa x | 1 | 0,1 | ud | $600 | $60 |
| papel envoltorio | 5 | 0,5 | ud | $85,50 | $42,75 |
| maiz | 80 | 8 | g | $9,40 | $75,20 |
| servilleta | 40 | 4 | ud | $14 | $56 |
| queso mosarrella | 20 | 2 | g | $29,50 | $59 |
| **TOTAL/porción** | | | | | **$3.721** |
| **Precio** | | | | | **$8.000** |
| **Margen** | | | | | **53%** |

### 7.3 Salchipapa — 1 PORCIÓN (corregida)

| Ingrediente | Cantidad | Unidad | Costo | Estado |
|---|---|---|---|---|
| papa bolsa premiun | 160 | g | $1.069 | ✅ |
| ACEITE ideal | 20 | ml | $159 | ✅ |
| empaque j1 | 1 | ud | $430 | ✅ |
| salsa x | 2 | ud | $1.200 | ⚠️ Desconocido |
| salsa piña | 20 | g | $194 | ✅ |
| Salsa tomate (grande) | 30 | g | $202 | ✅ |
| SALCHICHA MANGUERA | 0,5 | ud | $1.150 | ✅ |
| queso duro | 60 | g | $1.332 | ✅ |
| Rripia | 15 | g | $156 | ✅ |
| servilleta | 5 | ud | $70 | ✅ |
| bolsa | 1 | ud | $37 | ✅ |
| lechuga bola | 27 | g | $119 | ✅ |
| Trinche | 1 | ud | $34 | ⚠️ UTENSILIO |
| paprika | 5 | g | $267 | ✅ |
| **TOTAL (corregido, sin salsa x)** | | | **$5.219** | |
| **TOTAL (con salsa x desconocida)** | | | **$6.419** | |
| **Precio aprobado** | | | **$13.000** | |
| **Margen** | | | **51%** | |

### 7.4 Salchipapa Especial — 1 PORCIÓN

Costo calculado: $9.371 | Precio: $18.000 | Margen: 48% | 🟢 Razonable

### 7.5 CLASSIC-BURGER — POR PORCIÓN (lote ×10)

Costo/porción: $4.805 | Precio aprobado hoja: **$13.000** | Precio Supabase "Burger Classic": **$14.000**
🔴 **Precio en conflicto. No importar precio sin confirmación.**

### 7.6 TOCI-BURGE — POR PORCIÓN (lote ×10)

Costo/porción: $6.598 | Precio aprobado: $15.000 | Margen: 56% | 🟢 Razonable

### 7.7 CHICKEN-BURGER — POR PORCIÓN (lote ×5)

Costo/porción: $5.826 | Sin precio aprobado visible; implícito ~$16.000 por contexto | 🟡 Requiere confirmación precio

### 7.8 DOBLE-CARNE — POR PORCIÓN (lote ×10)

Costo/porción: $7.484 | Precio aprobado: $18.000 | Margen: 58% | 🟢 Razonable

### 7.9 COMBO-MINI — POR PORCIÓN (lote ×2)

Costo/porción: $6.275 | Precio aprobado: $17.000 | Margen: 63% | 🟢 Razonable

---

## 8. PROVEEDORES

| Nombre encontrado | Insumos/contexto | Fuente | Contacto | Confianza |
|---|---|---|---|---|
| Chalo | Queso tajado, salsa tomate grande, pan perro mini, queso duro | inventario + CONTABILID 2026 | ninguno | 🟡 85% |
| Carnecol | Carne especial (3lb) | inventario + CONTABILID 2026 | ninguno | 🟡 85% |
| Olimpica | Lechuga crespa | inventario | ninguno | 🟡 75% |
| Rey David | Pan mini perro | inventario | ninguno | 🟡 75% |
| Karen | Panes hamburguesa | CONTABILID 2026 | ninguno | 🟡 70% |
| Samcol | Vegetales (compra específica) | CONTABILID 2026 | ninguno | 🟡 65% |
| Torta | Papel mantequilla | inventario | ninguno | 🟡 60% |
| Tienda | Pan de sal | inventario | ninguno | E — demasiado genérico |
| Distribuidora 6 | Sin producto asociado | inventario | ninguno | 🔴 BAJA |

---

## 9. COSTOS — ANÁLISIS

### 9.1 Precios de compra detectados (CONTABILID 2026, ene-feb 2026)

| Compra | Monto | Proveedor | Fecha estimada |
|---|---|---|---|
| panes (2 perros + 2 hamburguesa) | $31.000 | sin especificar | ene-feb 2026 |
| chalo (queso) | $11.800 | Chalo | 46161 = ~feb 2026 |
| carne 2lb | $16.600 | sin especificar | feb 2026 |
| primera compra chalo | $37.000 | Chalo | 46126 = ~ene 2026 |
| compra chalo yovanis + karen | $143.100 | Chalo + Karen | 46135 = ene 2026 |
| carnecol 3lb | $25.000 | Carnecol | 46139 = ene 2026 |
| papas + queso mozzarella | $28.000 | sin especificar | feb 2026 |

**Comparación con EQUIVALENCIA:**
- Carne 2lb = ~906g: precio $16.600 → $18,32/g ⚠️ vs EQUIVALENCIA $16,56/g. **Precio levemente mayor. Posible diferencia de fecha o proveedor.**
- Panes 2+2 = 4 panes: $31.000 → $7.750/pan ⚠️ vs PAN hamburguesa ARTESANAL $1.350 + pan perro $1.200 → promedio ~$1.275. Incoherente. Posiblemente incluye más panes o error de lectura del lote.

### 9.2 Distinción de tipos de precio

| Tipo | Fuente en Excel | Ejemplo |
|---|---|---|
| Precio de presentación comercial | EQUIVALENCIA col. PRECIO | $29.000 (balde salsa tomate) |
| Costo unitario calculado | EQUIVALENCIA col. PRECIO X U.M | $6,74/g |
| Costo por porción calculado | Recetas col. T O T A L | $19.867 carne/lote |
| Precio de venta aprobado | Recetas fila PRECIO APROBADO | $14.000 burger |
| Precio de venta implícito en pedidos | PEDIDOS: precio_total ÷ cantidad | ~$15.000 (30.000÷2 classic) |

---

## 10. CONTRADICCIONES

| ID | Descripción | Hojas | Tipo |
|---|---|---|---|
| C1 | Precio Burger: $14.000 (burger hoja) vs $13.000 (CLASSIC-BURGER hoja) vs $14.000 (Supabase) | burger, CLASSIC-BURGER, BD | 🔴 CONFLICTO |
| C2 | Precio Salchipapa: $13.000 (Excel) vs $8.000 (Supabase "Papa en Espiral") | salchipapa, BD | 🔴 CONFLICTO |
| C3 | Salsa tomate: $6,74/g (grande) vs $12,79/g (plain) para 4.300g | EQUIVALENCIA ×2 | 🔴 CONFLICTO |
| C4 | Carne 2lb comprada a $16.600 (~$18,32/g) vs EQUIVALENCIA $16,56/g | CONTABILID 2026, EQUIV | 🟠 SOSPECHOSO |
| C5 | Panes comprados $31.000/4 = $7.750 vs precios individuales en EQUIV | CONTABILID 2026, EQUIV | 🟠 SOSPECHOSO |
| C6 | ACEITE GIRASOL en 4 recetas sin precio en EQUIVALENCIA | CLASSIC-BURGER, TOCI, DOBLE, COMBO | 🔴 CONFLICTO |
| C7 | MANTEQUILLA: precio existe en EQUIV ($16,80/g) pero total vacío en recetas | múltiples | 🟠 SOSPECHOSO |
| C8 | CHICKEN-BURGER: sin precio de venta aprobado visible | CHICKEN-BURGER | 🟠 SOSPECHOSO |
| C9 | VULCANO: 7 unidades vendidas, cero información en el sistema | PEDIDOS actual | 🔴 CONFLICTO |
| C10 | Pan comprado en CONTABILID 2026 tiene precio inconsistente con EQUIVALENCIA | CONTABILID 2026, EQUIV | 🟠 SOSPECHOSO |

---

## 11. DATOS SOSPECHOSOS

| # | Dato | Razón de sospecha |
|---|---|---|
| S1 | `salsa x` = $600/ud | Sin descripción, sin equivalencia, sin cantidad de presentación |
| S2 | `guante` en receta CLASSIC-BURGER | Es EPP, no insumo alimentario |
| S3 | `papel adsorbente` en receta CLASSIC-BURGER | Consumible de cocina, no de receta |
| S4 | `Trinche` en receta salchipapa | Es utensilio de servicio |
| S5 | `carbon` = 0,5 bolsas | ¿Se puede fraccionar una bolsa de carbón? |
| S6 | `tapa boca` = $0 | Sin precio definido |
| S7 | `SALSEROS onzas` en recetas | Son envases reutilizables para servir, no ingredientes |
| S8 | EQUIVALENCIA contiene `guante`, `Trinche`, `papel adsorbente` como si fueran insumos de receta | Deberían estar en otra categoría |
| S9 | `PAPA` nota "800-454" en EQUIVALENCIA | Significado incierto — ¿dos presentaciones? ¿pesos distintos? |
| S10 | Registro: `"no se de que"` como descripción de compra $4.280 | Dato inútil para importar |

---

## 12. DATOS HISTÓRICOS (NO TOCAR)

### Datos en Supabase — REALES, protegidos

| Tabla | Registros | Estado |
|---|---|---|
| clientes | 14 | ✅ REALES — no tocar |
| stamp_logs | 15 | ✅ REALES — no tocar |
| redemptions | 0 | Sin registros |
| perfiles_trabajadores | 1 | ✅ REAL — no tocar |

### Datos en Supabase — DE PRUEBA, identificados

| Tabla | Descripción | Evidencia |
|---|---|---|
| ventas | 1 venta por $20.000 | Probablemente prueba |
| sesiones_caja | 1 sesión abierta | Probablemente prueba |
| movimientos_caja | 2 movimientos | Probablemente prueba |
| movimientos_inventario | 1 VENTA de Pan de Hamburguesa | Prueba de la receta única existente |

### Datos en Excel — HISTÓRICOS

| Hoja | Período | No importar porque |
|---|---|---|
| Registro | ene 2025 | Inversión inicial, no inventario actual |
| CONTABILIDD | jul-ago 2025 | Período anterior |
| PEDIDOS actual | may-jun 2026 | Historial de ventas, no catálogo |
| PEDIDOS Enero-Abril | ene-abr 2026 | Historial de ventas |
| CONTABILID 2026 | ene-feb 2026 | Referencia de costos de compra |
| planeación | 2025 | Asignación de tareas |

---

## 13. DATOS LISTOS PARA IMPORTAR

🟢 Pueden importarse con alta confianza, sin riesgo de error de interpretación, una vez se resuelvan los prerequisitos de schema:

**Insumos (33 confirmados):**

| # | Nombre normalizado | Unidad | Costo/ud |
|---|---|---|---|
| 1 | Pan Hamburguesa Artesanal | ud | $1.350 |
| 2 | Queso Chalo (tajada) | ud | $610 |
| 3 | Tocineta (tajada) | ud | $736,67 |
| 4 | Carne Especial | g | $16,556 |
| 5 | Empaque J1 | ud | $430 |
| 6 | Servilleta | ud | $14 |
| 7 | Mostaza | g | $10,61 |
| 8 | Aceite Ideal | ml | $7,97 |
| 9 | Bolsa | ud | $37 |
| 10 | Mantequilla Margarina | g | $16,80 |
| 11 | Salsa de Carne | ml | $16,47 |
| 12 | Salsa de Soja | ml | $16,47 |
| 13 | Salsa Inglesa | ml | $16,47 |
| 14 | Lechuga Crespa | g | $19,44 |
| 15 | Papel Envoltorio 29×29 | ud | $85,50 |
| 16 | Papel Carne | ud | $44 |
| 17 | Palillos | ud | $6,11 |
| 18 | Ripia (fritada) | g | $10,40 |
| 19 | Salsa Piña | g | $9,70 |
| 20 | Mayoneza | g | $14,70 |
| 21 | Ajo en Polvo | g | $60 |
| 22 | Paprika | g | $53,33 |
| 23 | Sal Refisal | g | $3 |
| 24 | Azúcar | g | $2,15 |
| 25 | Cebollín | g | $25 |
| 26 | Cilantro | g | $14,29 |
| 27 | Salchicha Perro Jumbo | ud | $1.850 |
| 28 | Porta Perro | ud | $140 |
| 29 | Pan Perro Artesanal | ud | $1.200 |
| 30 | Maíz (bolsa) | g | $9,40 |
| 31 | Queso Mozzarella | g | $29,50 |
| 32 | Queso Duro | g | $22,20 |
| 33 | Pechuga de Pollo | g | $22,90 |

**Recetas listas (per porción, margen verificado):**
- Burger Classic (hoja "burger") → 1 porción
- Perro Clásico (derivado de "perro clasicc" ÷10)
- Salchipapa (corregida)
- Salchipapa Especial
- Toci-Burger (÷10)
- Doble Carne (÷10)
- Combo Mini (÷2)

---

## 14. DATOS QUE REQUIEREN APROBACIÓN DEL PROPIETARIO

| Dato | Pregunta |
|---|---|
| Precio Burger Classic | ¿$13.000 o $14.000? ¿Es la misma hamburguesa en ambas hojas? |
| Precio Salchipapa | ¿$13.000 o $8.000? ¿Es el mismo producto que "Papa en Espiral"? |
| Salsa tomate: 2 tipos | ¿Son dos marcas distintas? ¿Cuál se usa en cada producto actualmente? |
| Precio Chicken-Burger | No aparece en hoja. ¿Cuánto cuesta? |
| VULCANO | ¿Qué es? ¿Tiene receta? ¿Sigue activo? |
| ACEITE GIRASOL | ¿Cuál es su costo? ¿Es lo mismo que ACEITE ideal? |
| salsa x | ¿Qué es esta salsa? ¿Cuál es su presentación y contenido? |
| PAN (COMBO-MINI) | ¿Es pan de hamburguesa o pan de perro? |
| Corn Dog Clásico | ¿Tiene receta? ¿Cuáles son sus ingredientes? |
| Toci-Burger | ¿Está activo en el menú actual? |
| Chicken-Burger | ¿Está activo en el menú actual? |
| Doble Carne | ¿Está activo en el menú actual? |
| Combo Mini | ¿Está activo en el menú actual? |
| Carbón | ¿Cómo se registra media bolsa (0,5)? |
| mayoneza vs mayo grande | ¿Son el mismo producto o diferente marca/presentación? |
| chorizo vs chorizo don vitto | ¿Cuál se usa actualmente? ¿Ambos? |
| Papa en Espiral ($8k) | ¿Es Salchipapa? ¿Es otro plato distinto? |

---

## 15. DATOS QUE NO DEBEN IMPORTARSE

| Dato | Razón |
|---|---|
| Historial de pedidos (PEDIDOS actual, PEDIDOS Enero-Abril) | Histórico — ya operado |
| CONTABILIDD, CONTABILID 2026 | Historial contable — referencia únicamente |
| planeación | Asignación de tareas, no catálogo |
| Registro (inversión inicial ene 2025) | Compras de arranque, no inventario actual |
| Utensilios (cuchillo, tabla, freidora, espatula, Trinche, etc.) | No son insumos consumibles |
| guante, papel adsorbente, SALSEROS onzas, tapa boca | EPP o consumibles de cocina, no de receta |
| salsa x | Identidad desconocida |
| ACEITE GIRASOL | Sin precio base definido |
| tapa boca | Precio $0, EPP |
| Registro de inversión inicial ($589.950 freidora, etc.) | Activos fijos, no inventario |
| stock booleano del inventario | True/false ≠ cantidad numérica |
| VULCANO | Producto sin información |

---

## 16. MATRIZ DE NORMALIZACIÓN (matching Excel ↔ Supabase)

| Excel | Supabase | Probabilidad | Evidencia | Acción requerida |
|---|---|---|---|---|
| burger (student burger) | Burger Classic | >95% | Precio = $14.000, mismo concepto | ✅ Mapear |
| CLASSIC-BURGER | Burger Classic | 85% | Mismo concepto pero precio $13.000 | 🟡 Confirmar precio |
| perro clasicc | Perro Caliente | >95% | Precio = $8.000, mismo producto | ✅ Mapear |
| salchipapa | Papa en Espiral | 60% | Nombre diferente, precio diferente ($13k vs $8k) | 🔴 No mapear sin confirmación |
| PAN ARTESANAL (en recetas) | — | >95% = PAN hamburguesa ARTESANAL | Mismo costo $1.350 en "burger" con nombre completo | 🟡 Confirmar |
| PAN (COMBO-MINI) | — | <80% | Ambiguo: hamburguesa o perro | 🔴 No mapear |
| Salsa tomate (grande) | — | — | Precio $6,74/g | ✅ Insumo nuevo |
| salsa tomate  | — | — | Precio $12,79/g | 🟡 ¿Mismo o diferente? |
| PIMIENTA NERA | — | >95% = Pimienta Negra | Typo evidente | ✅ Importar con nombre corregido |
| Rripia / Ripia | — | >95% | Typo evidente | ✅ Importar con nombre corregido |
| SALSA INLESA | — | >95% = Salsa Inglesa | Typo evidente | ✅ Importar con nombre corregido |
| salcchicha rooster | — | 70% = Sanchicha mini cazadora | Posible mismo producto, doble typo | 🔴 No fusionar sin confirmación |
| chorizo | — | 75% ≠ chorizo don vitto | Precio diferente ($743 vs $593) | 🔴 Mantener separados |
| papa bolsa premiun | — | 90% = PAPA | Mismo costo/g $6,68 | 🟡 Confirmar |
| mayo grande | — | 70% = mayoneza | Precio diferente ($9 vs $14,70/g) | 🔴 No fusionar sin confirmación |
| queso duro | — | <70% = queso mosarrella | Son productos distintos | ✅ Son diferentes |

---

## 17. PLAN DE IMPORTACIÓN FUTURO

> ⚠️ **NO EJECUTAR. Solo referencia para cuando el propietario apruebe.**

### Paso 1 — Prerequisito de schema (1 migración)

| Tabla | Acción | Columna | Tipo | Motivo |
|---|---|---|---|---|
| insumos | ALTER TABLE (migración) | costo_unitario | numeric | Sin esto, no se puede calcular costo de receta ni margen |

### Paso 2 — Normalización de insumos

Insertar los 33 insumos listados en sección 13 con:
- `stock_actual = 0` (no inventar stock)
- `stock_minimo` = a definir por propietario
- `costo_unitario` = valor de EQUIVALENCIA
- `activo = true`

### Paso 3 — Proveedores (solo si propietario confirma datos)

| Proveedor | Acción |
|---|---|
| Chalo | INSERT con nombre = "Chalo" |
| Carnecol | INSERT con nombre = "Carnecol" |
| Olimpica | INSERT con nombre = "Olimpica" |
| Karen | INSERT con nombre = "Karen" |
| Samcol | INSERT con nombre = "Samcol" |

No añadir teléfonos ni datos de contacto no verificados.

### Paso 4 — Productos (solo los confirmados)

| Producto | Acción | Precio |
|---|---|---|
| Burger Classic | Ya existe — VERIFICAR precio ($13k o $14k) | ❓ |
| Perro Caliente | Ya existe — OK | $8.000 |
| Toci-Burger | INSERT nuevo | $15.000 |
| Salchipapa Especial | INSERT nuevo | $18.000 |
| Doble Carne | INSERT nuevo | $18.000 |
| Combo Mini | INSERT nuevo | $17.000 |
| Chicken-Burger | INSERT nuevo | ❓ |
| Salchipapa (vs Papa en Espiral) | ❓ Decidir | ❓ |
| Corn Dog Clásico | Ya existe — sin receta | Requiere info |

### Paso 5 — Recetas (por porción)

Para cada producto, insertar en `producto_insumos`:
- `producto_id` = UUID del producto
- `insumo_id` = UUID del insumo (previamente creado)
- `cantidad_por_unidad` = cantidad por 1 porción

Recetas que requieren división (lote → porción):
- perro clasicc ÷ 10
- CLASSIC-BURGER ÷ 10
- TOCI-BURGE ÷ 10
- CHICKEN-BURGER ÷ 5
- DOBLE-CARNE ÷ 10
- COMBO-MINI ÷ 2

### Paso 6 — Stock inicial

Realizar toma física real. Usar `movimientos_inventario` tipo AJUSTE con `motivo = "Stock inicial"`. NO asumir stock desde Excel.

### Paso 7 — Validación final

Verificar que costo calculado (Σ cantidad × costo_unitario) coincida con los totales del Excel para cada receta.

---

## 18. CHECKLIST DE PREGUNTAS AL PROPIETARIO

Antes de cualquier INSERT el propietario debe responder estas preguntas:

1. ☐ ¿La Burger Classic cuesta $13.000 o $14.000?
2. ☐ ¿La "Papa en Espiral" ($8k en sistema) ES la Salchipapa del Excel ($13k)? ¿O son dos productos distintos?
3. ☐ ¿Qué es "salsa x" ($600/ud)? ¿Qué es su contenido?
4. ☐ ¿La "Salsa tomate (grande)" ($6,74/g) y "salsa tomate" ($12,79/g) son el mismo producto o marcas distintas?
5. ☐ ¿Cuál es el precio de venta actual del Chicken-Burger?
6. ☐ ¿Qué es VULCANO? ¿Tiene receta? ¿Sigue en el menú?
7. ☐ ¿El ACEITE GIRASOL es el mismo que ACEITE ideal? Si no, ¿cuál es su precio?
8. ☐ ¿El "PAN" en COMBO-MINI es pan de hamburguesa o pan de perro?
9. ☐ ¿El Toci-Burger está activo en el menú actual?
10. ☐ ¿El Chicken-Burger está activo en el menú actual?
11. ☐ ¿El Doble Carne está activo en el menú actual?
12. ☐ ¿El Combo Mini está activo en el menú actual?
13. ☐ ¿El Corn Dog Clásico tiene receta? ¿Cuáles son sus ingredientes?
14. ☐ ¿"mayo grande" y "mayoneza" son el mismo producto?
15. ☐ ¿"chorizo" ($743/ud) y "chorizo don vitto" ($593/ud) — cuál se usa actualmente?
16. ☐ ¿"PAPA" y "papa bolsa premiun" son el mismo insumo?
17. ☐ ¿Se desea agregar `costo_unitario` a la tabla `insumos` para calcular márgenes?
18. ☐ ¿Cuál es el stock actual físico de cada insumo? (requiere toma física)

---

## VEREDICTO FINAL

| Categoría | Estado |
|---|---|
| 🟢 **LISTO PARA IMPORTAR** | 33 insumos de EQUIVALENCIA con precio verificado matemáticamente. No hay ambigüedad en su interpretación. |
| 🟡 **LISTO CON CONFIRMACIONES** | Recetas de Perro, Toci-Burger, Chicken-Burger, Doble Carne, Combo Mini, Salchipapa Especial — matemáticamente correctas, pero requieren que el propietario confirme: precio de venta, si están activos, y qué hacer con "salsa x". |
| 🔴 **NO IMPORTAR TODAVÍA** | Precio de Burger Classic (conflicto $13k/$14k), Salchipapa (conflicto nombre/precio con Supabase), VULCANO (sin datos), Corn Dog (sin receta), cualquier dato de stock (inventario booleano no convertible a numérico), salsa tomate (dos versiones), "salsa x" (identidad desconocida). |

**El propietario debe responder las 18 preguntas del checklist antes de que se ejecute cualquier INSERT.**

---

*Ningún dato fue modificado. Supabase: READ-ONLY. Código: READ-ONLY. Excel: READ-ONLY.*
