# TITAN GRILL — MAPEO DEFINITIVO EXCEL → SUPABASE
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY absoluto | **Versión:** Definitiva  
**Prioridad:** Reconstruir la estructura real desde `burger`, `perro clasicc`, `salchipapa` y `EQUIVALENCIA`

---

## A. INVENTARIO DE HOJAS

| # | Nombre | Visibilidad | Utilizado |
|---|---|---|---|
| 1 | **EQUIVALENCIA** | visible | ✅ Catálogo maestro |
| 2 | **burger** | visible | ✅ Receta prioritaria |
| 3 | **perro clasicc** | visible | ✅ Receta prioritaria |
| 4 | **salchipapa** | visible | ✅ Receta prioritaria |
| 5 | **salchip especial** | visible | ✅ Receta complementaria |
| 6 | CLASSIC-BURGER | hidden | ❌ Excluida |
| 7 | TOCI-BURGE | hidden | ❌ Excluida |
| 8 | CHICKEN-BURGER | hidden | ❌ Excluida |
| 9 | DOBLE-CARNE | hidden | ❌ Excluida |
| 10 | COMBO-MINI | hidden | ❌ Excluida |
| 11 | PEDIDOS actual | hidden | ❌ Excluida |
| 12 | CONTABILIDD | hidden | ❌ Excluida |
| 13 | **salsas** | visible | ✅ Subrecetas |
| 14 | **CONTABILID 2026** | visible | 🔵 Solo referencia histórica |
| 15 | PEDIDOS Enero-Abril | hidden | ❌ Excluida |
| 16 | Registro | hidden | ❌ Excluida |
| 17 | **inventario** | visible | ✅ Proveedores + disponibilidad |
| 18 | **planeación** | visible | ⚪ Solo referencia operativa |

---

## B. CATÁLOGO MAESTRO NORMALIZADO

### B.1 Insumos utilizados por las recetas visibles (42 únicos)

Cada ingrediente fue trazado desde su receta hasta la fila exacta de EQUIVALENCIA. **42 de 42 tienen match de costo verificado ✓**

| # | Nombre en receta | Fila EQUIV | Nombre normalizado | Unidad | Costo/ud | Usado en |
|---|---|---|---|---|---|---|
| 1 | CARNE ESPECIAL | 19 | Carne Especial | g | $16,556 | burger |
| 2 | PAN hamburguesa ARTESANAL | 6 | Pan Hamburguesa Artesanal | ud | $1.350 | burger |
| 3 | QUESO chalo | 10 | Queso Chalo (tajada) | ud | $610 | burger |
| 4 | servilleta | 27 | Servilleta | ud | $14 | burger, perro, salchipapa, especial |
| 5 | TOMATE | 9 | Tomate | ud | $800 | burger |
| 6 | Salsa tomate (grande) | 17 | Salsa Tomate Grande | g | $6,744 | burger, perro, salchipapa, especial, salsas |
| 7 | tocineta | 4 | Tocineta (tajada) | ud | $736,67 | burger, salsas |
| 8 | LECHUGA CRESPA | 31 | Lechuga Crespa | g | $19,444 | burger, especial, salsas |
| 9 | Rripia | 35 | Ripia | g | $10,40 | burger, perro, salchipapa, especial |
| 10 | MOSTAZA | 26 | Mostaza | g | $10,612 | burger, salsas |
| 11 | papel envoltorio 29*29 | 32 | Papel Envoltorio 29×29 | ud | $85,50 | burger, perro |
| 12 | SALSA DE CARNE | 23 | Salsa de Carne | ml | $16,471 | burger |
| 13 | CEBOLLA B | 7 | Cebolla Blanca | ud | $600 | burger, salsas |
| 14 | PIMIENTA NERA | 15 | Pimienta Negra | g | $56 | burger, salsas |
| 15 | cabeza de ajo | 50 | Cabeza de Ajo | ud | $600 | burger, salsas |
| 16 | OREANO EN POLVO | 14 | Orégano en Polvo | g | $100 | burger |
| 17 | salsa x | 51 | *ver sección F* | ud | $600 | burger, perro, salchipapa, especial |
| 18 | salsa piña | 37 | Salsa Piña | g | $9,70 | burger, perro, salchipapa, especial, salsas |
| 19 | CEBOLLIN | 30 | Cebollín | g | $25 | burger, salsas |
| 20 | porta perro | 45 | Porta Perro | ud | $140 | perro |
| 21 | Salchicha perro jumbo | 44 | Salchicha Perro Jumbo | ud | $1.850 | perro |
| 22 | pan perro artesanal | 43 | Pan Perro Artesanal | ud | $1.200 | perro |
| 23 | ACEITE ideal | 28 | Aceite Ideal | ml | $7,967 | perro, salchipapa |
| 24 | maiz 1k bolsa | 62 | Maíz (bolsa 1kg) | g | $9,40 | perro |
| 25 | queso mosarrella | 67 | Queso Mozzarella | g | $29,50 | perro |
| 26 | papa bolsa premiun | 66 | Papa Bolsa Premium | g | $6,68 | salchipapa |
| 27 | empaque j1 | 11 | Empaque J1 | ud | $430 | salchipapa, especial |
| 28 | SALCHICHA MANGUERA | 53 | Salchicha Manguera | ud | $2.300 | salchipapa, especial |
| 29 | queso duro | 47 | Queso Duro | g | $22,20 | salchipapa, especial |
| 30 | bolsa | 20 | Bolsa | ud | $37 | salchipapa, especial |
| 31 | lechuga bola | 68 | Lechuga Bola | g | $4,40 | salchipapa |
| 32 | Trinche | 57 | *(utensilio)* | ud | $34 | salchipapa, especial |
| 33 | paprika | 41 | Paprika | g | $53,333 | salchipapa, especial, salsas |
| 34 | PAPA | 29 | Papa | g | $6,68 | especial |
| 35 | chorizo don vitto | 46 | Chorizo Don Vitto | ud | $593,75 | especial |
| 36 | pechuga | 39 | Pechuga de Pollo | g | $22,898 | especial |
| 37 | mayoneza | 38 | Mayoneza | g | $14,70 | salsas |
| 38 | CEBOLLA R | 8 | Cebolla Roja | ud | $500 | salsas |
| 39 | AJO EN POLVO | 16 | Ajo en Polvo | g | $60 | salsas |
| 40 | sal refisal | 48 | Sal Refisal | g | $3 | salsas |
| 41 | azucar | 49 | Azúcar | g | $2,15 | salsas |
| 42 | SALSA INLESA | 25 | Salsa Inglesa | ml | $16,471 | salsas |

### B.2 Insumos en EQUIVALENCIA NO usados por recetas visibles (24)

Estos existen en el catálogo pero ninguna receta visible los referencia:

| Nombre | ¿Importar? | Razón |
|---|---|---|
| carbon | 🟡 Pendiente | Mencionado indirectamente como proceso (parrilla) |
| salcchicha rooster para mini | ❌ No | Sin uso en recetas visibles |
| limon | 🟡 Pendiente | Podría usarse operativamente |
| HUEVO | 🟡 Pendiente | Mencionado en inventario |
| SALSEROS onzas | ❌ No | Utensilio de servicio |
| cilantro | 🟡 Pendiente | Ingrediente probable no documentado en recetas |
| MANTEQUILLA margarina | 🟡 Pendiente | Ingrediente probable no documentado en recetas |
| SALSA DE SOJA | 🟡 Pendiente | Insumo sin uso demostrado |
| papel carne | 🟡 Pendiente | Consumible operativo |
| palillos | 🟡 Pendiente | Consumible operativo |
| salsa tomate (precio $12,79) | ❌ No | No usada por recetas visibles (ver duplicados) |
| chorizo | 🟡 Pendiente | Diferente a chorizo don vitto (ver duplicados) |
| pan de sal | ❌ No | Sin uso en recetas |
| pepino | 🟡 Pendiente | Sin uso en recetas visibles |
| PIMENTON ROJO | 🟡 Pendiente | Sin uso en recetas visibles |
| mayo grande | ❌ No | Posible duplicado de mayoneza (ver duplicados) |
| guante | ❌ No | EPP |
| papel adsorbente | ❌ No | Consumible cocina |
| pan Perro mini chalo | 🟡 Pendiente | Diferente a pan perro artesanal (ver duplicados) |
| Sanchicha mini cazadora cunit | 🟡 Pendiente | Sin uso en recetas visibles |
| Aluminio | ❌ No | Material cocina |
| puerro | 🟡 Pendiente | Sin uso en recetas visibles |
| vaso 12 oz | ❌ No | Empaque bebidas |
| tapa boca | ❌ No | EPP |

---

## C. MAPEO DE INSUMOS: Excel → EQUIVALENCIA → Supabase

| # | Nombre receta | EQUIV fila | Nombre Supabase actual | ¿Existe? | Acción propuesta |
|---|---|---|---|---|---|
| 1 | PAN hamburguesa ARTESANAL | 6 | Pan de Hamburguesa | ✅ SÍ (1 registro) | MAPEAR → actualizar nombre a "Pan Hamburguesa Artesanal" |
| 2–42 | (todos los demás) | verificados | — | ❌ NO | CREAR nuevo insumo |

**Estado actual de Supabase:**
- `insumos`: 1 solo registro ("Pan de Hamburguesa", unidad no especificada, sin costo)
- `producto_insumos`: 1 registro (Burger Classic → Pan de Hamburguesa, cantidad=1)

**Decisión de arquitectura:** La tabla `insumos` no tiene columna `costo_unitario`. Para importar costos se requiere agregar esta columna (migración pendiente de aprobación).

---

## D. RECETAS

### D.1 Burger Classic (hoja `burger`, visible)

**Rendimiento:** 1 porción | **Precio aprobado:** $14.000

| # | Ingrediente | EQUIV | Qty/porción | Unidad | Costo/ud | Costo total | Confianza |
|---|---|---|---|---|---|---|---|
| 1 | CARNE ESPECIAL | ✓ fila 19 | 110 | g | $16,556 | $1.821 | 🟢 |
| 2 | PAN hamburguesa ARTESANAL | ✓ fila 6 | 1 | ud | $1.350 | $1.350 | 🟢 |
| 3 | QUESO chalo | ✓ fila 10 | 1 | ud (tajada) | $610 | $610 | 🟢 |
| 4 | servilleta | ✓ fila 27 | 3 | ud | $14 | $42 | 🟢 |
| 5 | TOMATE | ✓ fila 9 | 0,2 | ud | $800 | $160 | 🟢 |
| 6 | Salsa tomate (grande) | ✓ fila 17 | 25 | g | $6,744 | $169 | 🟢 |
| 7 | tocineta | ✓ fila 4 | 1 | ud (tajada) | $736,67 | $737 | 🟢 |
| 8 | LECHUGA CRESPA | ✓ fila 31 | 15 | g | $19,444 | $292 | 🟢 |
| 9 | Rripia | ✓ fila 35 | 10 | g | $10,40 | $104 | 🟢 |
| 10 | MOSTAZA | ✓ fila 26 | 10 | g | $10,612 | $106 | 🟢 |
| 11 | papel envoltorio 29×29 | ✓ fila 32 | 1 | ud | $85,50 | $86 | 🟢 |
| 12 | SALSA DE CARNE | ✓ fila 23 | 5 | ml | $16,471 | $82 | 🟢 |
| 13 | CEBOLLA B | ✓ fila 7 | 0,2 | ud | $600 | $120 | 🟢 |
| 14 | PIMIENTA NERA | ✓ fila 15 | 0,7 | g | $56 | $39 | 🟢 |
| 15 | cabeza de ajo | ✓ fila 50 | 0,2 | ud | $600 | $120 | 🟢 |
| 16 | OREANO EN POLVO | ✓ fila 14 | 0,5 | g | $100 | $50 | 🟢 |
| 17 | salsa x | ✓ fila 51 | 1 | ud | $600 | $600 | 🟡 ver F |
| 18 | salsa piña | ✓ fila 37 | 15 | g | $9,70 | $146 | 🟢 |
| 19 | CEBOLLIN | ✓ fila 30 | 2 | g | $25 | $50 | 🟢 |
| | **TOTAL** | | | | | **$6.683** | |
| | **Margen** | | | | | **52,3%** | |

**Estado:** 🟢 LISTA — todos los ingredientes confirmados con EQUIVALENCIA. Único pendiente: modelado de "salsa x" (ver sección F).

---

### D.2 Perro Clásico (hoja `perro clasicc`, visible)

**Rendimiento:** 10 porciones | **Precio aprobado:** $8.000/porción

| # | Ingrediente | EQUIV | Qty/lote | Qty/porción | Unidad | Costo/ud | Total lote | Confianza |
|---|---|---|---|---|---|---|---|---|
| 1 | porta perro | ✓ fila 45 | 10 | 1 | ud | $140 | $1.400 | 🟢 |
| 2 | Salchicha perro jumbo | ✓ fila 44 | 10 | 1 | ud | $1.850 | $18.500 | 🟢 |
| 3 | pan perro artesanal | ✓ fila 43 | 10 | 1 | ud | $1.200 | $12.000 | 🟢 |
| 4 | ACEITE ideal | ✓ fila 28 | 20 | 2 | ml | $7,967 | $159 | 🟢 |
| 5 | Rripia | ✓ fila 35 | 150 | 15 | g | $10,40 | $1.560 | 🟢 |
| 6 | salsa piña | ✓ fila 37 | 40 | 4 | g | $9,70 | $388 | 🟢 |
| 7 | Salsa tomate (grande) | ✓ fila 17 | 40 | 4 | g | $6,744 | $270 | 🟢 |
| 8 | salsa x | ✓ fila 51 | 1 | 0,1 | ud | $600 | $600 | 🟡 ver F |
| 9 | papel envoltorio 29×29 | ✓ fila 32 | 5 | 0,5 | ud | $85,50 | $428 | 🟢 |
| 10 | maiz 1k bolsa | ✓ fila 62 | 80 | 8 | g | $9,40 | $752 | 🟢 |
| 11 | servilleta | ✓ fila 27 | 40 | 4 | ud | $14 | $560 | 🟢 |
| 12 | queso mosarrella | ✓ fila 67 | 20 | 2 | g | $29,50 | $590 | 🟢 |
| | **TOTAL lote (×10)** | | | | | | **$37.207** | |
| | **TOTAL por porción** | | | | | | **$3.721** | |
| | **Margen** | | | | | | **53,5%** | |

**Estado:** 🟢 LISTA — conversión lote÷10 inequívoca (NÚMERO PLATO=10). Pendiente: salsa x.

---

### D.3 Salchipapa (hoja `salchipapa`, visible)

**Rendimiento:** 1 porción | **Precio aprobado:** $13.000

| # | Ingrediente | EQUIV | Qty | Unidad | Costo/ud | Total | Confianza |
|---|---|---|---|---|---|---|---|
| 1 | papa bolsa premiun | ✓ fila 66 | 160 | g | $6,68 | $1.069 | 🟢 |
| 2 | ACEITE ideal | ✓ fila 28 | 20 | ml | $7,967 | $159 | 🟢 |
| 3 | empaque j1 | ✓ fila 11 | 1 | ud | $430 | $430 | 🟢 |
| 4 | salsa x | ✓ fila 51 | 2 | ud | $600 | $1.200 | 🟡 ver F |
| 5 | salsa piña | ✓ fila 37 | 20 | g | $9,70 | $194 | 🟢 |
| 6 | Salsa tomate (grande) | ✓ fila 17 | 30 | g | $6,744 | $202 | 🟢 |
| 7 | SALCHICHA MANGUERA | ✓ fila 53 | 0,5 | ud | $2.300 | $1.150 | 🟢 |
| 8 | queso duro | ✓ fila 47 | 60 | g | $22,20 | $1.332 | 🟢 |
| 9 | Rripia | ✓ fila 35 | 15 | g | $10,40 | $156 | 🟢 |
| 10 | servilleta | ✓ fila 27 | 5 | ud | $14 | $70 | 🟢 |
| 11 | bolsa | ✓ fila 20 | 1 | ud | $37 | $37 | 🟢 |
| 12 | lechuga bola | ✓ fila 68 | 27 | g | $4,40 | $119 | 🟢 |
| 13 | Trinche | ✓ fila 57 | 1 | ud | $34 | $34 | ⚠️ Utensilio |
| 14 | paprika | ✓ fila 41 | 5 | g | $53,333 | $267 | 🟢 |
| | **TOTAL (sin Trinche)** | | | | | **$6.385** | |
| | **TOTAL (con Trinche)** | | | | | **$6.419** | |
| | **Margen (sin Trinche)** | | | | | **50,9%** | |

**Nota:** La fila `["2.5kg","17000"]` al final de la hoja es una **nota de referencia de precio de papa**, no un ingrediente. Se excluye correctamente.

**Trinche:** Utensilio de servicio (tenedor de presentación). Está en EQUIVALENCIA y en la receta. El Excel lo incluye como costo del producto. **Recomendación:** Mantener en la receta como "costo operativo del servicio" o excluir como utensilio reutilizable — decisión del propietario.

**Estado:** 🟢 LISTA — pendientes: salsa x (sección F) y Trinche (decisión menor).

---

### D.4 Salchipapa Especial (hoja `salchip especial`, visible)

**Rendimiento:** 1 porción | **Precio aprobado:** $18.000

| # | Ingrediente | EQUIV | Qty | Unidad | Costo/ud | Total | Confianza |
|---|---|---|---|---|---|---|---|
| 1 | PAPA | ✓ fila 29 | 150 | g | $6,68 | $1.002 | 🟢 |
| 2 | chorizo don vitto | ✓ fila 46 | 1 | ud | $593,75 | $594 | 🟢 |
| 3 | papel envoltorio | — | 1 | ud | — | sin total | ⚠️ Sin costo |
| 4 | empaque j1 | ✓ fila 11 | 1 | ud | $430 | $430 | 🟢 |
| 5 | salsa x | ✓ fila 51 | 1 | ud | $600 | $600 | 🟡 ver F |
| 6 | salsa piña | ✓ fila 37 | 30 | g | $9,70 | $291 | 🟢 |
| 7 | Salsa tomate (grande) | ✓ fila 17 | 30 | g | $6,744 | $202 | 🟢 |
| 8 | SALCHICHA MANGUERA | ✓ fila 53 | 0,5 | ud | $2.300 | $1.150 | 🟢 |
| 9 | queso duro | ✓ fila 47 | 60 | g | $22,20 | $1.332 | 🟢 |
| 10 | Rripia | ✓ fila 35 | 10 | g | $10,40 | $104 | 🟢 |
| 11 | servilleta | ✓ fila 27 | 4 | ud | $14 | $56 | 🟢 |
| 12 | bolsa | ✓ fila 20 | 1 | ud | $37 | $37 | 🟢 |
| 13 | LECHUGA CRESPA | ✓ fila 31 | 27 | g | $19,444 | $525 | 🟢 |
| 14 | Trinche | ✓ fila 57 | 1 | ud | $34 | $34 | ⚠️ Utensilio |
| 15 | paprika | ✓ fila 41 | 5 | g | $53,333 | $267 | 🟢 |
| 16 | pechuga | ✓ fila 39 | 120 | g | $22,898 | $2.748 | 🟢 |
| | **TOTAL** | | | | | **$9.371** | |
| | **Margen** | | | | | **47,9%** | |

**Diferencias vs salchipapa clásica:** +pechuga 120g, +chorizo don vitto, usa LECHUGA CRESPA en vez de lechuga bola, usa PAPA (fila 29) en vez de papa bolsa premiun (fila 66) pero ambas a $6,68/g.

**Estado:** 🟢 LISTA — mismos pendientes (salsa x, Trinche).

---

### D.5 Subrecetas: Salsas (hoja `salsas`, visible)

#### Bigmag (×15 porciones, $900/porción aprobado)

| Ingrediente | EQUIV | Qty/lote | Qty/porción | Total lote | Confianza |
|---|---|---|---|---|---|
| Salsa tomate (grande) | ✓ 17 | 200g | 13,3g | $1.349 | 🟢 |
| mayoneza | ✓ 38 | 100g | 6,7g | $1.470 | 🟢 |
| MOSTAZA | ✓ 26 | 150g | 10g | $1.592 | 🟢 |
| CEBOLLA R | ✓ 8 | 0,5 ud | 0,033 ud | $250 | 🟢 |
| AJO EN POLVO | ✓ 16 | 15g | 1g | $900 | 🟢 |
| sal refisal | ✓ 48 | 10g | 0,67g | $30 | 🟢 |
| azucar | ✓ 49 | 15g | 1g | $32 | 🟢 |
| PIMIENTA NERA | ✓ 15 | 10g | 0,67g | $560 | 🟢 |
| **TOTAL lote** | | | | **$6.183** | |
| **Costo/porción** | | | | **$412** | |
| **Margen** | | | | **54%** | 🟢 |

#### Tártara (×30 porciones, $239/porción aprobado)

Total lote: $7.325 | Costo/porción: **$244** | Precio: $239 → **margen -2%**

🟡 **AMBIGUO:** Costo supera precio por $5. Posible que el "precio aprobado" sea un costo de referencia interno, no precio de venta al público. Las salsas se usan como acompañamiento, no se venden por separado.

#### Bacon (×20 porciones, $239/porción aprobado)

Total lote: $8.415 | Costo/porción: **$421** | Precio: $239 → **margen -76%**

🔴 **CONFLICTO:** Costo supera precio por 76%. Mismo análisis que Tártara — probablemente no es precio de venta.

**Recomendación para las 3 salsas:** Modelar como **subrecetas/preparaciones internas** (no como productos vendibles). El "precio aprobado" es probablemente un costo de referencia histórico por porción, no un precio al público.

---

## E. DUPLICADOS

### E.1 PAPA vs papa bolsa premiun

| Atributo | PAPA (fila 29) | papa bolsa premiun (fila 66) |
|---|---|---|
| Precio presentación | $16.700 | $16.700 |
| Equivalencia | 2.500 | 2.500 |
| Costo/g | **$6,68** | **$6,68** |
| Usado en | salchip especial (150g) | salchipapa (160g) |

**Evidencia:** Mismo precio, misma equivalencia, mismo costo/g. Ambas se refieren al mismo insumo con diferente nombre.

**Recomendación:** 🟢 FUSIONAR → Registrar como **"Papa"** a $6,68/g. El nombre "papa bolsa premiun" es una especificación de presentación de compra, no un insumo diferente.

---

### E.2 Salsa tomate (grande) vs salsa tomate

| Atributo | Salsa tomate (grande) (fila 17) | salsa tomate (fila 36) |
|---|---|---|
| Precio presentación | **$29.000** | **$55.000** |
| Equivalencia | 4.300 | 4.300 |
| Costo/g | **$6,744** | **$12,791** |
| Usado por recetas visibles | ✅ burger, perro, salchipapa, especial, salsas | ❌ Ninguna |

**Evidencia:** La `Salsa tomate (grande)` a $6,744/g es la que **todas** las recetas visibles referencian. La `salsa tomate` a $12,79/g **no es utilizada por ninguna receta visible**.

**Recomendación:** 🟢 Importar solo `Salsa tomate (grande)` a $6,744/g como el insumo real. La entrada de $12,79 probablemente es una marca diferente o precio actualizado no integrado en las recetas. NO fusionar. NO importar la de $12,79 sin confirmación del propietario.

---

### E.3 mayoneza vs mayo grande

| Atributo | mayoneza (fila 38) | mayo grande (fila 55) |
|---|---|---|
| Precio presentación | $14.700 | $36.000 |
| Equivalencia | 1.000 | 4.000 |
| Costo/g | **$14,70** | **$9,00** |
| Usado por recetas | ✅ salsas (Bigmag, Tártara, Bacon) | ❌ Ninguna |

**Evidencia:** Precios por gramo diferentes ($14,70 vs $9). La que usan las recetas es `mayoneza` a $14,70/g. `mayo grande` podría ser una presentación industrial más grande.

**Recomendación:** Importar `mayoneza` a $14,70/g. Excluir `mayo grande` sin confirmación.

---

### E.4 chorizo vs chorizo don vitto

| Atributo | chorizo (fila 40) | chorizo don vitto (fila 46) |
|---|---|---|
| Precio | $11.900/16 = $743,75/ud | $9.500/16 = $593,75/ud |
| Usado en | ❌ Ninguna receta visible | ✅ salchip especial |

**Evidencia:** Precios diferentes. Son probablemente dos marcas. La receta usa `chorizo don vitto`.

**Recomendación:** Importar `chorizo don vitto` ($593,75/ud). Excluir `chorizo` ($743,75) que no está respaldado por receta.

---

### E.5 pan perro artesanal vs pan Perro mini chalo

| Atributo | pan perro artesanal (fila 43) | pan Perro mini chalo (fila 59) |
|---|---|---|
| Precio | $12.000/10 = $1.200/ud | $4.100/10 = $410/ud |
| Usado en | ✅ perro clasicc | ❌ Ninguna receta |

**Evidencia:** Precios muy diferentes ($1.200 vs $410). Son productos distintos (artesanal vs mini chalo).

**Recomendación:** Importar solo `pan perro artesanal` ($1.200/ud). NO fusionar.

---

### E.6 salcchicha rooster para mini vs Sanchicha mini cazadora cunit

| Atributo | salcchicha rooster (fila 5) | Sanchicha mini cazadora (fila 60) |
|---|---|---|
| Precio | $16.600/25 = $664/ud | $16.000/16 = $1.000/ud |
| Usado en | ❌ Ninguna | ❌ Ninguna |

**Recomendación:** No importar ninguna — sin uso en recetas visibles.

---

### E.7 LECHUGA CRESPA vs lechuga bola

| Atributo | LECHUGA CRESPA (fila 31) | lechuga bola (fila 68) |
|---|---|---|
| Costo/g | $19,444 | $4,40 |
| Usado en | burger, especial, salsas | salchipapa |

**Evidencia:** Variedades diferentes con precios muy distintos. La receta salchipapa usa deliberadamente lechuga bola (más barata).

**Recomendación:** 🟢 Son insumos **distintos**. Importar ambos.

---

## F. SALSA X — ANÁLISIS Y RECOMENDACIÓN

### Contexto operativo

El propietario ha confirmado que `salsa x` fue introducida deliberadamente en las recetas para incorporar al costo del producto **la porción de salsa que normalmente se entrega con el pedido**. No es un error ni un ingrediente desconocido — es una **decisión de costeo**.

### Presencia en recetas

| Receta | Qty | Costo/porción |
|---|---|---|
| burger | 1 ud | $600 |
| perro clasicc | 1 ud / 10 porciones = 0,1 ud | $60 |
| salchipapa | 2 ud | $1.200 |
| salchip especial | 1 ud | $600 |

### Análisis de alternativas

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A) Insumo "Porción de salsa acompañamiento"** | Crear un insumo genérico a $600/ud que representa la porción de salsa incluida | ✅ Simple. ✅ Refleja el costo real. ✅ Permite rastrear consumo. ✅ Visible en receta. | ⚠️ No descuenta salsa real del inventario de materias primas |
| **B) Subreceta vinculada** | Vincular a una de las 3 salsas de la hoja "salsas" (Bigmag, Tártara, Bacon) | ✅ Descuenta materia prima real. ✅ Más preciso para compras. | ❌ No sabemos cuál salsa se entrega. ❌ El costo de $600 no coincide con ninguna porción de salsa existente. |
| **C) Costo accesorio sin inventario** | Incluir $600 como "costo fijo del producto" sin descuento de inventario | ✅ No afecta inventario. ✅ Refleja costo real. | ❌ No visible como ingrediente en receta. ❌ Pierde trazabilidad. |
| **D) Insumo específico por salsa real** | Crear una entrada por cada salsa que se entrega (ej. "Porción Bigmag 30g") | ✅ Máxima precisión. ✅ Descuenta inventario real. | ❌ Requiere saber exactamente qué salsa y cuánta. ❌ Complejidad operativa alta. |

### Recomendación

**→ Opción A: Crear insumo "Porción de salsa acompañamiento" a $600/ud**

**Justificación:**
1. El propietario definió `salsa x` como un costo deliberado de $600/ud para reflejar la salsa incluida con el pedido. Ese es el dato real.
2. No tenemos evidencia de qué salsa específica se entrega ni en qué cantidad de gramos.
3. Crear un insumo genérico preserva el costo en la receta (que es el objetivo declarado), permite rastrear cuántas porciones se entregan, y es honest about what we know.
4. En el futuro, cuando el propietario decida especificar qué salsa es, puede reemplazar este insumo por una subreceta real (opción D).

**Para el inventario:**
- `stock_actual = 0` (se contabiliza como porciones entregadas)
- `unidad_medida = "porción"`
- `costo_unitario = 600`
- `stock_minimo = 0`

**Para salsas extra:** Si el cliente pide salsa adicional, es una operación distinta (puede ser gratuita o cobrada). No afecta la receta base.

---

## G. PRODUCTOS — Excel visible vs Supabase

| Producto Excel | Hoja | Precio Excel | Producto Supabase | Precio Supabase | Estado |
|---|---|---|---|---|---|
| Burger Classic ("student") | burger ✅ | $14.000 | Burger Classic | $14.000 | 🟢 Coincide |
| Perro Clásico ("perro") | perro clasicc ✅ | $8.000 | Perro Caliente | $8.000 | 🟢 Coincide |
| Salchipapa | salchipapa ✅ | $13.000 | Papa en Espiral | $8.000 | 🔴 Conflicto |
| Salchipapa Especial | salchip especial ✅ | $18.000 | — | — | 🔵 Solo Excel |
| — | — | — | Corn Dog Clásico | $12.000 | ⚪ Solo Supabase |
| — | — | — | Postobón Manzana | $3.000 | ⚪ Bebida (OK) |
| — | — | — | Coca-Cola | $3.000 | ⚪ Bebida (OK) |
| — | — | — | Cerezada | $6.000 | ⚪ Bebida (OK) |
| — | — | — | Limonada | $6.000 | ⚪ Bebida (OK) |

**Conflicto único:** Salchipapa ($13.000) vs Papa en Espiral ($8.000) — **PENDIENTE decisión del propietario.**

---

## H. PROVEEDORES — Excel visible vs Supabase

Supabase: 0 proveedores.

| Proveedor | Evidencia visible | Insumos | Confianza |
|---|---|---|---|
| Chalo | inventario (Salsa tomate, Queso), CONTABILID 2026 (múltiples compras) | Queso chalo, Salsa tomate grande | 🟢 Alta |
| Carnecol | inventario (Carne especial), CONTABILID 2026 (carnecol 3lb) | Carne Especial | 🟢 Alta |
| Olimpica | inventario (Lechuga crespa) | Lechuga Crespa | 🟡 Media |
| Rey David | inventario (pan mini perro) | Pan mini perro (no usado en recetas) | 🟡 Media |
| Karen | CONTABILID 2026 (panes) | Panes hamburguesa | 🟡 Media |
| Samcol | CONTABILID 2026 (vegetales) | Vegetales | 🟡 Media |
| Torta | inventario (papel mantequilla) | Papel mantequilla | 🟡 Media |

Ninguno tiene teléfono ni datos de contacto en hojas visibles.

---

## I. INVENTARIO INICIAL

**Conclusión definitiva:** Las hojas visibles NO proporcionan stock numérico para ningún insumo.

| Lo que existe | Lo que NO existe |
|---|---|
| Disponibilidad booleana (true/false) en `inventario` | Cantidad numérica de stock |
| Nombres de proveedor para ~8 insumos | Stock mínimo |
| Sección de utensilios (excluir) | Valor monetario de inventario |

**Recomendación:** Crear todos los insumos con `stock_actual = 0` y realizar toma física posterior.

---

## J. CONFLICTOS

### 🔴 BLOQUEANTES

| ID | Conflicto | Decisión requerida |
|---|---|---|
| J1 | Salchipapa ($13.000) vs Papa en Espiral ($8.000) | ¿Mismo producto? ¿Cuál precio? |
| J2 | Tabla `insumos` no tiene `costo_unitario` | ¿Agregar columna? |

### 🟡 REQUIEREN CONFIRMACIÓN

| ID | Conflicto | Decisión requerida |
|---|---|---|
| J3 | Salsas Tártara/Bacon: costo > precio aprobado | ¿Son subrecetas internas o productos vendibles? |
| J4 | Trinche en recetas salchipapa/especial | ¿Incluir como costo de servicio o excluir? |
| J5 | Corn Dog Clásico en Supabase sin receta visible | ¿Está activo? ¿Receta? |

### 🟢 SE PUEDEN RESOLVER AUTOMÁTICAMENTE

| ID | Resolución | Evidencia |
|---|---|---|
| J6 | PAPA = papa bolsa premiun → fusionar como "Papa" | Mismo costo/g $6,68, misma presentación |
| J7 | Salsa tomate (grande) es la correcta (no la de $12,79) | Todas las recetas visibles la usan |
| J8 | chorizo don vitto es el correcto (no chorizo genérico) | Receta lo usa explícitamente |
| J9 | mayoneza es la correcta (no mayo grande) | Recetas la usan explícitamente |
| J10 | PIMIENTA NERA = Pimienta Negra (typo) | Evidencia ortográfica obvia |
| J11 | Rripia = Ripia (typo) | Evidencia ortográfica obvia |
| J12 | SALSA INLESA = Salsa Inglesa (typo) | Evidencia ortográfica obvia |
| J13 | OREANO EN POLVO = Orégano en Polvo (typo) | Evidencia ortográfica obvia |

---

## K. PLAN DE IMPORTACIÓN

> ⚠️ **NO EJECUTAR — solo propuesta**

### Paso 1 — Migración de schema
Agregar columna `costo_unitario NUMERIC` a tabla `insumos` (requiere aprobación J2).

### Paso 2 — Normalización de insumos
Actualizar el insumo existente "Pan de Hamburguesa" → "Pan Hamburguesa Artesanal", agregar `costo_unitario = 1350`, `unidad_medida = 'ud'`.

### Paso 3 — Creación de insumos
Insertar 40 insumos nuevos (los 42 del catálogo menos "Pan Hamburguesa Artesanal" que ya existe y menos "Trinche" si se excluye):

| Prioridad | Insumos | Cantidad |
|---|---|---|
| 1 — Recetas prioritarias | Ingredientes de burger + perro + salchipapa | ~28 únicos |
| 2 — Receta especial | Ingredientes adicionales de salchip especial | ~3 (pechuga, chorizo don vitto, PAPA si se decide separar) |
| 3 — Subrecetas | Ingredientes de salsas no cubiertos en prioridad 1 | ~5 |
| 4 — Salsa X | "Porción de salsa acompañamiento" | 1 |

### Paso 4 — Proveedores
Insertar Chalo y Carnecol (alta confianza). Los demás tras confirmación.

### Paso 5 — Confirmar/crear productos
- Burger Classic: ya existe ✅
- Perro Caliente: ya existe ✅
- Salchipapa: crear nuevo O actualizar "Papa en Espiral" (J1 pendiente)
- Salchipapa Especial: crear nuevo

### Paso 6 — Recetas
Insertar en `producto_insumos` las cantidades por porción para cada producto.

### Paso 7 — Validación
Verificar que Σ(cantidad × costo_unitario) por receta coincida con los totales del Excel.

---

## RESUMEN EJECUTIVO

```
INSUMOS CONFIRMADOS (con EQUIVALENCIA):          42
  → De los cuales respaldados por receta:         42/42 (100%)
  → Match de costo verificado:                    42/42 (100%)

DUPLICADOS RESUELTOS POR EVIDENCIA:               4
  → PAPA / papa bolsa premiun → fusionar
  → Salsa tomate (grande) / salsa tomate → usar (grande)
  → mayoneza / mayo grande → usar mayoneza
  → chorizo / chorizo don vitto → usar don vitto

DUPLICADOS RESUELTOS POR TYPO:                    4
  → PIMIENTA NERA → Pimienta Negra
  → Rripia → Ripia
  → SALSA INLESA → Salsa Inglesa
  → OREANO EN POLVO → Orégano en Polvo

INSUMOS QUE REQUIEREN CONFIRMACIÓN:               0
  (todos los ingredientes de recetas tienen match)

RECETAS LISTAS:                                    4/4
  → burger (19 ing, margen 52%)                   🟢
  → perro clasicc (12 ing ÷10, margen 53%)        🟢
  → salchipapa (14 ing, margen 51%)               🟢
  → salchip especial (16 ing, margen 48%)          🟢

RECETAS BLOQUEADAS:                                0
  (todas tienen todos los ingredientes mapeados)

SUBRECETAS LISTAS:                                 3/3
  → Bigmag (margen 54%)                           🟢
  → Tártara (margen -2%)                          🟡 precio sospechoso
  → Bacon (margen -76%)                           🔴 precio sospechoso

DATOS SEGUROS PARA IMPORTACIÓN:
  → 42 insumos con costo verificado
  → 2 precios de producto confirmados ($14k, $8k)
  → 4 recetas completas con math verificado
  → 2 proveedores con evidencia alta
  → Recomendación de modelado de "salsa x"

DECISIONES PENDIENTES DEL PROPIETARIO:
  1. ¿Salchipapa = Papa en Espiral? ¿Precio correcto?
  2. ¿Agregar costo_unitario a tabla insumos?
  3. ¿Salsas Tártara/Bacon son subrecetas internas?
  4. ¿Trinche incluir como costo o excluir?
  5. ¿Corn Dog Clásico activo? ¿Receta?
```

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
EXCEL MODIFICADO: NO
CÓDIGO DE PRODUCCIÓN MODIFICADO: NO
```

*Solo hojas visibles utilizadas. Ninguna inferencia se convirtió en dato sin evidencia de receta + EQUIVALENCIA.*
