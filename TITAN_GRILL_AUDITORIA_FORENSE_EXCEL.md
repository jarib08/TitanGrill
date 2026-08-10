# TITAN GRILL — AUDITORÍA FORENSE DEL EXCEL
**Fecha de auditoría:** 2026-08-08  
**Archivo auditado:** `costo titangrill.xlsx` (18 hojas)  
**Modo:** READ-ONLY — Supabase, Excel y código sin modificar  
**Auditor:** Antigravity  

---

## 1. RESUMEN EJECUTIVO

El Excel contiene la **historia operativa completa** de Titan Grill: recetas, costos de insumos, pedidos históricos, registros de compras y un inventario booleano de disponibilidad. Sin embargo, presenta múltiples problemas que impiden una importación directa y segura:

| Problema crítico | Cantidad detectada |
|---|---|
| Duplicados de nombre de insumo | 8 grupos |
| Unidades ambiguas o sin especificar | 12+ insumos |
| Recetas con rendimiento variable | 6 hojas |
| Precios con conflicto (misma hoja vs. EQUIVALENCIA) | 2 casos |
| Insumos en Excel no existentes en Supabase | ~65 |
| Productos en Excel sin equivalente exacto en Supabase | 5 |
| Productos en Supabase sin receta en Excel | 3 |
| Subrecetas no modeladas | 3 (Bigmag, Tártara, Bacon) |
| Stock real numérico conocido | 0 insumos |
| Inventario booleano únicamente | ~55 ítems |

> [!CAUTION]
> **NO importar nada hasta resolver los conflictos de unidad, los duplicados de nombre y confirmar los precios actuales con el propietario.**

---

## 2. INVENTARIO DE LAS 18 HOJAS

| # | Nombre hoja | Rango útil | Filas no vacías | Tipo de contenido | Categoría |
|---|---|---|---|---|---|
| 1 | EQUIVALENCIA | A3:G68 | ~66 | Maestro de insumos (precio, unidad, equivalencia) | A — CONFIRMADO |
| 2 | burger | A1:E31 | ~31 | Receta estándar — 1 porción | A/B |
| 3 | perro clasicc | A1:E24 | ~24 | Receta estándar — 10 porciones | A/B |
| 4 | salchipapa  | A1:E27 | ~27 | Receta estándar — 1 porción | A/B |
| 5 | salchip especial | A1:E28 | ~28 | Receta estándar — 1 porción | A/B |
| 6 | CLASSIC-BURGER | A1:E44 | ~44 | Receta estándar — 10 porciones | A/B |
| 7 | TOCI-BURGE | A1:E44 | ~44 | Receta estándar — 10 porciones | A/B |
| 8 | CHICKEN-BURGER | A1:E42 | ~42 | Receta estándar — 5 porciones | A/B |
| 9 | DOBLE-CARNE | A1:E43 | ~43 | Receta estándar — 10 porciones | A/B |
| 10 | COMBO-MINI | A1:E48 | ~48 | Receta estándar — 2 porciones | A/B |
| 11 | PEDIDOS actual | A1:AF148 | ~148 | Registro histórico de pedidos | F — HISTÓRICO |
| 12 | CONTABILIDD | A1:H55 | ~54 | Contabilidad general (período anterior) | F — HISTÓRICO |
| 13 | salsas | A1:E168 | ~61 | 3 subrecetas: Bigmag, Tártara, Bacon | B — PROBABLE |
| 14 | CONTABILID 2026 | A1:O60 | ~48 | Contabilidad 2026, inversiones socios | G — REFERENCIA |
| 15 | PEDIDOS Enero-Abril | A1:Z50 | ~50 | Registro histórico pedidos Ene-Abr | F — HISTÓRICO |
| 16 | Registro | A1:AA104 | ~104 | Registro de compras/inversión inicial | G — REFERENCIA |
| 17 | inventario | A2:H114 | ~108 | Inventario booleano (hay/no hay) | C — AMBIGUO |
| 18 | planeación  | A2:D30 | ~22 | Asignación de tareas entre socios | E — NO UTILIZABLE |

---

## 3. CATÁLOGO DE INSUMOS (desde EQUIVALENCIA + Recetas)

### 3.1 Tabla completa de insumos detectados en EQUIVALENCIA

| Nombre original Excel | Unidad presentación | Precio presentación | Equivalencia (unidades) | Costo unitario (calculado) | Nivel confianza |
|---|---|---|---|---|---|
| carbon | UNI | $4.000 | 2 bolsas | $2.000/bolsa | 🟡 MEDIA — unidad no especificada |
| tocineta | UNI | $22.100 | 30 tajadas | $736,67/tajada | 🟢 ALTA |
| salcchicha rooster para mini | UNI | $16.600 | 25 unidades | $664/ud | 🟡 MEDIA — nombre con typo |
| PAN hamburguesa ARTESANAL | UNI | $8.100 | 6 unidades | $1.350/ud | 🟢 ALTA |
| CEBOLLA B | UNI | $600 | 1 | $600/cabeza | 🟡 MEDIA — falta peso |
| CEBOLLA R | UNI | $500 | 1 | $500/cabeza | 🟡 MEDIA — falta peso |
| TOMATE | UNI | $800 | 1 | $800/unidad | 🟡 MEDIA — falta peso |
| QUESO chalo | UNI | $12.200 | 20 tajadas | $610/tajada | 🟢 ALTA |
| empaque j1 | UNI | $430 | 1 | $430/ud | 🟢 ALTA |
| limon | UNI | $600 | 1 | $600/ud | 🟡 MEDIA |
| HUEVO | UNI | $600 | 1 | $600/ud | 🟢 ALTA |
| OREANO EN POLVO | KG | $1.200 | 12 (¿g?) | $100/unidad | ⚠️ AMBIGUO — ¿12g o 12 porciones? |
| PIMIENTA NERA | KG | $3.360 | 60 (¿g?) | $56/g | 🟡 MEDIA — typo "NERA" |
| AJO EN POLVO | KG | $2.700 | 45 (¿g?) | $60/g | 🟡 MEDIA |
| Salsa tomate (grande) | KG | $29.000 | 4.300g | $6,74/g | 🟢 ALTA |
| SALSEROS onzas | UNI | $3.600 | 100 unidades | $36/salsero | 🟢 ALTA |
| CARNE ESPECIAL | KG | $25.000 | 1.510g | $16,56/g | ⚠️ REQUIERE CONFIRMACIÓN — ¿1.510g exactos? |
| bolsa | UNI | $3.700 | 100 bolsas | $37/bolsa | 🟢 ALTA |
| cilantro | KG | $500 | 35g | $14,29/g | 🟢 ALTA |
| MANTEQUILLA margarina | KG | $2.100 | 125g | $16,80/g | 🟢 ALTA |
| SALSA DE CARNE | LT | $2.800 | 170ml | $16,47/ml | 🟢 ALTA |
| SALSA DE SOJA | LT | $2.800 | 170ml | $16,47/ml | 🟢 ALTA |
| SALSA INLESA | LT | $2.800 | 170ml | $16,47/ml | 🟡 MEDIA — typo "INLESA" = inglesa |
| MOSTAZA | KG | $10.400 | 980g | $10,61/g | 🟢 ALTA |
| servilleta | UNI | $2.100 | 150 unidades | $14/servilleta | 🟢 ALTA |
| ACEITE ideal | LT | $23.900 | 3.000ml | $7,97/ml | 🟢 ALTA |
| PAPA | KG | $16.700 | 2.500g | $6,68/g | ⚠️ REQUIERE CONFIRMACIÓN — nota "800-454" ambigua |
| CEBOLLIN | KG | $500 | 20g | $25/g | 🟡 MEDIA |
| LECHUGA CRESPA | KG | $3.500 | 180g | $19,44/g | 🟢 ALTA |
| papel envoltorio 29*29 | UNI | $8.550 | 100 unidades | $85,50/ud | 🟢 ALTA |
| papel carne | UNI | $8.800 | 200 unidades | $44/ud | 🟢 ALTA |
| palillos | UNI | $1.100 | 180 palillos | $6,11/palillo | 🟢 ALTA |
| Rripia | KG | $10.400 | 1.000g | $10,40/g | ⚠️ REQUIERE CONFIRMACIÓN — typo "Rripia" = ripia/fritada |
| salsa tomate  | KG | $55.000 | 4.300g | $12,79/g | ⚠️ CONFLICTO con "Salsa tomate (grande)" |
| salsa piña | KG | $9.700 | 1.000g | $9,70/g | 🟢 ALTA |
| mayoneza | KG | $14.700 | 1.000g | $14,70/g | 🟢 ALTA |
| pechuga | KG | $10.304 | 450g | $22,90/g | 🟡 MEDIA |
| chorizo | UNI | $11.900 | 16 unidades | $743,75/ud | 🟡 MEDIA |
| paprika | KG | $3.200 | 60g | $53,33/g | 🟢 ALTA |
| pan de sal | UNI | $2.500 | 5 unidades | $500/ud | 🟢 ALTA |
| pan perro artesanal | UNI | $12.000 | 10 unidades | $1.200/ud | 🟢 ALTA |
| Salchicha perro jumbo | UNI | $33.300 | 18 unidades | $1.850/ud | 🟢 ALTA |
| porta perro | UNI | $2.800 | 20 unidades | $140/ud | 🟢 ALTA |
| chorizo don vitto | UNI | $9.500 | 16 unidades | $593,75/ud | 🟡 MEDIA — puede ser diferente a "chorizo" |
| queso duro | KG | $16.650 | 750g | $22,20/g | 🟢 ALTA |
| sal refisal | KG | $3.000 | 1.000g | $3/g | 🟢 ALTA |
| azucar | KG | $1.075 | 500g | $2,15/g | 🟢 ALTA |
| cabeza de ajo | UNI | $600 | 1 cabeza | $600/cabeza | 🟡 MEDIA |
| salsa x | UNI | $600 | 1 | $600/ud | 🔴 BAJA — no identificada |
| pepino | KG | $4.979 | 330g | $15,09/g | 🟢 ALTA |
| SALCHICHA MANGUERA | UNI | $18.400 | 8 unidades | $2.300/ud | 🟢 ALTA |
| PIMENTON ROJO | KG | $890 | 105g | $8,48/g | 🟢 ALTA |
| mayo grande | — | $36.000 | 4.000g | $9/g | 🟡 MEDIA — ¿igual a "mayoneza"? |
| guante | — | $1.800 | 6 unidades | $300/ud | G — no es insumo alimentario |
| Trinche | — | $3.400 | 100 unidades | $34/ud | G — utensilio |
| papel adsorbente | — | $4.000 | 100 unidades | $40/ud | G — consumible no alimentario |
| pan Perro mini chalo | — | $4.100 | 10 unidades | $410/ud | 🟡 MEDIA — ¿mismo que "pan perro artesanal"? |
| Sanchicha mini cazadora cunita | — | $16.000 | 16 unidades | $1.000/ud | ⚠️ REQUIERE CONFIRMACIÓN — typo, diferente a salchicha rooster |
| Aluminio | — | $5.100 | 1 rollo | $5.100 | G — consumible no alimentario |
| maiz 1k bolsa | — | $9.400 | 1.000g | $9,40/g | 🟢 ALTA |
| puerro | — | $10.400 | 1.000g | $10,40/g | 🟢 ALTA |
| vaso 12 oz | — | $3.100 | 50 vasos | $62/vaso | G — empaque bebidas |
| tapa boca | — | $0 | 1 | $0 | E — sin precio |
| papa bolsa premiun | — | $16.700 | 2.500g | $6,68/g | ⚠️ PROBABLE DUPLICADO con "PAPA" |
| queso mosarrella | — | $11.800 | 400g | $29,50/g | ⚠️ REQUIERE CONFIRMACIÓN |
| lechuga bola | — | $4.400 | 1.000g | $4,40/g | ⚠️ DIFERENTE de "LECHUGA CRESPA" |

---

## 4. DUPLICADOS Y NORMALIZACIÓN

> [!WARNING]
> Estos grupos requieren confirmación del propietario antes de cualquier importación.

### Grupo 1 — PAN hamburguesa (3 nombres diferentes)

| Nombre en Excel | Hoja fuente | Precio/unidad | ¿Son el mismo? |
|---|---|---|---|
| `PAN hamburguesa ARTESANAL` | EQUIVALENCIA | $1.350/ud | ⚠️ PROBABLE DUPLICADO |
| `PAN ARTESANAL` | CLASSIC-BURGER, TOCI-BURGE, CHICKEN-BURGER, DOBLE-CARNE | sin costo registrado | ⚠️ PROBABLE DUPLICADO |
| `PAN` | COMBO-MINI | sin costo registrado | ⚠️ AMBIGUO — ¿hamburguesa o perro? |
| `Pan hamburguesa` | inventario hoja | booleano | ⚠️ PROBABLE MISMO |

**Veredicto:** Todos parecen referirse al mismo insumo. Pero `PAN` en COMBO-MINI es ambiguo. 🔴 No importar sin confirmar.

### Grupo 2 — Salsa de tomate (2 entradas con precio diferente)

| Nombre | Hoja | Precio presentación | Precio/g |
|---|---|---|---|
| `Salsa tomate (grande)` | EQUIVALENCIA / varias recetas | $29.000/4.300g | $6,74/g |
| `salsa tomate ` (con espacio) | EQUIVALENCIA / varias recetas | $55.000/4.300g | $12,79/g |

**⚠️ CONFLICTO CRÍTICO:** Misma presentación (4.300g) pero precio DOBLE. El Excel tiene dos entradas distintas con el mismo volumen declarado. No se puede determinar cuál es actual.

### Grupo 3 — PAPA (2 entradas)

| Nombre | Presentación | Precio/g |
|---|---|---|
| `PAPA` | KG, nota "800-454" | $6,68/g |
| `papa bolsa premiun` | 2.500g | $6,68/g |

**Veredicto:** Costo unitario idéntico. Probablemente el mismo insumo con distinta presentación. 🟡 PROBABLE DUPLICADO.

### Grupo 4 — Chorizo (2 tipos)

| Nombre | Presentación | Costo/ud |
|---|---|---|
| `chorizo` | 16 unidades / $11.900 | $743,75 |
| `chorizo don vitto` | 16 unidades / $9.500 | $593,75 |

**Veredicto:** Son proveedores/marcas distintas. 🟢 Son insumos DIFERENTES. Requiere decidir cuál usar.

### Grupo 5 — Queso (3 tipos)

| Nombre | Precio/g |
|---|---|
| `QUESO chalo` (tajadas) | $610/tajada |
| `queso duro` | $22,20/g |
| `queso mosarrella` | $29,50/g |
| `queso costeño` (inventario) | sin precio |

**Veredicto:** Son productos diferentes. No son duplicados, son variedades distintas de queso.

### Grupo 6 — Salchicha (4 tipos)

| Nombre | Costo/ud | Uso en |
|---|---|---|
| `Salchicha perro jumbo` | $1.850/ud | perro clasicc |
| `salcchicha rooster para mini` | $664/ud | EQUIVALENCIA (typo) |
| `SALCHICHA MANGUERA` | $2.300/ud | salchipapa/especial |
| `Sanchicha mini cazadora cunita` | $1.000/ud | EQUIVALENCIA (typo) |
| `salchicha mini` | sin precio | inventario |

**Veredicto:** Son productos distintos. El "rooster para mini" y "Sanchicha mini cazadora cunita" probablemente son el mismo, pero el typo lo hace ambiguo. ⚠️

### Grupo 7 — Pan de perro (2 tipos)

| Nombre | Costo/ud |
|---|---|
| `pan perro artesanal` | $1.200/ud |
| `pan Perro mini chalo` | $410/ud |

**Veredicto:** Son distintos (artesanal vs. mini de proveedor Chalo).

### Grupo 8 — Mayonesa (2 entradas)

| Nombre | Precio |
|---|---|
| `mayoneza` | $14.700/kg → $14,70/g |
| `mayo grande` | $36.000/4.000g → $9/g |

**⚠️ CONFLICTO:** Precio por gramo diferente. ¿Son presentaciones diferentes del mismo producto? No confirmado.

---

## 5. UNIDADES Y CONVERSIONES

> [!IMPORTANT]
> Las recetas usan cantidades numéricas sin unidad de medida explícita en muchos casos. La columna "UNIDAD DE MEDIDA" en las hojas de receta aparece FUSIONADA con el nombre del producto en la exportación, haciendo que las unidades sean inferenciales.

### Regla detectada: las recetas usan GRAMOS para sólidos, ML para líquidos

Ejemplos de conversiones necesarias:

| Insumo | Cantidad en receta | Unidad probable | Costo unitario | Costo total (verificable) |
|---|---|---|---|---|
| CARNE ESPECIAL | 1.200 (CLASSIC-BURGER/10 porciones) | g | $16,56/g | $19.867 ✅ coincide |
| PAPA | 750 (CLASSIC-BURGER/10 porciones) | g | $6,68/g | $5.010 ✅ coincide |
| LECHUGA CRESPA | 70 (CLASSIC-BURGER/10 porciones) | g | $19,44/g | $1.361 ✅ coincide |
| MOSTAZA | 150 (CLASSIC-BURGER/10 porciones) | ml/g | $10,61/g | $1.591 ✅ coincide |
| carbon | 0,5 (CLASSIC-BURGER/10 porciones) | bolsas | $2.000/bolsa | $1.000 ✅ |
| MANTEQUILLA | 125 (CLASSIC-BURGER) | g | sin costo en receta | ⚠️ sin total |
| ACEITE GIRASOL | 666 (CLASSIC-BURGER) | ml | sin costo en receta | ⚠️ sin total |
| OREANO EN POLVO | 12 en EQUIVALENCIA | ¿g? ¿porciones? | $100/ud | ⚠️ AMBIGUO |

**Conversiones requeridas para importación:**

```
CARNE ESPECIAL: receta en g → Supabase unidad_medida = "g"
PAPA: receta en g → Supabase unidad_medida = "g"  
MOSTAZA: receta en ml/g → Supabase unidad_medida = "g"
QUESO chalo: receta en "unidades" (tajadas) → Supabase unidad_medida = "ud"
PAN hamburguesa: receta en "unidades" → Supabase unidad_medida = "ud"
carbon: receta en bolsas (0.5 bolsa) → ⚠️ REQUIERE CONFIRMACIÓN (fracción de bolsa)
```

---

## 6. PRODUCTOS — COMPARACIÓN EXCEL vs SUPABASE

### 6.1 Productos en Supabase (actuales)

| Nombre Supabase | Categoría | Precio | Tiene receta en BD |
|---|---|---|---|
| Burger Classic | Hamburguesas | $14.000 | ✅ (1 insumo: Pan de Hamburguesa) |
| Perro Caliente | Perros | $8.000 | ❌ |
| Corn Dog Clásico | Entradas | $12.000 | ❌ |
| Papa en Espiral | Entradas | $8.000 | ❌ |
| Postobón Manzana | Bebidas | $3.000 | ❌ (no requiere) |
| Coca-Cola | Bebidas | $3.000 | ❌ (no requiere) |
| Cerezada | Bebidas | $6.000 | ❌ (no requiere) |
| Limonada | Bebidas | $6.000 | ❌ (no requiere) |

### 6.2 Productos en Excel (hojas de receta)

| Nombre Excel | Hoja | Rendimiento | Precio aprobado Excel |
|---|---|---|---|
| burger (student burger) | burger | 1 porción | $14.000 |
| perro (perro clasicc) | perro clasicc | 10 porciones | $8.000 |
| Salchipapa | salchipapa  | 1 porción | $13.000 |
| Salchipapa Especial | salchip especial | 1 porción | $18.000 |
| classic (CLASSIC-BURGER) | CLASSIC-BURGER | 10 porciones | — (sin precio aprobado visible) |
| toci-burger | TOCI-BURGE | 10 porciones | — |
| chicken-burger | CHICKEN-BURGER | 5 porciones | — |
| doble carne | DOBLE-CARNE | 10 porciones | — |
| combo-mini | COMBO-MINI | 2 porciones | — |
| Bigmag (salsa) | salsas | 15 porciones | $900 (precio salsa) |
| tartara | salsas | 30 porciones | $239 |
| bacon | salsas | 20 porciones | $239 |

### 6.3 Tabla de cruce

| Producto Excel | Equivalente Supabase | Precio Excel | Precio Supabase | Estado |
|---|---|---|---|---|
| burger (student) | Burger Classic | $14.000 | $14.000 | ✅ COINCIDE |
| perro clasicc | Perro Caliente | $8.000 | $8.000 | ✅ COINCIDE |
| Salchipapa | Papa en Espiral | $13.000 | $8.000 | ⚠️ CONFLICTO PRECIO |
| Salchipapa Especial | ❌ No existe | $18.000 | — | 🔴 FALTANTE |
| classic (CLASSIC-BURGER) | Burger Classic | sin precio visible | $14.000 | 🟡 PROBABLE DUPLICADO DE HOJA |
| toci-burger | ❌ No existe | — | — | 🔴 FALTANTE o VARIANTE |
| chicken-burger | ❌ No existe | — | — | 🔴 FALTANTE o VARIANTE |
| doble carne | ❌ No existe | — | — | 🔴 FALTANTE o VARIANTE |
| combo-mini | ❌ No existe | — | — | 🔴 FALTANTE o VARIANTE |
| Corn Dog Clásico | ❌ No aparece en Excel | — | $12.000 | 🔴 Sin receta en Excel |

> [!IMPORTANT]
> El precio de **Salchipapa en Excel ($13.000) difiere del precio en Supabase ($8.000)** donde está mapeado a "Papa en Espiral". NO decidir cuál es correcto.

---

## 7. RECETAS — ANÁLISIS COMPLETO

### 7.1 Burger Classic (hoja "burger") — 1 PORCIÓN

| Ingrediente | Cantidad | Unidad probable | Costo unitario |
|---|---|---|---|
| CARNE ESPECIAL | 110 | g | $16,56/g = $1.821 |
| PAN hamburguesa ARTESANAL | 1 | ud | $1.350 |
| QUESO chalo | 1 | tajada | $610 |
| servilleta | 3 | ud | $42 |
| TOMATE | 0,2 | ud | $160 |
| Salsa tomate (grande) | 25 | ml/g | $168 |
| tocineta | 1 | tajada | $736 |
| LECHUGA CRESPA | 15 | g | $292 |
| Rripia | 10 | g | $104 |
| MOSTAZA | 10 | g | $106 |
| papel envoltorio 29*29 | 1 | ud | $85 |
| SALSA DE CARNE | 5 | ml | $82 |
| CEBOLLA B | 0,2 | ud | $120 |
| PIMIENTA NERA | 0,7 | g | $39 |
| cabeza de ajo | 0,2 | cabeza | $120 |
| OREANO EN POLVO | 0,5 | ? | $50 |
| salsa x | 1 | ud | $600 |
| salsa piña | 15 | g/ml | $146 |
| CEBOLLIN | 2 | g | $50 |

**Precio aprobado:** $14.000 | **Rendimiento:** 1 porción

### 7.2 Perro Clásico (hoja "perro clasicc") — 10 PORCIONES

| Ingrediente | Cantidad | Costo total lote |
|---|---|---|
| porta perro | 10 ud | $1.400 |
| Salchicha perro jumbo | 10 ud | $18.500 |
| pan perro artesanal | 10 ud | $12.000 |
| ACEITE ideal | 20 ml | $159 |
| Rripia | 150 g | $1.560 |
| salsa piña | 40 g/ml | $388 |
| Salsa tomate (grande) | 40 g | $270 |
| salsa x | 1 ud | $600 |
| papel envoltorio 29*29 | 5 ud | $428 |
| maiz 1k bolsa | 80 g | $752 |
| servilleta | 40 ud | $560 |
| queso mosarrella | 20 g | $590 |

**Precio aprobado:** $8.000 | **Rendimiento:** 10 porciones → **$800/porción implícito**

### 7.3 Salchipapa (hoja "salchipapa") — 1 PORCIÓN

| Ingrediente | Cantidad | Unidad |
|---|---|---|
| papa bolsa premiun | 160 | g |
| ACEITE ideal | 20 | ml |
| empaque j1 | 1 | ud |
| salsa x | 2 | ud |
| salsa piña | 20 | g |
| Salsa tomate (grande) | 30 | g |
| SALCHICHA MANGUERA | 0,5 | ud |
| queso duro | 60 | g |
| Rripia | 15 | g |
| servilleta | 5 | ud |
| bolsa | 1 | ud |
| lechuga bola | 27 | g |
| Trinche | 1 | ud |
| paprika | 5 | g |

**Precio aprobado:** $13.000 | ⚠️ Trinche es utensilio (no insumo consumible)

### 7.4 Salchipapa Especial (hoja "salchip especial") — 1 PORCIÓN

Mismo base que Salchipapa + `chorizo don vitto` + `pechuga 120g`. Sin precio visible para corn dog o equivalente en Supabase.

**Precio aprobado:** $18.000

### 7.5 CLASSIC-BURGER (hoja) — 10 PORCIONES
Similar a burger pero en lote de 10. Usa `ACEITE GIRASOL` sin costo en EQUIVALENCIA (⚠️ insumo sin precio).

### 7.6 TOCI-BURGE — 10 PORCIONES
Agrega `queso duro`, `CEBOLLIN`, `salsa piña`, `tocineta × 20` al lote. Sin precio aprobado.

### 7.7 CHICKEN-BURGER — 5 PORCIONES
Usa `pechuga 600g` en lugar de carne especial. Agrega `chorizo don vitto × 1`.

### 7.8 DOBLE-CARNE — 10 PORCIONES
2.400g carne especial (doble vs. CLASSIC). Agrega `SALSA DE SOJA`.

### 7.9 COMBO-MINI — 2 PORCIONES
Usa `PAN` (ambiguo), `HUEVO × 1`, `CEBOLLIN`, `SALSA DE CARNE`.

---

## 8. SUBRECETAS / SALSAS

La hoja `salsas` contiene 3 preparaciones intermedias que se usan como ingredientes en las recetas principales.

### 8.1 Bigmag — 15 porciones (precio $900/porción según Excel)

| Ingrediente | Cantidad | Unidad |
|---|---|---|
| Salsa tomate (grande) | 200 | g |
| mayoneza | 100 | g |
| MOSTAZA | 150 | g |
| CEBOLLA R | 0,5 | ud |
| AJO EN POLVO | 15 | g |
| sal refisal | 10 | g |
| azucar | 15 | g |
| PIMIENTA NERA | 10 | g |

### 8.2 Tártara — 30 porciones ($239/porción)

| Ingrediente | Cantidad |
|---|---|
| salsa piña | 20g |
| mayoneza | 400g |
| MOSTAZA | 40g |
| CEBOLLA B | 0,2 ud |
| CEBOLLIN | 15g |
| cabeza de ajo | 0,5 ud |
| azucar | 15g |

### 8.3 Bacon — 20 porciones ($239/porción)

| Ingrediente | Cantidad |
|---|---|
| tocineta | 4 tajadas |
| mayoneza | 200g |
| PIMIENTA NERA | 20g |
| AJO EN POLVO | 10g |
| MOSTAZA | 10g |
| paprika | 7g |
| SALSA INLESA | 20ml |

> [!IMPORTANT]
> Estas 3 salsas NO están modeladas en Supabase como subrecetas. El sistema actual no soporta "preparaciones intermedias" (PRODUCTO → PREPARACIÓN → INSUMOS). Si se importan directamente como insumos de receta, el inventario de mayoneza/mostaza/tomate NO se descontará correctamente cuando se vendan hamburguesas. **Requiere decisión de arquitectura antes de importar.**

---

## 9. PROVEEDORES

| Nombre detectado | Insumos asociados | Teléfono/contacto | Fuente | Confianza |
|---|---|---|---|---|
| Chalo | QUESO chalo, pan Perro mini chalo, Salsa tomate grande | ninguno | inventario, EQUIVALENCIA | 🟡 MEDIA |
| Carnecol | Carne especial 3 libra | ninguno | inventario | 🟡 MEDIA |
| Olimpica | Lechuga crespa | ninguno | inventario | 🟡 MEDIA |
| Rey David | pan mini perro | ninguno | inventario | 🟡 MEDIA |
| Torta | Papel mantequilla | ninguno | inventario | 🟡 MEDIA |
| Tienda | Pan de sal | ninguno | inventario | 🟡 MEDIA |
| Distribuidora 6 | (entrada vacía) | ninguno | inventario | 🔴 BAJA |
| Rappi | canal de ventas (no proveedor) | ninguno | CONTABILIDD | E — no es proveedor |

> [!NOTE]
> Ningún proveedor tiene teléfono, RUT, NIT ni datos formales en el Excel. Solo nombres coloquiales. Actualmente Supabase tiene 0 proveedores registrados.

---

## 10. COMPRAS Y COSTOS

### 10.1 Registro (hoja "Registro") — Inversión inicial

- Fecha base: serial Excel 45667 = **~agosto 2025** (inicio del negocio)
- Incluye: freidora ($589.950), utensilios, primeros insumos
- Estas son **compras de arranque**, no compras operativas recurrentes
- Total declarado: ~$1.417.566 | Ganancias: -$551.566 (pérdida inicial esperada)

### 10.2 CONTABILID 2026 — Inversión de socios

- Miguel: $144.697 | Yovanis: $128.900 (diferencia: $15.797)
- Compras recientes: panes (perros + hamburguesas) $31.000, chalo $11.800, carne 2lb $16.600
- Fechas serial Excel 46161 = **~enero 2026**

### 10.3 CONTABILIDD — Historial contable anterior

- Fechas seriales 45851-45857 = **~julio-agosto 2025**
- Movimientos de caja: ingresos Rappi, compras, ajustes
- **HISTÓRICO** — No importar como estado actual

### 10.4 Pedidos Enero-Abril (histórico)

- 59 pedidos registrados, total $866.000 en ventas
- Producto predominante: CLASSIC (hamburguesa)
- **F — HISTÓRICO** — Datos de operación pasada, no para importar

### 10.5 PEDIDOS actual

- Junio: 19 pedidos / $180.400 | Mayo: 23 pedidos / $319.000
- **F — HISTÓRICO** — No importar al sistema actual

---

## 11. INVENTARIO

> [!CAUTION]
> **El inventario de la hoja "inventario" es BOOLEANO** (columna "hay": true/false). No contiene cantidades numéricas reales para insumos alimentarios. **NO equivale a stock_actual numérico en Supabase.**

### 11.1 Insumos con `hay = true` (disponibles al momento del registro)

Salsa tomate grande, bolsa aluminio hamburguesa, Gorro, Queso chalo tajado, Ripia, Mayonesa, Mostaza, Mantequilla, tocineta, Chorizo, Pan de perros mini, Porta perro, Guantes, salchicha mini, bolsa, maiz, Tapaboca, butifarra, Servilleta, plato desechable-salchipapa, queso costeño, pan mini perro, Papel mantequilla, Arina multi uso, Levadura, papel envoltorio, Carne especial 3 libra, Pechuga 1 libra, Pan de sal, Huevo 3 (cantidad: 1), Carbón, Limón 3, Cebolla roja 1, Cilantro 1000, Pimentón, pepino, Ajo, aji, Lechuga crespa, Ajonjoli, Papel absorbente, miel.

### 11.2 Insumos con `hay = false` (no disponibles)

Salsa piña, Aceite freir, Queso mozarela, 3 manguera (salchicha manguera), salchica jumbo perro, Palilloo, Vinagre blanco, Papa 2,5kg, Cebolla blanca 2500L-3k, cebollin, Tomate, panko (empanizar).

### 11.3 Veredicto de inventario

El Excel **NO permite conocer el stock inicial real numérico** de ningún insumo. La columna "cantidad" está vacía para casi todos los ítems. Solo "Huevo 3" tiene cantidad = 1, y "Pan de sal" tiene lugar = "Tienda".

**El stock_actual de todos los insumos debe establecerse desde cero con toma física real.**

---

## 12. COMPARACIÓN EXCEL vs SUPABASE

### 12.1 Estado actual de Supabase

| Tabla | Estado |
|---|---|
| productos | 8 activos ✅ |
| insumos | 1 (solo "Pan de Hamburguesa") |
| producto_insumos | 1 receta (Burger Classic → Pan de Hamburguesa × 1 unidad) |
| proveedores | 0 registros |
| movimientos_inventario | 1 movimiento (VENTA) |

### 12.2 Schema de insumos en Supabase

Columnas: `id, nombre, unidad_medida, stock_actual, stock_minimo, activo`

⚠️ **COLUMNA FALTANTE:** La tabla `insumos` **NO tiene `costo_unitario`**. El Excel gestiona costos en EQUIVALENCIA. Para que el sistema calcule margen/costo de receta, se necesitaría agregar esta columna (requiere migración).

### 12.3 Insumos necesarios por receta (que faltan en Supabase)

Se necesitan al menos los siguientes insumos para completar las recetas de los 4 productos que requieren inventario:

| Insumo normalizado propuesto | Unidad Supabase | Fuente |
|---|---|---|
| Carne Especial | g | EQUIVALENCIA |
| Pan Hamburguesa Artesanal | ud | EQUIVALENCIA |
| Queso Chalo | ud (tajada) | EQUIVALENCIA |
| Tocineta | ud (tajada) | EQUIVALENCIA |
| Salchicha Perro Jumbo | ud | EQUIVALENCIA |
| Pan Perro Artesanal | ud | EQUIVALENCIA |
| Papa | g | EQUIVALENCIA |
| Lechuga Crespa | g | EQUIVALENCIA |
| Cebolla Blanca | ud | EQUIVALENCIA |
| Cebolla Roja | ud | EQUIVALENCIA |
| Tomate | ud | EQUIVALENCIA |
| Mostaza | g | EQUIVALENCIA |
| Mayoneza | g | EQUIVALENCIA |
| Salsa Tomate Grande | g | EQUIVALENCIA |
| Porta Perro | ud | EQUIVALENCIA |
| Maiz | g | EQUIVALENCIA |
| Queso Mozarela | g | EQUIVALENCIA |
| Papel Envoltorio 29×29 | ud | EQUIVALENCIA |
| Servilleta | ud | EQUIVALENCIA |
| Bolsa | ud | EQUIVALENCIA |
| Empaque J1 | ud | EQUIVALENCIA |
| Salsa Piña | g | EQUIVALENCIA |
| Carbón | bolsa | EQUIVALENCIA |
| SALCHICHA MANGUERA | ud | EQUIVALENCIA |
| Queso Duro | g | EQUIVALENCIA |
| Pechuga | g | EQUIVALENCIA |
| Chorizo Don Vitto | ud | EQUIVALENCIA |
| AJO EN POLVO | g | EQUIVALENCIA |
| PIMIENTA NEGRA | g | EQUIVALENCIA |
| OREGANO EN POLVO | g | EQUIVALENCIA |

---

## 13. CONFLICTOS ENCONTRADOS

| # | Conflicto | Hojas involucradas | Tipo |
|---|---|---|---|
| C1 | `salsa tomate ` vs `Salsa tomate (grande)`: misma presentación (4.300g) pero precios $29.000 vs $55.000 | EQUIVALENCIA | 🔴 CRÍTICO |
| C2 | Salchipapa precio: Excel $13.000 vs Supabase $8.000 | salchipapa vs Supabase | 🔴 CRÍTICO |
| C3 | `ACEITE GIRASOL` aparece en 4 recetas sin costo en EQUIVALENCIA | CLASSIC-BURGER, TOCI-BURGE, DOBLE-CARNE, COMBO-MINI | ⚠️ |
| C4 | `MANTEQUILLA` aparece en 5 recetas sin costo registrado en columna TOTAL | múltiples | ⚠️ |
| C5 | `PAN ARTESANAL` vs `PAN hamburguesa ARTESANAL` vs `PAN`: 3 nombres para posible mismo insumo | múltiples | ⚠️ |
| C6 | `mayo grande` ($9/g) vs `mayoneza` ($14,70/g): diferencia de precio significativa | EQUIVALENCIA | ⚠️ |
| C7 | `Rripia` / `Rripia` vs `Ripia` (inventario): typo en nombre | EQUIVALENCIA / inventario | ⚠️ |
| C8 | `SALSA INLESA` vs "Salsa Inglesa": typo | EQUIVALENCIA | ⚠️ |
| C9 | `PIMIENTA NERA` vs "Pimienta Negra": typo | EQUIVALENCIA | ⚠️ |
| C10 | `salcchicha rooster` vs `Sanchicha mini cazadora cunita`: posible mismo producto con doble typo | EQUIVALENCIA | ⚠️ |
| C11 | Receta COMBO-MINI usa `PAN` sin especificar tipo (¿hamburguesa? ¿perro?) | COMBO-MINI | ⚠️ |
| C12 | Corn Dog Clásico en Supabase sin ninguna referencia en Excel | Supabase vs Excel | 🔴 Sin datos |
| C13 | Limonada/Cerezada en Supabase marcadas como no requieren inventario — consistente con Excel (no aparecen en recetas) | — | ✅ OK |
| C14 | `salsa x` sin identificar: $600/ud pero no hay descripción | burger, perro, salchipapa | 🔴 BAJA |
| C15 | Insumos en recetas con costo 0 o sin total: MANTEQUILLA, ACEITE GIRASOL, papel envoltorio (en algunas hojas) | múltiples recetas | ⚠️ COSTO INCOMPLETO |

---

## 14. DATOS FALTANTES

1. **Stock numérico real** de TODOS los insumos (inventario booleano solamente)
2. **Costo unitario** de `ACEITE GIRASOL` (aparece en 4 recetas sin precio)
3. **Costo unitario** de `MANTEQUILLA` (sin total en varias recetas)
4. **Precio de venta** de TOCI-BURGE, CHICKEN-BURGER, DOBLE-CARNE, COMBO-MINI
5. **Receta de Corn Dog Clásico** (no existe en ninguna hoja Excel)
6. **Receta de bebidas preparadas** (Limonada, Cerezada — si tienen insumos)
7. **Teléfonos y datos** de proveedores (Chalo, Carnecol, Olimpica, Rey David)
8. **Identificación de "salsa x"** (aparece en burger, perro, salchipapa — $600/ud)
9. **Precio actual de Salchipapa** ($13.000 Excel vs $8.000 Supabase — cuál es vigente)
10. **Columna `costo_unitario` en tabla `insumos`** de Supabase (no existe actualmente)

---

## 15. DATOS QUE NO DEBEN IMPORTARSE

| Dato | Razón |
|---|---|
| Historial de pedidos (PEDIDOS actual, PEDIDOS Enero-Abril) | HISTÓRICO — ya operado |
| Contabilidad histórica (CONTABILIDD) | HISTÓRICO — período anterior |
| Planeación de tareas (planeación) | Irrelevante para sistema |
| Registro de compra inicial (Registro) | Inversión inicial, no inventario actual |
| Utensilios del inventario (cuchillo, tabla, freidora, etc.) | No son insumos consumibles |
| Stock booleano del inventario | NO equivale a cantidad numérica |
| `Trinche` como insumo de receta | Es utensilio, no se consume |
| `guante` como insumo de receta | Es EPP, no se consume |
| `tapa boca` / `Tapaboca` | EPP, precio $0 |
| `Aluminio` | Consumible de cocina, no de receta directa |
| `vaso 12 oz` | Solo si no hay producto de bebida que lo use |
| Salsa x ($600) | Identidad desconocida |
| `mayo grande` | Posible duplicado de mayoneza con precio diferente |

---

## 16. DATOS LISTOS PARA IMPORTAR

🟢 Pueden importarse con alta confianza una vez confirmada la columna `costo_unitario` en la BD:

**Insumos (de EQUIVALENCIA):**
- tocineta — $736,67/tajada
- QUESO chalo — $610/tajada
- empaque j1 — $430/ud
- servilleta — $14/ud
- MOSTAZA — $10,61/g
- ACEITE ideal — $7,97/ml
- CARNE ESPECIAL — $16,56/g *(confirmar 1.510g exactos)*
- bolsa — $37/ud
- MANTEQUILLA margarina — $16,80/g
- SALSA DE CARNE — $16,47/ml
- SALSA DE SOJA — $16,47/ml
- LECHUGA CRESPA — $19,44/g
- papel envoltorio 29*29 — $85,50/ud
- papel carne — $44/ud
- palillos — $6,11/ud
- salsa piña — $9,70/g
- mayoneza — $14,70/g
- AJO EN POLVO — $60/g
- paprika — $53,33/g
- sal refisal — $3/g
- azucar — $2,15/g
- CEBOLLIN — $25/g
- cilantro — $14,29/g
- Salchicha perro jumbo — $1.850/ud
- porta perro — $140/ud
- pan perro artesanal — $1.200/ud
- maiz 1k bolsa — $9,40/g
- queso mosarrella — $29,50/g
- PAN hamburguesa ARTESANAL — $1.350/ud
- queso duro — $22,20/g
- pechuga — $22,90/g
- chorizo don vitto — $593,75/ud
- SALCHICHA MANGUERA — $2.300/ud

---

## 17. DATOS QUE REQUIEREN CONFIRMACIÓN

| Dato | Acción requerida |
|---|---|
| `salsa tomate` vs `Salsa tomate (grande)` — precio doble | Propietario debe confirmar precio actual |
| `PAPA` vs `papa bolsa premiun` — ¿mismo insumo? | Confirmar si son la misma |
| `PAN ARTESANAL` vs `PAN hamburguesa ARTESANAL` | Confirmar si son el mismo insumo |
| `mayo grande` vs `mayoneza` | Confirmar si son el mismo producto |
| Precio Salchipapa ($13.000 o $8.000) | Propietario debe decidir precio vigente |
| TOCI-BURGE, CHICKEN-BURGER, DOBLE-CARNE, COMBO-MINI — ¿están en menú activo? | Confirmar si se venden o son históricas |
| Corn Dog Clásico — receta | Propietario debe proveer receta |
| `salsa x` — ¿qué es? | Identificar el insumo |
| `carbon` — ¿unidad de bolsa fraccionable? | Confirmar cómo registrar 0,5 bolsas |
| `CARNE ESPECIAL` — ¿1.510g por KG? | Confirmar gramaje exacto por kilo comprado |
| Salsas (Bigmag, Tártara, Bacon) — ¿se modelan como subrecetas? | Decisión de arquitectura |
| ¿Se requiere `costo_unitario` en tabla `insumos`? | Decisión de migración de BD |

---

## 18. RIESGOS DE INTERPRETACIÓN

1. **Riesgo de lote vs. porción:** Las recetas en CLASSIC-BURGER, TOCI-BURGE, DOBLE-CARNE, PERRO usan 10 porciones. Si se carga la receta sin dividir por 10, el descuento de inventario será 10x mayor de lo real.

2. **Riesgo de unidad de medida:** Las recetas no especifican la unidad en una columna separada. La unidad se infiere por contexto y verificación matemática. Cualquier error silencioso produciría stocks negativos o descuentos incorrectos.

3. **Riesgo de precio desactualizado:** La hoja EQUIVALENCIA no tiene fecha. Los precios pueden ser del período de inicio (ago 2025) y no reflejar el costo actual.

4. **Riesgo de subreceta:** Las salsas (Bigmag, Tártara, Bacon) no son insumos directos. Si se importan como si lo fueran, el inventario de mayoneza/mostaza/tomate no se descuentará por venta de hamburguesas.

5. **Riesgo de utensilios como insumos:** Trinche y guante aparecen en recetas de salchipapa. Si se modelan como insumos, Supabase descontará utensilios por cada venta — incorrecto.

6. **Riesgo de `stock_actual` falso:** El campo `stock_actual` de Pan de Hamburguesa en Supabase es 9. No está claro si ese valor es real o de prueba.

---

## 19. PROPUESTA DE ESTRUCTURA DE IMPORTACIÓN SEGURA

### Fase A — Migración de esquema (requiere migración Supabase)
1. Agregar columna `costo_unitario` a tabla `insumos` (si se desea tracking de margen)
2. Evaluar si se necesita tabla `sub_recetas` para salsas preparadas

### Fase B — Carga de insumos (solo los 🟢 confirmados)
1. Importar los ~33 insumos de EQUIVALENCIA con confianza alta
2. Asignar `unidad_medida` basado en la verificación matemática de las recetas
3. `stock_actual` = 0 para todos (toma física real posterior)
4. `stock_minimo` = a definir por el propietario

### Fase C — Confirmaciones requeridas (antes de continuar)
1. Resolver conflicto `salsa tomate` (C1)
2. Confirmar precio Salchipapa (C2)
3. Identificar `salsa x`
4. Confirmar nombres de pan hamburguesa
5. Confirmar si toci-burger, chicken-burger, doble carne están en menú activo

### Fase D — Carga de recetas
1. Cargar recetas POR PORCIÓN (dividir lotes de 10)
2. No cargar recetas de productos inexistentes en Supabase hasta crearlos
3. No cargar salsas como insumos directos hasta resolver arquitectura

### Fase E — Proveedores
1. Solicitar al propietario datos formales de Chalo, Carnecol, Olimpica, Rey David

### Fase F — Toma física de inventario
1. Contar físicamente cada insumo y actualizar `stock_actual`

---

## 20. CHECKLIST PREVIO A CUALQUIER INSERT

- [ ] Propietario confirmó: `salsa tomate` precio correcto ($29.000 o $55.000)
- [ ] Propietario confirmó: precio Salchipapa ($13.000 o $8.000)
- [ ] Propietario identificó qué es `salsa x`
- [ ] Propietario confirmó: PAN ARTESANAL = PAN hamburguesa ARTESANAL = mismo insumo
- [ ] Propietario confirmó: PAPA = papa bolsa premiun = mismo insumo
- [ ] Propietario confirmó: mayo grande = mayoneza (o son distintos)
- [ ] Propietario decidió: ¿se modela Bigmag/Tártara/Bacon como subreceta o como insumo compuesto?
- [ ] Propietario confirmó: ¿TOCI-BURGE, CHICKEN-BURGER, DOBLE-CARNE, COMBO-MINI están en menú activo?
- [ ] Propietario proveyó receta de Corn Dog Clásico
- [ ] Se decidió si agregar `costo_unitario` a tabla `insumos`
- [ ] Se eligió `unidad_medida` para cada insumo (g, ml, ud, bolsa)
- [ ] `stock_actual` = 0 para todos los insumos nuevos (no asumir del Excel)
- [ ] Todas las recetas divididas a 1 porción (no por lote de 10)
- [ ] Utensilios (Trinche, guantes, gorro) excluidos de tabla insumos
- [ ] Datos históricos (pedidos, contabilidad) marcados como NO importar

---

## ESTADO FINAL

| Item | Estado |
|---|---|
| SUPABASE MODIFICADO | **NO** |
| CÓDIGO MODIFICADO | **NO** |
| EXCEL MODIFICADO | **NO** |
| INSERTS | **NO** |
| UPDATES | **NO** |
| DELETES | **NO** |
| MIGRACIONES | **NO** |
| BUILD | **NO ejecutado** |
| **VEREDICTO** | **AUDITORÍA COMPLETADA — REQUIERE CONFIRMACIÓN DEL PROPIETARIO** |

---
*Reporte generado automáticamente. Ningún dato fue modificado en ningún sistema.*
