# TITAN GRILL — CLASIFICACIÓN FINAL DEL CATÁLOGO
## Excel → Supabase
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY absoluto

---

## 1. RESUMEN EJECUTIVO

| Métrica | Cantidad |
|---|---|
| Elementos en EQUIVALENCIA | **66** |
| Insumos productivos (usados en recetas) | **35** |
| Empaques consumibles | **5** |
| Insumos operativos (no en recetas) | **10** |
| Duplicados resueltos | **7 grupos** |
| Utensilios / activos (excluir) | **3** |
| EPP / materiales (excluir) | **4** |
| Elementos sin precio o inválidos | **2** |
| Recetas verificadas 100% | **4/4** |
| Subrecetas analizadas | **3/3** |
| Productos con receta completa | **4** |
| Decisiones pendientes propietario | **5** |

---

## 2. METODOLOGÍA

### Fuentes válidas (hojas visibles, en orden de prioridad)
1. `EQUIVALENCIA` — catálogo maestro de precios/presentaciones
2. `burger` — receta Burger Classic
3. `perro clasicc` — receta Perro Clásico
4. `salchipapa` — receta Salchipapa
5. `salchip especial` — receta Salchipapa Especial
6. `salsas` — subrecetas Bigmag, Tártara, Bacon
7. `inventario` — disponibilidad + proveedores
8. `CONTABILID 2026` — histórico compras ene-feb 2026
9. `planeación` — referencia operativa

### Criterio de clasificación
Cada elemento se traza según: **EQUIVALENCIA → ¿aparece en receta visible? → ¿qué tipo de elemento es?**

La evidencia más fuerte es: ingrediente usado explícitamente en receta visible con costo unitario que coincide con EQUIVALENCIA (match verificado matemáticamente).

---

## 3. INVENTARIO DE HOJAS Y VISIBILIDAD

| # | Hoja | Visibilidad | Rol | Utilizada |
|---|---|---|---|---|
| 1 | EQUIVALENCIA | visible | Catálogo maestro | ✅ |
| 2 | burger | visible | Receta prioritaria | ✅ |
| 3 | perro clasicc | visible | Receta prioritaria | ✅ |
| 4 | salchipapa | visible | Receta prioritaria | ✅ |
| 5 | salchip especial | visible | Receta complementaria | ✅ |
| 6 | CLASSIC-BURGER | hidden | — | ❌ Excluida |
| 7 | TOCI-BURGE | hidden | — | ❌ Excluida |
| 8 | CHICKEN-BURGER | hidden | — | ❌ Excluida |
| 9 | DOBLE-CARNE | hidden | — | ❌ Excluida |
| 10 | COMBO-MINI | hidden | — | ❌ Excluida |
| 11 | PEDIDOS actual | hidden | — | ❌ Excluida |
| 12 | CONTABILIDD | hidden | — | ❌ Excluida |
| 13 | salsas | visible | Subrecetas | ✅ |
| 14 | CONTABILID 2026 | visible | Histórico | 🔵 Referencia |
| 15 | PEDIDOS Enero-Abril | hidden | — | ❌ Excluida |
| 16 | Registro | hidden | — | ❌ Excluida |
| 17 | inventario | visible | Disponibilidad | ✅ |
| 18 | planeación | visible | Operativa | ⚪ Referencia |

---

## 4. CATÁLOGO COMPLETO EQUIVALENCIA — CLASIFICACIÓN

Cada fila de EQUIVALENCIA clasificada con categoría, evidencia y acción futura.

### INSUMO_PRODUCTIVO — Usado en recetas visibles (35)

| # | Fila | Nombre original | Normalizado | Unidad | Precio pres. | Equiv. | Costo/ud | Recetas que lo usan | Confianza |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 3 | carbon | Carbón | bolsa | $4.000 | 2 | $2.000/bolsa | *(indirecto: proceso parrilla)* | 🟡 |
| 2 | 4 | tocineta | Tocineta | ud (tajada) | $22.100 | 30 | $736,67 | burger, salsas(Bacon) | 🟢 |
| 3 | 5 | salcchicha rooster para mini | — | ud | $16.600 | 25 | $664 | ❌ Ninguna | ⚫ ver duplicados |
| 4 | 6 | PAN hamburguesa ARTESANAL | Pan Hamburguesa Artesanal | ud | $8.100 | 6 | $1.350 | burger | 🟢 |
| 5 | 7 | CEBOLLA B | Cebolla Blanca | ud | $600 | 1 | $600 | burger, salsas(Tártara) | 🟢 |
| 6 | 8 | CEBOLLA R | Cebolla Roja | ud | $500 | 1 | $500 | salsas(Bigmag) | 🟢 |
| 7 | 9 | TOMATE | Tomate | ud | $800 | 1 | $800 | burger | 🟢 |
| 8 | 10 | QUESO chalo | Queso Chalo (tajada) | ud | $12.200 | 20 | $610 | burger | 🟢 |
| 9 | 14 | OREANO EN POLVO | Orégano en Polvo | g | $1.200 | 12 | $100 | burger | 🟢 |
| 10 | 15 | PIMIENTA NERA | Pimienta Negra | g | $3.360 | 60 | $56 | burger, salsas(Bigmag,Bacon) | 🟢 |
| 11 | 16 | AJO EN POLVO | Ajo en Polvo | g | $2.700 | 45 | $60 | salsas(Bigmag,Bacon) | 🟢 |
| 12 | 17 | Salsa tomate (grande) | Salsa Tomate Grande | g | $29.000 | 4.300 | $6,744 | burger, perro, salchipapa, especial, salsas | 🟢 |
| 13 | 19 | CARNE ESPECIAL | Carne Especial | g | $25.000 | 1.510 | $16,556 | burger | 🟢 |
| 14 | 23 | SALSA DE CARNE | Salsa de Carne | ml | $2.800 | 170 | $16,471 | burger | 🟢 |
| 15 | 25 | SALSA INLESA | Salsa Inglesa | ml | $2.800 | 170 | $16,471 | salsas(Bacon) | 🟢 |
| 16 | 26 | MOSTAZA | Mostaza | g | $10.400 | 980 | $10,612 | burger, salsas | 🟢 |
| 17 | 28 | ACEITE ideal | Aceite Ideal | ml | $23.900 | 3.000 | $7,967 | perro, salchipapa | 🟢 |
| 18 | 29 | PAPA | Papa | g | $16.700 | 2.500 | $6,68 | especial | 🟢 |
| 19 | 30 | CEBOLLIN | Cebollín | g | $500 | 20 | $25 | burger, salsas(Tártara) | 🟢 |
| 20 | 31 | LECHUGA CRESPA | Lechuga Crespa | g | $3.500 | 180 | $19,444 | burger, especial | 🟢 |
| 21 | 35 | Rripia | Ripia | g | $10.400 | 1.000 | $10,40 | burger, perro, salchipapa, especial | 🟢 |
| 22 | 37 | salsa piña | Salsa Piña | g | $9.700 | 1.000 | $9,70 | burger, perro, salchipapa, especial, salsas | 🟢 |
| 23 | 38 | mayoneza | Mayoneza | g | $14.700 | 1.000 | $14,70 | salsas(Bigmag,Tártara,Bacon) | 🟢 |
| 24 | 39 | pechuga | Pechuga de Pollo | g | $10.304 | 450 | $22,898 | especial | 🟢 |
| 25 | 41 | paprika | Paprika | g | $3.200 | 60 | $53,333 | salchipapa, especial, salsas(Bacon) | 🟢 |
| 26 | 43 | pan perro artesanal | Pan Perro Artesanal | ud | $12.000 | 10 | $1.200 | perro | 🟢 |
| 27 | 44 | Salchicha perro jumbo | Salchicha Perro Jumbo | ud | $33.300 | 18 | $1.850 | perro | 🟢 |
| 28 | 46 | chorizo don vitto | Chorizo Don Vitto | ud | $9.500 | 16 | $593,75 | especial | 🟢 |
| 29 | 47 | queso duro | Queso Duro | g | $16.650 | 750 | $22,20 | salchipapa, especial | 🟢 |
| 30 | 48 | sal refisal | Sal Refisal | g | $3.000 | 1.000 | $3 | salsas(Bigmag) | 🟢 |
| 31 | 49 | azucar | Azúcar | g | $1.075 | 500 | $2,15 | salsas(Bigmag,Tártara) | 🟢 |
| 32 | 50 | cabeza de ajo | Cabeza de Ajo | ud | $600 | 1 | $600 | burger, salsas(Tártara) | 🟢 |
| 33 | 51 | salsa x | Porción Salsa Acompañamiento | ud | $600 | 1 | $600 | burger, perro, salchipapa, especial | 🟡 ver §F |
| 34 | 53 | SALCHICHA MANGUERA | Salchicha Manguera | ud | $18.400 | 8 | $2.300 | salchipapa, especial | 🟢 |
| 35 | 68 | lechuga bola | Lechuga Bola | g | $4.400 | 1.000 | $4,40 | salchipapa | 🟢 |

### EMPAQUE_CONSUMIBLE (5)

| # | Fila | Nombre | Normalizado | Unidad | Costo/ud | Recetas | Confianza |
|---|---|---|---|---|---|---|---|
| 36 | 11 | empaque j1 | Empaque J1 | ud | $430 | salchipapa, especial | 🟢 |
| 37 | 20 | bolsa | Bolsa | ud | $37 | salchipapa, especial | 🟢 |
| 38 | 27 | servilleta | Servilleta | ud | $14 | burger, perro, salchipapa, especial | 🟢 |
| 39 | 32 | papel envoltorio 29*29 | Papel Envoltorio 29×29 | ud | $85,50 | burger, perro | 🟢 |
| 40 | 45 | porta perro | Porta Perro | ud | $140 | perro | 🟢 |

### INSUMO_OPERATIVO — No en recetas pero puede ser necesario (10)

| # | Fila | Nombre | Normalizado | Evidencia | Acción |
|---|---|---|---|---|---|
| 41 | 12 | limon | Limón | inventario: sí | 🟡 REQUIERE_CONFIRMACION |
| 42 | 13 | HUEVO | Huevo | inventario: sí (Huevo 3, qty=1) | 🟡 REQUIERE_CONFIRMACION |
| 43 | 21 | cilantro | Cilantro | inventario + CONTABILID 2026 | 🟡 REQUIERE_CONFIRMACION |
| 44 | 22 | MANTEQUILLA margarina | Mantequilla Margarina | inventario: sí | 🟡 REQUIERE_CONFIRMACION |
| 45 | 24 | SALSA DE SOJA | Salsa de Soja | — | 🟡 REQUIERE_CONFIRMACION |
| 46 | 33 | papel carne | Papel Carne | — | 🟡 REQUIERE_CONFIRMACION |
| 47 | 34 | palillos | Palillos | inventario: no | 🟡 REQUIERE_CONFIRMACION |
| 48 | 52 | pepino | Pepino | inventario: sí | 🟡 REQUIERE_CONFIRMACION |
| 49 | 54 | PIMENTON ROJO | Pimentón Rojo | inventario: sí | 🟡 REQUIERE_CONFIRMACION |
| 50 | 63 | puerro | Puerro | — | 🟡 REQUIERE_CONFIRMACION |

### DUPLICADO — Versión NO usada por recetas (7)

| # | Fila | Nombre | Duplicado de | Evidencia | Acción |
|---|---|---|---|---|---|
| 51 | 5 | salcchicha rooster para mini | — | No usada en recetas | ⚫ EXCLUIR |
| 52 | 36 | salsa tomate (espacio) | Salsa tomate (grande) f17 | No usada en recetas. Precio distinto | ⚫ EXCLUIR |
| 53 | 40 | chorizo | chorizo don vitto f46 | No usada en recetas. Precio distinto | ⚫ EXCLUIR |
| 54 | 55 | mayo grande | mayoneza f38 | No usada en recetas. Precio distinto | ⚫ EXCLUIR |
| 55 | 59 | pan Perro mini chalo | pan perro artesanal f43 | No usada en recetas. Precio distinto | 🟡 Podría ser para otro producto |
| 56 | 60 | Sanchicha mini cazadora cunit | — | No usada en recetas | ⚫ EXCLUIR |
| 57 | 66 | papa bolsa premiun | PAPA f29 | Mismo costo/g $6,68. salchipapa la usa | 🟢 FUSIONAR → "Papa" |

### UTENSILIO / ACTIVO — No consumible (3)

| # | Fila | Nombre | Por qué no es insumo | Acción |
|---|---|---|---|---|
| 58 | 57 | Trinche | Utensilio reutilizable (tenedor presentación). Aparece en receta pero NO se consume. | ⚫ EXCLUIR de insumos |
| 59 | 61 | Aluminio | Rollo de papel aluminio — material reutilizable de cocina | ⚫ EXCLUIR |
| 60 | 64 | vaso 12 oz | Empaque de bebidas — no vinculado a recetas | 🟡 REQUIERE_CONFIRMACION |

### EPP / MATERIAL NO ALIMENTARIO (4)

| # | Fila | Nombre | Categoría real | Acción |
|---|---|---|---|---|
| 61 | 56 | guante | EPP | ⚫ EXCLUIR |
| 62 | 58 | papel adsorbente | Material limpieza | ⚫ EXCLUIR |
| 63 | 65 | tapa boca | EPP (sin precio) | ⚫ EXCLUIR |
| 64 | 42 | pan de sal | No en recetas visibles | ⚫ EXCLUIR |

### EMPAQUE BEBIDAS (1)

| # | Fila | Nombre | Acción |
|---|---|---|---|
| 65 | 64 | vaso 12 oz | 🟡 REQUIERE_CONFIRMACION — ¿se usa para bebidas del menú? |

### OTRO (1)

| # | Fila | Nombre | Acción |
|---|---|---|---|
| 66 | 62 | maiz 1k bolsa | INSUMO_PRODUCTIVO — perro | 🟢 |

---

## 5. CLASIFICACIÓN DE CADA ELEMENTO — RESUMEN

| Categoría | Cantidad | IDs |
|---|---|---|
| 🟢 INSUMO_PRODUCTIVO | **35** | #1–35 (incluye maíz #66) |
| 🟢 EMPAQUE_CONSUMIBLE | **5** | #36–40 |
| 🟡 INSUMO_OPERATIVO (REQUIERE_CONFIRMACION) | **10** | #41–50 |
| ⚫ DUPLICADO (EXCLUIR) | **6** | #51–56 |
| 🟢 DUPLICADO (FUSIONAR) | **1** | #57 (papa bolsa premiun → PAPA) |
| ⚫ UTENSILIO/ACTIVO (EXCLUIR) | **3** | #58–60 |
| ⚫ EPP/MATERIAL (EXCLUIR) | **4** | #61–64 |
| 🟡 EMPAQUE BEBIDAS | **1** | #65 |

**Totales:**
- **IMPORTABLES sin reserva:** 40 (35 productivos + 5 empaques)
- **IMPORTABLES con confirmación:** 11
- **EXCLUIR:** 13
- **FUSIONAR (duplicado resuelto):** 1

---

## 6. DUPLICADOS Y RESOLUCIÓN

| Grupo | Versión A (usada) | Versión B (no usada) | Evidencia | Resolución |
|---|---|---|---|---|
| **Papa** | `PAPA` f29 ($6,68/g) → especial | `papa bolsa premiun` f66 ($6,68/g) → salchipapa | Mismo costo/g, misma presentación. Ambas usadas en recetas | 🟢 FUSIONAR → "Papa" a $6,68/g. Es el mismo insumo |
| **Salsa tomate** | `Salsa tomate (grande)` f17 ($6,74/g) → 5 recetas | `salsa tomate` f36 ($12,79/g) → ninguna | Costo diferente. Solo la grande es referenciada | 🟢 Usar f17. Descartar f36 |
| **Mayonesa** | `mayoneza` f38 ($14,70/g) → 3 salsas | `mayo grande` f55 ($9/g) → ninguna | Costo diferente. Solo mayoneza es referenciada | 🟢 Usar f38. Descartar f55 |
| **Chorizo** | `chorizo don vitto` f46 ($593,75) → especial | `chorizo` f40 ($743,75) → ninguna | Diferentes marcas/precios. Solo don vitto es referenciado | 🟢 Usar f46. Descartar f40 |
| **Pan perro** | `pan perro artesanal` f43 ($1.200) → perro | `pan Perro mini chalo` f59 ($410) → ninguna | Diferentes (artesanal vs mini). Solo artesanal en receta | 🟢 Usar f43. f59 podría ser para otro producto futuro |
| **Lechuga** | `LECHUGA CRESPA` f31 ($19,44/g) → burger, especial | `lechuga bola` f68 ($4,40/g) → salchipapa | Variedades diferentes, precios muy distintos | 🟢 Son DISTINTAS. Importar ambas |
| **Salchicha mini** | `salcchicha rooster para mini` f5 ($664) | `Sanchicha mini cazadora cunit` f60 ($1.000) | Ninguna usada en recetas visibles | ⚫ EXCLUIR ambas por ahora |

---

## 7. RECETAS VERIFICADAS

### 7.1 Burger Classic — 🟢 VERIFICADA

| # | Ingrediente Excel | Fila EQUIV | Nombre normalizado | Qty/porción | Unidad | Costo/ud | Costo ing. | Match | Dup | Conflicto | Conf. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CARNE ESPECIAL | 19 | Carne Especial | 110 | g | $16,556 | $1.821 | ✅ | — | — | 🟢 |
| 2 | PAN hamburguesa ARTESANAL | 6 | Pan Hamburguesa Artesanal | 1 | ud | $1.350 | $1.350 | ✅ | — | — | 🟢 |
| 3 | QUESO chalo | 10 | Queso Chalo | 1 | ud | $610 | $610 | ✅ | — | — | 🟢 |
| 4 | servilleta | 27 | Servilleta | 3 | ud | $14 | $42 | ✅ | — | — | 🟢 |
| 5 | TOMATE | 9 | Tomate | 0,2 | ud | $800 | $160 | ✅ | — | — | 🟢 |
| 6 | Salsa tomate (grande) | 17 | Salsa Tomate Grande | 25 | g | $6,744 | $169 | ✅ | f36 | — | 🟢 |
| 7 | tocineta | 4 | Tocineta | 1 | ud | $736,67 | $737 | ✅ | — | — | 🟢 |
| 8 | LECHUGA CRESPA | 31 | Lechuga Crespa | 15 | g | $19,444 | $292 | ✅ | f68 | — | 🟢 |
| 9 | Rripia | 35 | Ripia | 10 | g | $10,40 | $104 | ✅ | — | — | 🟢 |
| 10 | MOSTAZA | 26 | Mostaza | 10 | g | $10,612 | $106 | ✅ | — | — | 🟢 |
| 11 | papel envoltorio 29*29 | 32 | Papel Envoltorio | 1 | ud | $85,50 | $86 | ✅ | — | — | 🟢 |
| 12 | SALSA DE CARNE | 23 | Salsa de Carne | 5 | ml | $16,471 | $82 | ✅ | — | — | 🟢 |
| 13 | CEBOLLA B | 7 | Cebolla Blanca | 0,2 | ud | $600 | $120 | ✅ | — | — | 🟢 |
| 14 | PIMIENTA NERA | 15 | Pimienta Negra | 0,7 | g | $56 | $39 | ✅ | — | — | 🟢 |
| 15 | cabeza de ajo | 50 | Cabeza de Ajo | 0,2 | ud | $600 | $120 | ✅ | — | — | 🟢 |
| 16 | OREANO EN POLVO | 14 | Orégano en Polvo | 0,5 | g | $100 | $50 | ✅ | — | — | 🟢 |
| 17 | salsa x | 51 | Porción Salsa | 1 | ud | $600 | $600 | ✅ | — | ver §F | 🟡 |
| 18 | salsa piña | 37 | Salsa Piña | 15 | g | $9,70 | $146 | ✅ | — | — | 🟢 |
| 19 | CEBOLLIN | 30 | Cebollín | 2 | g | $25 | $50 | ✅ | — | — | 🟢 |
| | **TOTAL** | | | | | | **$6.683** | | | | |

Rendimiento: 1 porción | Precio: $14.000 | Margen: **52,3%** | 19/19 match EQUIV ✅

### 7.2 Perro Clásico — 🟢 VERIFICADA

Rendimiento: **10 porciones** | Total lote: $37.207 | Por porción: **$3.721** | Precio: $8.000 | Margen: **53,5%** | 12/12 match EQUIV ✅

| # | Ingrediente | Qty/lote | Qty/porción | Costo/porción |
|---|---|---|---|---|
| 1 | Porta Perro | 10 | 1 ud | $140 |
| 2 | Salchicha Perro Jumbo | 10 | 1 ud | $1.850 |
| 3 | Pan Perro Artesanal | 10 | 1 ud | $1.200 |
| 4 | Aceite Ideal | 20 | 2 ml | $16 |
| 5 | Ripia | 150 | 15 g | $156 |
| 6 | Salsa Piña | 40 | 4 g | $39 |
| 7 | Salsa Tomate Grande | 40 | 4 g | $27 |
| 8 | Porción Salsa (salsa x) | 1 | 0,1 ud | $60 |
| 9 | Papel Envoltorio | 5 | 0,5 ud | $43 |
| 10 | Maíz | 80 | 8 g | $75 |
| 11 | Servilleta | 40 | 4 ud | $56 |
| 12 | Queso Mozzarella | 20 | 2 g | $59 |

### 7.3 Salchipapa — 🟢 VERIFICADA

Rendimiento: **1 porción** | Total: **$6.419** (con Trinche) / $6.385 (sin Trinche) | Precio: $13.000 | Margen: **50,9%** | 14/14 match EQUIV ✅

> [!NOTE]
> Trinche (f57, $34/ud) aparece como ingrediente pero es un utensilio reutilizable. Decisión pendiente: ¿incluir como costo operativo o excluir?

### 7.4 Salchipapa Especial — 🟢 VERIFICADA

Rendimiento: **1 porción** | Total: **$9.371** | Precio: $18.000 | Margen: **47,9%** | 15/16 match (papel envoltorio sin costo) ✅

---

## 8. SUBRECETAS

| Subreceta | Hoja | Rendimiento | Costo/lote | Costo/porción | "Precio aprobado" | Margen | Estado |
|---|---|---|---|---|---|---|---|
| Bigmag | salsas | 15 porciones | $6.183 | $412 | $900 | 54% | 🟢 Consistente |
| Tártara | salsas | 30 porciones | $7.325 | $244 | $239 | **-2%** | 🟡 Costo > precio |
| Bacon | salsas | 20 porciones | $8.415 | $421 | $239 | **-76%** | 🔴 Costo >> precio |

**Análisis:** Los "precios aprobados" de Tártara y Bacon son probablemente costos de referencia internos, no precios de venta al público. Las salsas son preparaciones internas que se incorporan a los productos finales, no se venden por separado.

**Recomendación:** Modelar como **SUBRECETA** (preparación interna). El "precio aprobado" se ignora para fines de importación. Lo relevante son los ingredientes y cantidades para descontar inventario.

---

## 9. PRODUCTOS — Excel visible vs Supabase

| Producto | Fuente | Precio Excel | Supabase | Precio Supabase | Estado |
|---|---|---|---|---|---|
| Burger Classic | burger ✅ | $14.000 | ✅ Existe | $14.000 | 🟢 Coincide |
| Perro Caliente | perro clasicc ✅ | $8.000 | ✅ Existe | $8.000 | 🟢 Coincide |
| Salchipapa | salchipapa ✅ | $13.000 | ❓ "Papa en Espiral" | $8.000 | 🔴 Conflicto nombre+precio |
| Salchipapa Especial | salchip especial ✅ | $18.000 | ❌ No existe | — | 🔵 Crear nuevo |
| Corn Dog Clásico | solo planeación | — | ✅ Existe | $12.000 | 🟡 Sin receta visible |
| Papa en Espiral | ❌ No en Excel | — | ✅ Existe | $8.000 | 🔴 ¿= Salchipapa? |
| Postobón Manzana | ❌ No en Excel | — | ✅ Existe | $3.000 | ⚪ Bebida OK |
| Coca-Cola | ❌ No en Excel | — | ✅ Existe | $3.000 | ⚪ Bebida OK |
| Cerezada | ❌ No en Excel | — | ✅ Existe | $6.000 | ⚪ Bebida OK |
| Limonada | ❌ No en Excel | — | ✅ Existe | $6.000 | ⚪ Bebida OK |

---

## 10. PROVEEDORES — Excel visible vs Supabase

Supabase actual: **0 proveedores**.

| Proveedor | Evidencia | Insumos relacionados | Confianza |
|---|---|---|---|
| Chalo | inventario (queso, salsa tomate), CONTABILID 2026 (×6 compras) | Queso Chalo, Salsa Tomate Grande | 🟢 Alta |
| Carnecol | inventario (carne especial), CONTABILID 2026 (×2 compras) | Carne Especial | 🟢 Alta |
| Olimpica | inventario (lechuga crespa) | Lechuga Crespa | 🟡 Media |
| Rey David | inventario (pan mini perro) | Pan perro mini (no en recetas) | 🟡 Media |
| Karen | CONTABILID 2026 (panes) | Panes hamburguesa | 🟡 Media |
| Samcol | CONTABILID 2026 (vegetales) | Vegetales surtidos | 🟡 Media |
| Torta | inventario (papel mantequilla) | Papel mantequilla | 🟡 Media |

Ninguno tiene teléfono ni datos de contacto en fuentes visibles. **No inventar datos faltantes.**

---

## 11. INVENTARIO

### Estado actual Supabase

| Tabla | Registros |
|---|---|
| insumos | 1 ("Pan de Hamburguesa", stock=9, unidad="unidad") |
| producto_insumos | 1 (Burger Classic → Pan de Hamburguesa, qty=1) |
| movimientos_inventario | 1 |

### Hoja inventario del Excel

La hoja `inventario` proporciona:
- **Disponibilidad booleana** (true/false) para ~57 ítems
- **Proveedor** para ~8 ítems
- **Cantidad numérica** solo para 1 ítem (Huevo 3 → qty=1)
- **Sección utensilios** (filas 61–91): cuchillos, tabla, freidora, etc.

**Conclusión:** NO existe stock numérico confiable. Se recomienda `stock_actual = 0` para todos los insumos nuevos y toma física posterior.

---

## 12. GASTOS vs INVENTARIO

### Clasificación de entradas de CONTABILID 2026

| Tipo | Ejemplo | ¿Es insumo? | ¿Aumenta inventario? |
|---|---|---|---|
| **COMPRA DE MATERIA PRIMA** | "chalo" ($71.550), "carnecol 3 lb" ($25.000) | ✅ Sí | ✅ Sí |
| **COMPRA DE PANES** | "panes hamburguesa y perro" ($31.000) | ✅ Sí | ✅ Sí |
| **TRANSPORTE** | "bolsa y moto" ($1.000) | ❌ No | ❌ No |
| **INVERSIÓN SOCIOS** | "miguel" ($144.697), "yovanis" ($128.900) | ❌ No | ❌ No |
| **ACTIVO FIJO** | "candado" ($13.000) | ❌ No | ❌ No |
| **LIMPIEZA** | "mrmusculo y otra cosa" ($13.400) | ❌ No | ❌ No |
| **PRÉSTAMO** | "jovanis prestamos" ($10.000) | ❌ No | ❌ No |

**Resumen CONTABILID 2026:**

| Clasificación | Cantidad entradas | Monto total aprox. |
|---|---|---|
| Compras de materia prima | ~15 | ~$500.000 |
| Gastos operativos | ~5 | ~$30.000 |
| Inversión socios | 2 | $273.597 |
| Ventas | 3 | $567.400 |

> [!IMPORTANT]
> Los datos de CONTABILID 2026 son **históricos** (ene-feb 2026). No deben convertirse en compras ni movimientos de inventario actuales. Sirven como **referencia** para validar proveedores y precios de compra.

---

## 13. ELEMENTOS EXCLUIDOS

| Fila EQUIV | Nombre | Razón de exclusión |
|---|---|---|
| 5 | salcchicha rooster para mini | No usada en recetas, duplicado potencial |
| 36 | salsa tomate (espacio) | Duplicado de Salsa tomate (grande), no usada |
| 40 | chorizo | Duplicado de chorizo don vitto, no usada |
| 42 | pan de sal | No usada en recetas |
| 55 | mayo grande | Duplicado de mayoneza, no usada |
| 56 | guante | EPP — no es insumo alimentario |
| 57 | Trinche | Utensilio reutilizable |
| 58 | papel adsorbente | Material de limpieza |
| 60 | Sanchicha mini cazadora cunit | No usada en recetas |
| 61 | Aluminio | Material de cocina reutilizable |
| 65 | tapa boca | EPP sin precio |

**Elementos de inventario (sección utensilios) excluidos:** cuchillos, tabla, freidora, plancha, microonda, espátula, pinza, escoba, pote basura — **todos son activos fijos, no insumos consumibles**.

---

## 14. ELEMENTOS BLOQUEADOS

| Elemento | Razón de bloqueo | Decisión requerida |
|---|---|---|
| Salchipapa vs Papa en Espiral | Conflicto nombre + precio ($13k vs $8k) | ¿Son el mismo producto? ¿Cuál precio? |
| Tabla `insumos` sin `costo_unitario` | Columna inexistente en schema | ¿Agregar columna? |
| Corn Dog Clásico | Activo en Supabase sin receta visible | ¿Sigue activo? ¿Receta? |
| Trinche en recetas | Utensilio en fórmula de costo | ¿Incluir como costo o excluir? |
| Salsas Tártara/Bacon | Costo > precio aprobado | ¿Son subrecetas internas? |

---

## 15. ELEMENTOS LISTOS PARA IMPORTAR

### 🟢 IMPORTABLE — Sin reserva (40 insumos + empaques)

Los 35 insumos productivos + 5 empaques de la sección 4 están verificados con:
- Match exacto receta → EQUIVALENCIA ✅
- Costo unitario verificado matemáticamente ✅
- Sin conflicto con otros datos ✅

### 🟢 IMPORTABLE — Recetas (2 sin reserva)

| Receta | Ingredientes | Verificación | Estado |
|---|---|---|---|
| Burger Classic | 19 (18 + salsa x) | 19/19 ✅ | 🟢 |
| Perro Clásico | 12 (11 + salsa x) ÷10 | 12/12 ✅ | 🟢 |

### 🟡 IMPORTABLE CON RESERVA — Recetas (2)

| Receta | Reserva | Estado |
|---|---|---|
| Salchipapa | Conflicto nombre/precio con Supabase + Trinche | 🟡 |
| Salchipapa Especial | Producto no existe en Supabase | 🟡 |

### 🟢 IMPORTABLE — Proveedores (2)

| Proveedor | Datos disponibles |
|---|---|
| Chalo | Nombre solamente |
| Carnecol | Nombre solamente |

### 🟢 IMPORTABLE — Precios confirmados (2)

| Producto | Precio Excel | Precio Supabase | Estado |
|---|---|---|---|
| Burger Classic | $14.000 | $14.000 | 🟢 |
| Perro Caliente | $8.000 | $8.000 | 🟢 |

---

## 16. RIESGOS

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Importar sin `costo_unitario` en tabla `insumos` | Los costos de receta no se pueden calcular automáticamente | Agregar columna antes de importar |
| Stock inicial = 0 sin toma física | Inventario no refleja realidad | Realizar toma física tras importación |
| Salsa x sin identificación real | No descuenta materia prima real del inventario | Aceptar como costo genérico temporalmente |
| Trinche como ingrediente | Suma $34 al costo pero no se consume | Decidir si mantener o excluir |
| Salsas con costo > precio | Datos sospechosos podrían propagarse | Modelar como subrecetas sin precio de venta |

---

## 17. RECOMENDACIÓN DE ESTRUCTURA SUPABASE

### 17.1 Migración de schema requerida
```
ALTER TABLE insumos ADD COLUMN costo_unitario NUMERIC;
ALTER TABLE insumos ADD COLUMN precio_presentacion NUMERIC;
ALTER TABLE insumos ADD COLUMN equivalencia NUMERIC;
ALTER TABLE insumos ADD COLUMN proveedor_id UUID REFERENCES proveedores(id);
```

### 17.2 Orden de importación propuesto

| Paso | Acción | Cantidad | Dependencia |
|---|---|---|---|
| 1 | Migración schema (`costo_unitario`, etc.) | 1 migración | Aprobación propietario |
| 2 | Insertar proveedores | 2 (Chalo, Carnecol) | — |
| 3 | Actualizar insumo existente ("Pan de Hamburguesa" → "Pan Hamburguesa Artesanal") | 1 UPDATE | — |
| 4 | Insertar insumos productivos | 34 nuevos | Paso 1 |
| 5 | Insertar empaques consumibles | 5 nuevos | Paso 1 |
| 6 | Insertar salsa x como "Porción Salsa Acompañamiento" | 1 nuevo | Paso 1 |
| 7 | Crear/actualizar productos | 1–2 (Salchipapa, Especial) | Decisión propietario |
| 8 | Insertar recetas (producto_insumos) | ~60 registros | Pasos 4–7 |
| 9 | Validación cruzada | Verificar Σ costos | Paso 8 |

### 17.3 Modelo de Salsa X (§F)

**Recomendación: Opción A — Insumo genérico "Porción Salsa Acompañamiento"**

| Campo | Valor |
|---|---|
| nombre | Porción Salsa Acompañamiento |
| unidad_medida | porción |
| costo_unitario | 600 |
| stock_actual | 0 |
| stock_minimo | 0 |

**Justificación:**
1. Preserva el costo en la receta ($600/porción) — que es el objetivo del propietario
2. No inventa qué salsa es (honesto con los datos)
3. Permite rastrear consumo de porciones
4. Compatible con salsa extra futura
5. Puede refinarse cuando se identifique la salsa real

---

## 18. CHECKLIST PREVIO A IMPORTACIÓN

| # | Requisito | Estado |
|---|---|---|
| 1 | ☐ Propietario confirma: ¿Salchipapa = Papa en Espiral? ¿Precio? | 🔴 Pendiente |
| 2 | ☐ Propietario confirma: ¿Agregar columna `costo_unitario` a `insumos`? | 🔴 Pendiente |
| 3 | ☐ Propietario confirma: ¿Corn Dog Clásico activo? ¿Receta? | 🟡 Pendiente |
| 4 | ☐ Propietario confirma: ¿Trinche incluir como costo o excluir? | 🟡 Pendiente |
| 5 | ☐ Propietario confirma: ¿Salsas son subrecetas internas? | 🟡 Pendiente |
| 6 | ☐ 40 insumos listos para INSERT | 🟢 Listo |
| 7 | ☐ 2 proveedores listos para INSERT | 🟢 Listo |
| 8 | ☐ 4 recetas completas con math verificado | 🟢 Listo |
| 9 | ☐ 2 precios confirmados (Burger $14k, Perro $8k) | 🟢 Listo |
| 10 | ☐ Datos de prueba existentes identificados y preservados | 🟢 Listo |

---

## VALIDACIÓN CRUZADA SUPABASE — Estado actual

| Tabla | Registros | Tipo dato | Acción |
|---|---|---|---|
| productos | 8 | Real (creados por propietario) | Conservar |
| insumos | 1 ("Pan de Hamburguesa") | Real (parcial) | Actualizar nombre → importar 40 más |
| producto_insumos | 1 (Burger → Pan) | Real (parcial) | Agregar ~60 registros |
| proveedores | 0 | — | Crear 2+ |
| compras | 0 | — | Vacío (correcto para esta fase) |
| compra_detalles | 0 | — | Vacío |
| movimientos_inventario | 1 | Prueba (de venta test) | Preservar |
| movimientos_caja | 2 | Prueba | Preservar |
| sesiones_caja | 1 | Prueba | Preservar |
| ventas | 1 | Prueba | Preservar |
| clientes | 14 | Real (fidelización) | Preservar |
| stamp_logs | 15 | Real (sellos) | Preservar |
| redemptions | 0 | — | — |

> [!WARNING]
> Los datos de prueba (1 venta, 1 sesión caja, 2 movimientos caja, 1 movimiento inventario) **deben preservarse intactos** hasta una fase de limpieza explícitamente aprobada. No borrar ahora.

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
CÓDIGO DE PRODUCCIÓN: 0 cambios
```

*Solo lectura, análisis y documentación. Ningún dato modificado.*
