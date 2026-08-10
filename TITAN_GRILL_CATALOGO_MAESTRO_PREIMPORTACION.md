# TITAN GRILL — CATÁLOGO MAESTRO PRE-IMPORTACIÓN
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY absoluto  
**Fuentes:** Solo hojas visibles de `costo titangrill.xlsx` + Supabase actual (lectura)

---

## 1. RESUMEN EJECUTIVO

| Métrica | Valor |
|---|---|
| Hojas totales | 18 |
| Hojas visibles (fuente válida) | 8 |
| Hojas hidden (excluidas) | 10 |
| Elementos en EQUIVALENCIA | 66 |
| Insumos productivos confirmados | 34 |
| Empaques/consumibles | 5 |
| Insumos operativos (sin receta) | 10 |
| Duplicados detectados y resueltos | 7 grupos |
| Excluidos (utensilios/EPP/material) | 10 |
| Recetas verificadas (math 100%) | 4/4 |
| Subrecetas analizadas | 3 |
| Conflictos abiertos | 5 |
| Datos REQUIERE_CONFIRMACION | 15 |
| Registros Supabase existentes | 1 insumo, 8 productos, 1 receta |

---

## 2. INVENTARIO DE HOJAS Y ESTADOS

| # | Hoja | Estado | ¿Fuente válida? | Motivo |
|---|---|---|---|---|
| 1 | EQUIVALENCIA | visible | ✅ SÍ | Catálogo maestro de precios |
| 2 | burger | visible | ✅ SÍ | Receta prioritaria |
| 3 | perro clasicc | visible | ✅ SÍ | Receta prioritaria |
| 4 | salchipapa | visible | ✅ SÍ | Receta prioritaria |
| 5 | salchip especial | visible | ✅ SÍ | Receta complementaria |
| 6 | CLASSIC-BURGER | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 7 | TOCI-BURGE | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 8 | CHICKEN-BURGER | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 9 | DOBLE-CARNE | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 10 | COMBO-MINI | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 11 | PEDIDOS actual | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 12 | CONTABILIDD | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 13 | salsas | visible | ✅ SÍ | Subrecetas |
| 14 | CONTABILID 2026 | visible | 🔵 REF | Histórico compras ene-feb 2026 |
| 15 | PEDIDOS Enero-Abril | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 16 | Registro | hidden | ❌ NO | EXCLUIDA — HOJA OCULTA |
| 17 | inventario | visible | ✅ SÍ | Disponibilidad + proveedores |
| 18 | planeación | visible | ⚪ REF | Referencia operativa |

---

## 3. HOJAS VÁLIDAS

| Hoja | Contenido principal | Prioridad |
|---|---|---|
| EQUIVALENCIA | 66 ítems con precio presentación, equivalencia y costo/ud | 1 |
| burger | Receta Burger Classic (1 porción, 19 ingredientes) | 2 |
| perro clasicc | Receta Perro Clásico (lote ×10, 12 ingredientes) | 3 |
| salchipapa | Receta Salchipapa (1 porción, 14 ingredientes) | 4 |
| salchip especial | Receta Salchipapa Especial (1 porción, 16 ingredientes) | 5 |
| salsas | 3 subrecetas: Bigmag (×15), Tártara (×30), Bacon (×20) | 6 |
| inventario | Disponibilidad booleana + proveedores para ~57 ítems | 7 |
| CONTABILID 2026 | Compras y ventas ene-feb 2026 (histórico) | 8 |
| planeación | Tareas operativas asignadas | 9 |

## 4. HOJAS EXCLUIDAS

| Hoja | Estado | Contenido probable |
|---|---|---|
| CLASSIC-BURGER | hidden | Receta histórica |
| TOCI-BURGE | hidden | Receta histórica |
| CHICKEN-BURGER | hidden | Receta histórica |
| DOBLE-CARNE | hidden | Receta histórica |
| COMBO-MINI | hidden | Receta histórica |
| PEDIDOS actual | hidden | Pedidos |
| CONTABILIDD | hidden | Contabilidad antigua |
| PEDIDOS Enero-Abril | hidden | Pedidos históricos |
| Registro | hidden | Registro ventas |

Ninguna de estas hojas se utilizó para clasificar insumos, construir recetas ni determinar costos.

---

## 5. CATÁLOGO MAESTRO DE INSUMOS

### Metodología de trazabilidad

Para cada elemento de EQUIVALENCIA se aplicó:

```
EQUIVALENCIA[fila] → ¿aparece como ingrediente en receta visible?
                         SÍ → INSUMO_PRODUCTIVO (match costo ✓)
                         NO → ¿tipo de elemento?
                              Empaque → EMPAQUE_CONSUMIBLE
                              Alimento sin receta → INSUMO_OPERATIVO
                              Utensilio → NO_INSUMO
                              EPP/material → NO_INSUMO
                              Duplicado de otro → DUPLICADO
```

---

## 6. INGREDIENTES PRODUCTIVOS (34)

Cada uno verificado: nombre en receta → fila EQUIVALENCIA → costo unitario = precio_presentación ÷ equivalencia ✓

| ID | Fila | Nombre canónico | Unidad | Pres. | Costo/ud | Recetas | Conf. |
|---|---|---|---|---|---|---|---|
| IP01 | 4 | Tocineta | ud(tajada) | $22.100/30 | $736,67 | burger, salsas | 🟢 |
| IP02 | 6 | Pan Hamburguesa Artesanal | ud | $8.100/6 | $1.350 | burger | 🟢 |
| IP03 | 7 | Cebolla Blanca | ud | $600/1 | $600 | burger, salsas | 🟢 |
| IP04 | 8 | Cebolla Roja | ud | $500/1 | $500 | salsas | 🟢 |
| IP05 | 9 | Tomate | ud | $800/1 | $800 | burger | 🟢 |
| IP06 | 10 | Queso Chalo | ud(tajada) | $12.200/20 | $610 | burger | 🟢 |
| IP07 | 14 | Orégano en Polvo | g | $1.200/12 | $100 | burger | 🟢 |
| IP08 | 15 | Pimienta Negra | g | $3.360/60 | $56 | burger, salsas | 🟢 |
| IP09 | 16 | Ajo en Polvo | g | $2.700/45 | $60 | salsas | 🟢 |
| IP10 | 17 | Salsa Tomate Grande | g | $29.000/4.300 | $6,744 | burger, perro, salchipapa, especial, salsas | 🟢 |
| IP11 | 19 | Carne Especial | g | $25.000/1.510 | $16,556 | burger | 🟢 |
| IP12 | 23 | Salsa de Carne | ml | $2.800/170 | $16,471 | burger | 🟢 |
| IP13 | 25 | Salsa Inglesa | ml | $2.800/170 | $16,471 | salsas(Bacon) | 🟢 |
| IP14 | 26 | Mostaza | g | $10.400/980 | $10,612 | burger, salsas | 🟢 |
| IP15 | 28 | Aceite Ideal | ml | $23.900/3.000 | $7,967 | perro, salchipapa | 🟢 |
| IP16 | 29 | Papa | g | $16.700/2.500 | $6,68 | especial, salchipapa* | 🟢 |
| IP17 | 30 | Cebollín | g | $500/20 | $25 | burger, salsas | 🟢 |
| IP18 | 31 | Lechuga Crespa | g | $3.500/180 | $19,444 | burger, especial | 🟢 |
| IP19 | 35 | Ripia | g | $10.400/1.000 | $10,40 | burger, perro, salchipapa, especial | 🟢 |
| IP20 | 37 | Salsa Piña | g | $9.700/1.000 | $9,70 | burger, perro, salchipapa, especial, salsas | 🟢 |
| IP21 | 38 | Mayoneza | g | $14.700/1.000 | $14,70 | salsas | 🟢 |
| IP22 | 39 | Pechuga de Pollo | g | $10.304/450 | $22,898 | especial | 🟢 |
| IP23 | 41 | Paprika | g | $3.200/60 | $53,333 | salchipapa, especial, salsas | 🟢 |
| IP24 | 43 | Pan Perro Artesanal | ud | $12.000/10 | $1.200 | perro | 🟢 |
| IP25 | 44 | Salchicha Perro Jumbo | ud | $33.300/18 | $1.850 | perro | 🟢 |
| IP26 | 46 | Chorizo Don Vitto | ud | $9.500/16 | $593,75 | especial | 🟢 |
| IP27 | 47 | Queso Duro | g | $16.650/750 | $22,20 | salchipapa, especial | 🟢 |
| IP28 | 48 | Sal Refisal | g | $3.000/1.000 | $3 | salsas | 🟢 |
| IP29 | 49 | Azúcar | g | $1.075/500 | $2,15 | salsas | 🟢 |
| IP30 | 50 | Cabeza de Ajo | ud | $600/1 | $600 | burger, salsas | 🟢 |
| IP31 | 51 | Porción Salsa Acompañamiento | ud | $600/1 | $600 | burger, perro, salchipapa, especial | 🟡 ver §7 |
| IP32 | 53 | Salchicha Manguera | ud | $18.400/8 | $2.300 | salchipapa, especial | 🟢 |
| IP33 | 62 | Maíz (bolsa 1kg) | g | $9.400/1.000 | $9,40 | perro | 🟢 |
| IP34 | 67 | Queso Mozzarella | g | $11.800/400 | $29,50 | perro | 🟢 |
| — | 68 | Lechuga Bola | g | $4.400/1.000 | $4,40 | salchipapa | 🟢 |

*IP16: `papa bolsa premiun` (f66) fusionada con `PAPA` (f29) por mismo costo $6,68/g — ver §10.

---

## 7. EMPAQUES/CONSUMIBLES (5)

| ID | Fila | Nombre | Unidad | Costo/ud | Recetas | Conf. |
|---|---|---|---|---|---|---|
| EC01 | 11 | Empaque J1 | ud | $430 | salchipapa, especial | 🟢 |
| EC02 | 20 | Bolsa | ud | $37 | salchipapa, especial | 🟢 |
| EC03 | 27 | Servilleta | ud | $14 | burger, perro, salchipapa, especial | 🟢 |
| EC04 | 32 | Papel Envoltorio 29×29 | ud | $85,50 | burger, perro | 🟢 |
| EC05 | 45 | Porta Perro | ud | $140 | perro | 🟢 |

Todos aparecen explícitamente en recetas visibles y se descontarán automáticamente por venta.

---

## 8. INSUMOS OPERATIVOS (10)

Presentes en EQUIVALENCIA pero **sin uso demostrado en recetas visibles**:

| ID | Fila | Nombre | Evidencia adicional | Categoría | Acción |
|---|---|---|---|---|---|
| IO01 | 3 | Carbón | inventario: sí. Proceso parrilla | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO02 | 12 | Limón | inventario: sí | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO03 | 13 | Huevo | inventario: sí (Huevo 3, qty=1) | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO04 | 21 | Cilantro | inventario: sí, CONTABILID: sí | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO05 | 22 | Mantequilla Margarina | inventario: sí | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO06 | 24 | Salsa de Soja | — | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO07 | 33 | Papel Carne | — | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO08 | 34 | Palillos | inventario: no | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO09 | 52 | Pepino | inventario: sí | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |
| IO10 | 54 | Pimentón Rojo | inventario: sí | INSUMO_OPERATIVO | REQUIERE_CONFIRMACION |

Estos insumos **podrían** usarse operativamente pero ninguna receta visible los referencia. No crear vínculos a productos hasta que exista receta o regla.

---

## 9. ELEMENTOS EXCLUIDOS (10)

| Fila | Nombre | Razón | Categoría |
|---|---|---|---|
| 42 | pan de sal | No en recetas visibles | NO_INSUMO |
| 56 | guante | EPP | NO_INSUMO |
| 57 | Trinche | Utensilio reutilizable | NO_INSUMO |
| 58 | papel adsorbente | Material limpieza | NO_INSUMO |
| 61 | Aluminio | Material cocina reutilizable | NO_INSUMO |
| 63 | puerro | Sin uso en recetas, sin evidencia operativa | NO_INSUMO |
| 64 | vaso 12 oz | Empaque bebidas — sin vínculo a receta | REQUIERE_CONFIRMACION |
| 65 | tapa boca | EPP, sin precio | NO_INSUMO |
| 59 | pan Perro mini chalo | No en recetas, distinto a pan perro artesanal | NO_INSUMO |
| 60 | Sanchicha mini cazadora cunit | No en recetas | NO_INSUMO |

> [!NOTE]
> **Trinche** (f57, $34/ud) aparece en recetas salchipapa y especial como ítem de costo. Sin embargo, es un utensilio reutilizable (tenedor de presentación). Se excluye como insumo consumible. Si el propietario desea incluirlo como costo operativo del servicio, debe confirmarlo explícitamente.

---

## 10. DUPLICADOS DETECTADOS

| Grupo | Versión A | Fila | Versión B | Fila | Evidencia | Resolución |
|---|---|---|---|---|---|---|
| D1 | **PAPA** | 29 | papa bolsa premiun | 66 | Mismo costo $6,68/g, misma presentación $16.700/2.500 | 🟢 MISMO_INSUMO → usar "Papa" |
| D2 | **Salsa tomate (grande)** | 17 | salsa tomate | 36 | Costo diferente ($6,74 vs $12,79). Solo f17 usada en recetas | 🟢 Usar f17. f36 = NO_IMPORTAR |
| D3 | **mayoneza** | 38 | mayo grande | 55 | Costo diferente ($14,70 vs $9). Solo f38 usada en recetas | 🟢 Usar f38. f55 = NO_IMPORTAR |
| D4 | **chorizo don vitto** | 46 | chorizo | 40 | Precio diferente ($593 vs $743). Solo f46 usada en receta | 🟢 Usar f46. f40 = NO_IMPORTAR |
| D5 | **pan perro artesanal** | 43 | pan Perro mini chalo | 59 | Precio diferente ($1.200 vs $410). Son productos distintos. Solo f43 en receta | 🟢 INSUMOS_DISTINTOS. f59 = NO_IMPORTAR |
| D6 | **LECHUGA CRESPA** | 31 | lechuga bola | 68 | Variedades diferentes, precios muy distintos ($19,44 vs $4,40). Ambas en recetas | 🟢 INSUMOS_DISTINTOS. Importar ambas |
| D7 | salcchicha rooster para mini | 5 | Sanchicha mini cazadora | 60 | Ninguna en recetas visibles | ⚫ Ambas = NO_IMPORTAR |

---

## 11. MAPEO DEFINITIVO EXCEL → SUPABASE

### Insumos

| ID | Nombre canónico | ¿Existe en Supabase? | Registro actual | Acción |
|---|---|---|---|---|
| IP02 | Pan Hamburguesa Artesanal | ✅ SÍ | "Pan de Hamburguesa" (id: 73548bdb) | REUTILIZAR_EXISTENTE → actualizar nombre |
| IP01–IP34 (resto) | (ver §6) | ❌ NO | — | CREAR |
| EC01–EC05 | (ver §7) | ❌ NO | — | CREAR |

### Productos

| Producto | Supabase | ID Supabase | Precio Excel | Precio Supa | Acción |
|---|---|---|---|---|---|
| Burger Classic | ✅ | 5d362b34 | $14.000 | $14.000 | REUTILIZAR_EXISTENTE |
| Perro Caliente | ✅ | 4afe15e1 | $8.000 | $8.000 | REUTILIZAR_EXISTENTE |
| Salchipapa | ❓ | "Papa en Espiral" e3bbda11 | $13.000 | $8.000 | REQUIERE_CONFIRMACION |
| Salchipapa Especial | ❌ | — | $18.000 | — | CREAR |
| Corn Dog Clásico | ✅ | e33151a1 | — | $12.000 | REQUIERE_CONFIRMACION |
| Papa en Espiral | ✅ | e3bbda11 | ❓ | $8.000 | REQUIERE_CONFIRMACION |
| Postobón Manzana | ✅ | 9a0c464c | — | $3.000 | CONSERVAR (bebida, sin receta) |
| Coca-Cola | ✅ | e3427c88 | — | $3.000 | CONSERVAR |
| Cerezada | ✅ | 96876900 | — | $6.000 | CONSERVAR |
| Limonada | ✅ | ee1f155f | — | $6.000 | CONSERVAR |

---

## 12. PRODUCTOS — Detalle

### Burger Classic — 🟢 YA_EXISTE_Y_COINCIDE
Precio coincide ($14.000). Receta completa en Excel. Supabase solo tiene 1/19 ingredientes (Pan). Acción: completar receta.

### Perro Caliente — 🟢 YA_EXISTE_Y_COINCIDE
Precio coincide ($8.000). Receta completa en Excel (12 ing ÷10). Supabase tiene 0 ingredientes. Acción: crear receta.

### Salchipapa — 🔴 REQUIERE_CONFIRMACION
Excel: "Salchipapa" $13.000. Supabase: "Papa en Espiral" $8.000. ¿Mismo producto? ¿Cuál precio?

### Salchipapa Especial — 🟢 NUEVO_PRODUCTO_VALIDADO
Excel: $18.000, receta completa (16 ing). No existe en Supabase. Acción: crear.

### Corn Dog Clásico — 🟡 REQUIERE_CONFIRMACION
Existe en Supabase ($12.000, activo=true). No tiene receta en hojas visibles. Mencionado en planeación.

### Bebidas — ⚪ CONSERVAR
4 bebidas con `requiere_inventario = false`. No crear recetas artificiales.

---

## 13. RECETAS NORMALIZADAS

### 13.1 Burger Classic — Validación matemática

| # | Ingrediente | Qty | Ud | CU | Total Excel | Recalculado | Δ | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | Carne Especial | 110 | g | $16,556 | $1.821 | $1.821,19 | ≈0 | OK |
| 2 | Pan Hamburguesa Artesanal | 1 | ud | $1.350 | $1.350 | $1.350 | 0 | OK |
| 3 | Queso Chalo | 1 | ud | $610 | $610 | $610 | 0 | OK |
| 4 | Servilleta | 3 | ud | $14 | $42 | $42 | 0 | OK |
| 5 | Tomate | 0,2 | ud | $800 | $160 | $160 | 0 | OK |
| 6 | Salsa Tomate Grande | 25 | g | $6,744 | $169 | $168,60 | ≈0 | OK |
| 7 | Tocineta | 1 | ud | $736,67 | $737 | $736,67 | ≈0 | OK |
| 8 | Lechuga Crespa | 15 | g | $19,444 | $292 | $291,67 | ≈0 | OK |
| 9 | Ripia | 10 | g | $10,40 | $104 | $104 | 0 | OK |
| 10 | Mostaza | 10 | g | $10,612 | $106 | $106,12 | ≈0 | OK |
| 11 | Papel Envoltorio | 1 | ud | $85,50 | $86 | $85,50 | ≈0 | OK |
| 12 | Salsa de Carne | 5 | ml | $16,471 | $82 | $82,35 | ≈0 | OK |
| 13 | Cebolla Blanca | 0,2 | ud | $600 | $120 | $120 | 0 | OK |
| 14 | Pimienta Negra | 0,7 | g | $56 | $39 | $39,20 | ≈0 | OK |
| 15 | Cabeza de Ajo | 0,2 | ud | $600 | $120 | $120 | 0 | OK |
| 16 | Orégano en Polvo | 0,5 | g | $100 | $50 | $50 | 0 | OK |
| 17 | Porción Salsa (salsa x) | 1 | ud | $600 | $600 | $600 | 0 | OK |
| 18 | Salsa Piña | 15 | g | $9,70 | $146 | $145,50 | ≈0 | OK |
| 19 | Cebollín | 2 | g | $25 | $50 | $50 | 0 | OK |
| | **TOTAL** | | | | **$6.683** | **$6.682,80** | **≈0** | **OK** |

Diferencia total: ~$0,20 (redondeo). **VERIFICADA ✅**

### 13.2 Perro Clásico — Validación matemática

| Producto | Lote (×10) | Recalculado | Δ | Estado |
|---|---|---|---|---|
| Total lote | $37.207 | $37.207 | 0 | OK |
| Por porción | $3.720,70 | $3.720,70 | 0 | OK |

**VERIFICADA ✅** — 12/12 ingredientes match exacto.

### 13.3 Salchipapa — Validación matemática

| Producto | Total Excel | Recalculado (sin Trinche, sin nota papa) | Δ | Estado |
|---|---|---|---|---|
| Total real | $6.385 | $6.385 | 0 | OK |

Nota: Fila extra "2.5kg" = nota de referencia de precio, NO ingrediente. Trinche = utensilio, excluido.

**VERIFICADA ✅** — 13/13 ingredientes reales match exacto.

### 13.4 Salchipapa Especial — Validación matemática

| Producto | Total Excel | Recalculado | Δ | Estado |
|---|---|---|---|---|
| Total | $9.371 | $9.371 | 0 | OK |

**VERIFICADA ✅** — 15/15 ingredientes match exacto. "Papel envoltorio" sin costo = dato faltante menor.

### Subrecetas (salsas)

| Subreceta | Lote | Costo/lote | Costo/porción | "Precio" | Margen | Estado |
|---|---|---|---|---|---|---|
| Bigmag | ×15 | $6.183 | $412 | $900 | 54% | 🟢 OK |
| Tártara | ×30 | $7.325 | $244 | $239 | -2% | 🟡 Costo > precio |
| Bacon | ×20 | $8.415 | $421 | $239 | -76% | 🔴 Costo >> precio |

Recomendación: Modelar como subrecetas/preparaciones internas. El "precio aprobado" no es precio de venta al público.

---

## 14. PROVEEDORES

| Proveedor | Evidencia | Insumos | Teléfono | Contacto | Conf. | Acción |
|---|---|---|---|---|---|---|
| Chalo | inventario + CONTABILID ×6 | Queso, salsa tomate, pan mini | NULL | NULL | 🟢 | CREAR |
| Carnecol | inventario + CONTABILID ×2 | Carne Especial | NULL | NULL | 🟢 | CREAR |
| Olimpica | inventario | Lechuga Crespa | NULL | NULL | 🟡 | CREAR |
| Karen | CONTABILID | Panes | NULL | NULL | 🟡 | REQUIERE_CONFIRMACION |
| Rey David | inventario | Pan mini perro (no en recetas) | NULL | NULL | 🟡 | REQUIERE_CONFIRMACION |
| Samcol | CONTABILID | Vegetales | NULL | NULL | 🟡 | REQUIERE_CONFIRMACION |

Supabase actual: 0 proveedores.

---

## 15. COSTOS

### Modelo actual Supabase
La tabla `insumos` NO tiene columna `costo_unitario`. Schema:
```
id (uuid), nombre (text), unidad_medida (text), stock_actual (numeric),
stock_minimo (numeric), activo (boolean), created_at, updated_at
```

### Modelo recomendado de costos

> [!IMPORTANT]
> **No sobrescribir permanentemente el costo anterior.** Preservar historial.

**Opción recomendada: Costo vigente + historial vía compras**

```
insumos
  + costo_unitario (NUMERIC, nullable)     ← costo vigente actual
  + precio_presentacion (NUMERIC, nullable) ← precio de compra de la presentación
  + equivalencia (NUMERIC, nullable)        ← cuántas unidades mínimas en presentación

compra_detalles (ya existe en schema)
  → cada compra registra precio de ese momento
  → el costo en compra_detalles actúa como historial
  → al registrar compra, se actualiza costo_unitario en insumo
```

**Ventajas:**
- `costo_unitario` da acceso rápido al costo vigente para cálculo de recetas
- `compra_detalles` preserva historial de precios por compra
- Compatible con la arquitectura actual de Supabase

**NO ejecutar ALTER TABLE en esta fase.**

---

## 16. STOCK INICIAL

| Insumo | Stock sugerido | Evidencia | Confianza |
|---|---|---|---|
| Pan Hamburguesa Artesanal | 9 (actual Supabase) | Supabase: stock_actual=9 | 🟡 Dato de prueba |
| Todos los demás (39 insumos) | NO_DETERMINADO | Excel solo tiene true/false | PENDIENTE_TOMA_FISICA |

> [!WARNING]
> La hoja `inventario` proporciona disponibilidad booleana (true/false), NO cantidades numéricas. El único ítem con cantidad es "Huevo 3 → qty=1". El stock del Pan de Hamburguesa en Supabase (9) proviene de datos de prueba y puede no reflejar la realidad.

**Recomendación:** Todos los insumos nuevos con `stock_actual = 0`. Realizar toma física posterior.

---

## 17. CONFLICTOS

| ID | Entidad | Conflicto | Fuente A | Fuente B | Impacto | Decisión |
|---|---|---|---|---|---|---|
| C01 | Salchipapa / Papa en Espiral | Nombre y precio distintos | Excel: Salchipapa $13k | Supabase: Papa en Espiral $8k | ¿Crear nuevo o actualizar existente? | 🔴 REQUIERE_CONFIRMACION |
| C02 | costo_unitario | Columna inexistente en schema | EQUIVALENCIA tiene costos | insumos no tiene columna | No se pueden almacenar costos | 🔴 REQUIERE_CONFIRMACION |
| C03 | Salsas Tártara/Bacon | Costo supera precio aprobado | salsas: Tártara $244 vs $239 | salsas: Bacon $421 vs $239 | ¿Son subrecetas o productos? | 🟡 REQUIERE_CONFIRMACION |
| C04 | Trinche | Utensilio en fórmula de costo | salchipapa/especial: $34/ud | Es reutilizable, no consumible | ¿Incluir como costo o excluir? | 🟡 REQUIERE_CONFIRMACION |
| C05 | Corn Dog Clásico | Activo sin receta | Supabase: activo, $12k | Excel: solo mención en planeación | ¿Sigue activo? ¿Receta? | 🟡 REQUIERE_CONFIRMACION |

---

## 18. DATOS PENDIENTES

| Dato | Tipo | Impacto |
|---|---|---|
| ¿Salchipapa = Papa en Espiral? | Decisión propietario | Producto + precio |
| ¿Agregar costo_unitario a insumos? | Decisión arquitectura | Schema migration |
| ¿Corn Dog activo? | Decisión propietario | Catálogo productos |
| ¿Trinche como costo? | Decisión propietario | Costo receta ±$34 |
| ¿Salsas son subrecetas internas? | Decisión propietario | Modelo de datos |
| 10 insumos operativos: ¿importar? | Decisión propietario | Inventario |
| Stock real de todos los insumos | Toma física | stock_actual |
| Datos de prueba en Supabase | Fase de limpieza futura | 1 venta, 1 sesión, etc. |

---

## 19. RECOMENDACIÓN DE MODELO DE COSTOS

### Propuesta conceptual

```
insumo
├── nombre
├── unidad_medida
├── costo_unitario          ← NUEVO: costo vigente
├── precio_presentacion     ← NUEVO: precio de compra
├── equivalencia            ← NUEVO: unidades por presentación
├── stock_actual
├── stock_minimo
└── activo

compra
├── proveedor_id
├── fecha
└── total

compra_detalle
├── compra_id
├── insumo_id
├── cantidad
├── precio_unitario         ← precio en ese momento (historial)
└── subtotal
```

**Flujo:**
1. Se registra compra → `compra_detalles` guarda precio del momento
2. Se actualiza `insumo.costo_unitario` con el precio más reciente
3. Las recetas calculan costo con `costo_unitario` vigente
4. El historial queda en `compra_detalles`

---

## 20. PLAN DE IMPORTACIÓN POSTERIOR

Ver documento separado: [TITAN_GRILL_PLAN_IMPORTACION.md](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/7aa7c2bb-6914-46ed-b729-786c2c55199b/TITAN_GRILL_PLAN_IMPORTACION.md)

---

## CLASIFICACIÓN FINAL — TABLA MAESTRA

| ID | Nombre canónico | Categoría | Ud | Costo | Fuente | Conf. | Acción |
|---|---|---|---|---|---|---|---|
| IP01 | Tocineta | INSUMO_PRODUCTIVO | ud | $736,67 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP02 | Pan Hamburguesa Artesanal | INSUMO_PRODUCTIVO | ud | $1.350 | EQUIV+burger | 🟢 | REUTILIZAR_EXISTENTE |
| IP03 | Cebolla Blanca | INSUMO_PRODUCTIVO | ud | $600 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP04 | Cebolla Roja | INSUMO_PRODUCTIVO | ud | $500 | EQUIV+salsas | 🟢 | CREAR |
| IP05 | Tomate | INSUMO_PRODUCTIVO | ud | $800 | EQUIV+burger | 🟢 | CREAR |
| IP06 | Queso Chalo | INSUMO_PRODUCTIVO | ud | $610 | EQUIV+burger | 🟢 | CREAR |
| IP07 | Orégano en Polvo | INSUMO_PRODUCTIVO | g | $100 | EQUIV+burger | 🟢 | CREAR |
| IP08 | Pimienta Negra | INSUMO_PRODUCTIVO | g | $56 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP09 | Ajo en Polvo | INSUMO_PRODUCTIVO | g | $60 | EQUIV+salsas | 🟢 | CREAR |
| IP10 | Salsa Tomate Grande | INSUMO_PRODUCTIVO | g | $6,744 | EQUIV+5 recetas | 🟢 | CREAR |
| IP11 | Carne Especial | INSUMO_PRODUCTIVO | g | $16,556 | EQUIV+burger | 🟢 | CREAR |
| IP12 | Salsa de Carne | INSUMO_PRODUCTIVO | ml | $16,471 | EQUIV+burger | 🟢 | CREAR |
| IP13 | Salsa Inglesa | INSUMO_PRODUCTIVO | ml | $16,471 | EQUIV+salsas | 🟢 | CREAR |
| IP14 | Mostaza | INSUMO_PRODUCTIVO | g | $10,612 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP15 | Aceite Ideal | INSUMO_PRODUCTIVO | ml | $7,967 | EQUIV+perro+salchipapa | 🟢 | CREAR |
| IP16 | Papa | INSUMO_PRODUCTIVO | g | $6,68 | EQUIV+salchipapa+especial | 🟢 | CREAR |
| IP17 | Cebollín | INSUMO_PRODUCTIVO | g | $25 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP18 | Lechuga Crespa | INSUMO_PRODUCTIVO | g | $19,444 | EQUIV+burger+especial | 🟢 | CREAR |
| IP19 | Ripia | INSUMO_PRODUCTIVO | g | $10,40 | EQUIV+4 recetas | 🟢 | CREAR |
| IP20 | Salsa Piña | INSUMO_PRODUCTIVO | g | $9,70 | EQUIV+5 recetas | 🟢 | CREAR |
| IP21 | Mayoneza | INSUMO_PRODUCTIVO | g | $14,70 | EQUIV+salsas | 🟢 | CREAR |
| IP22 | Pechuga de Pollo | INSUMO_PRODUCTIVO | g | $22,898 | EQUIV+especial | 🟢 | CREAR |
| IP23 | Paprika | INSUMO_PRODUCTIVO | g | $53,333 | EQUIV+salchipapa+especial+salsas | 🟢 | CREAR |
| IP24 | Pan Perro Artesanal | INSUMO_PRODUCTIVO | ud | $1.200 | EQUIV+perro | 🟢 | CREAR |
| IP25 | Salchicha Perro Jumbo | INSUMO_PRODUCTIVO | ud | $1.850 | EQUIV+perro | 🟢 | CREAR |
| IP26 | Chorizo Don Vitto | INSUMO_PRODUCTIVO | ud | $593,75 | EQUIV+especial | 🟢 | CREAR |
| IP27 | Queso Duro | INSUMO_PRODUCTIVO | g | $22,20 | EQUIV+salchipapa+especial | 🟢 | CREAR |
| IP28 | Sal Refisal | INSUMO_PRODUCTIVO | g | $3 | EQUIV+salsas | 🟢 | CREAR |
| IP29 | Azúcar | INSUMO_PRODUCTIVO | g | $2,15 | EQUIV+salsas | 🟢 | CREAR |
| IP30 | Cabeza de Ajo | INSUMO_PRODUCTIVO | ud | $600 | EQUIV+burger+salsas | 🟢 | CREAR |
| IP31 | Porción Salsa Acompañamiento | INSUMO_PRODUCTIVO | ud | $600 | EQUIV+4 recetas | 🟡 | CREAR |
| IP32 | Salchicha Manguera | INSUMO_PRODUCTIVO | ud | $2.300 | EQUIV+salchipapa+especial | 🟢 | CREAR |
| IP33 | Maíz (bolsa 1kg) | INSUMO_PRODUCTIVO | g | $9,40 | EQUIV+perro | 🟢 | CREAR |
| IP34 | Queso Mozzarella | INSUMO_PRODUCTIVO | g | $29,50 | EQUIV+perro | 🟢 | CREAR |
| IP35 | Lechuga Bola | INSUMO_PRODUCTIVO | g | $4,40 | EQUIV+salchipapa | 🟢 | CREAR |
| EC01 | Empaque J1 | EMPAQUE_CONSUMIBLE | ud | $430 | EQUIV+salchipapa+especial | 🟢 | CREAR |
| EC02 | Bolsa | EMPAQUE_CONSUMIBLE | ud | $37 | EQUIV+salchipapa+especial | 🟢 | CREAR |
| EC03 | Servilleta | EMPAQUE_CONSUMIBLE | ud | $14 | EQUIV+4 recetas | 🟢 | CREAR |
| EC04 | Papel Envoltorio 29×29 | EMPAQUE_CONSUMIBLE | ud | $85,50 | EQUIV+burger+perro | 🟢 | CREAR |
| EC05 | Porta Perro | EMPAQUE_CONSUMIBLE | ud | $140 | EQUIV+perro | 🟢 | CREAR |
| IO01–IO10 | *(10 operativos)* | INSUMO_OPERATIVO | — | — | EQUIV sin receta | 🟡 | REQUIERE_CONFIRMACION |
| D1–D7 | *(7 duplicados excluidos)* | DUPLICADO | — | — | — | ⚫ | NO_IMPORTAR |
| EX01–EX10 | *(10 excluidos)* | NO_INSUMO | — | — | — | ⚫ | NO_IMPORTAR |

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
EXCEL MODIFICADO: NO
CÓDIGO MODIFICADO: NO
```
