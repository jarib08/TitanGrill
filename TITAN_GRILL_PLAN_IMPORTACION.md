# TITAN GRILL — PLAN DE IMPORTACIÓN
**Fecha:** 2026-08-08 | **Estado:** PLAN — NO EJECUTAR  
**Prerrequisito:** Respuestas a los 5 conflictos bloqueantes del catálogo maestro

---

> [!CAUTION]
> Este documento es exclusivamente un PLAN. No debe ejecutarse hasta que:
> 1. El propietario apruebe las decisiones pendientes
> 2. Se confirme explícitamente el inicio de cada fase

---

## FASE 0 — Migración de Schema

### Prerrequisito
Decisión del propietario: ¿Agregar columnas de costo a `insumos`?

### Acciones
```sql
-- Agregar columnas de costo al modelo de insumos
ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC;
ALTER TABLE public.insumos ADD COLUMN precio_presentacion NUMERIC;
ALTER TABLE public.insumos ADD COLUMN equivalencia_unidades NUMERIC;
```

### Validación
- Verificar que las columnas existen con `information_schema.columns`
- Verificar que no se rompió ninguna funcionalidad existente
- `npm run build` debe seguir pasando

---

## FASE 1 — Insumos

### Prerrequisito
Fase 0 completada.

### Acciones

**1.1 — Actualizar insumo existente (1)**
```
"Pan de Hamburguesa" → actualizar nombre a "Pan Hamburguesa Artesanal"
  + costo_unitario = 1350
  + precio_presentacion = 8100
  + equivalencia_unidades = 6
  + unidad_medida = 'unidad'
```

**1.2 — Crear insumos productivos (34)**

| # | Nombre | Unidad | Costo | Pres. | Equiv. |
|---|---|---|---|---|---|
| 1 | Tocineta | unidad | 736.67 | 22100 | 30 |
| 2 | Cebolla Blanca | unidad | 600 | 600 | 1 |
| 3 | Cebolla Roja | unidad | 500 | 500 | 1 |
| 4 | Tomate | unidad | 800 | 800 | 1 |
| 5 | Queso Chalo | unidad | 610 | 12200 | 20 |
| 6 | Orégano en Polvo | gramo | 100 | 1200 | 12 |
| 7 | Pimienta Negra | gramo | 56 | 3360 | 60 |
| 8 | Ajo en Polvo | gramo | 60 | 2700 | 45 |
| 9 | Salsa Tomate Grande | gramo | 6.744 | 29000 | 4300 |
| 10 | Carne Especial | gramo | 16.556 | 25000 | 1510 |
| 11 | Salsa de Carne | mililitro | 16.471 | 2800 | 170 |
| 12 | Salsa Inglesa | mililitro | 16.471 | 2800 | 170 |
| 13 | Mostaza | gramo | 10.612 | 10400 | 980 |
| 14 | Aceite Ideal | mililitro | 7.967 | 23900 | 3000 |
| 15 | Papa | gramo | 6.68 | 16700 | 2500 |
| 16 | Cebollín | gramo | 25 | 500 | 20 |
| 17 | Lechuga Crespa | gramo | 19.444 | 3500 | 180 |
| 18 | Ripia | gramo | 10.40 | 10400 | 1000 |
| 19 | Salsa Piña | gramo | 9.70 | 9700 | 1000 |
| 20 | Mayoneza | gramo | 14.70 | 14700 | 1000 |
| 21 | Pechuga de Pollo | gramo | 22.898 | 10304 | 450 |
| 22 | Paprika | gramo | 53.333 | 3200 | 60 |
| 23 | Pan Perro Artesanal | unidad | 1200 | 12000 | 10 |
| 24 | Salchicha Perro Jumbo | unidad | 1850 | 33300 | 18 |
| 25 | Chorizo Don Vitto | unidad | 593.75 | 9500 | 16 |
| 26 | Queso Duro | gramo | 22.20 | 16650 | 750 |
| 27 | Sal Refisal | gramo | 3 | 3000 | 1000 |
| 28 | Azúcar | gramo | 2.15 | 1075 | 500 |
| 29 | Cabeza de Ajo | unidad | 600 | 600 | 1 |
| 30 | Porción Salsa Acompañamiento | porción | 600 | 600 | 1 |
| 31 | Salchicha Manguera | unidad | 2300 | 18400 | 8 |
| 32 | Maíz (bolsa 1kg) | gramo | 9.40 | 9400 | 1000 |
| 33 | Queso Mozzarella | gramo | 29.50 | 11800 | 400 |
| 34 | Lechuga Bola | gramo | 4.40 | 4400 | 1000 |

**1.3 — Crear empaques consumibles (5)**

| # | Nombre | Unidad | Costo |
|---|---|---|---|
| 1 | Empaque J1 | unidad | 430 |
| 2 | Bolsa | unidad | 37 |
| 3 | Servilleta | unidad | 14 |
| 4 | Papel Envoltorio 29×29 | unidad | 85.50 |
| 5 | Porta Perro | unidad | 140 |

Todos con `stock_actual = 0`, `stock_minimo = 0`, `activo = true`.

### Validación
- Verificar 40 insumos creados
- Verificar que "Pan Hamburguesa Artesanal" mantiene su UUID original
- `npm run build`

---

## FASE 2 — Proveedores

### Prerrequisito
Ninguno (independiente de Fase 1).

### Acciones

| # | Nombre | Teléfono | Contacto |
|---|---|---|---|
| 1 | Chalo | NULL | NULL |
| 2 | Carnecol | NULL | NULL |
| 3 | Olimpica | NULL | NULL |

### Validación
- 3 proveedores creados
- Campos faltantes = NULL (no inventados)

---

## FASE 3 — Productos

### Prerrequisito
Decisiones del propietario sobre conflictos C01 y C05.

### Acciones posibles

**Si Salchipapa = Papa en Espiral:**
- Actualizar nombre "Papa en Espiral" → "Salchipapa"
- Actualizar precio $8.000 → $13.000

**Si Salchipapa ≠ Papa en Espiral:**
- Crear nuevo producto "Salchipapa" a $13.000
- Mantener "Papa en Espiral" como está

**Salchipapa Especial:**
- Crear nuevo: "Salchipapa Especial", $18.000, categoría=comida, activo=true

**Corn Dog:**
- Según decisión del propietario

### Validación
- Precios correctos
- Categorías correctas
- No duplicados

---

## FASE 4 — Recetas (producto_insumos)

### Prerrequisito
Fases 1 y 3 completadas. UUIDs disponibles.

### Acciones

**Burger Classic (19 registros)**

| Insumo | cantidad_por_unidad |
|---|---|
| Carne Especial | 110 |
| Pan Hamburguesa Artesanal | 1 |
| Queso Chalo | 1 |
| Servilleta | 3 |
| Tomate | 0.2 |
| Salsa Tomate Grande | 25 |
| Tocineta | 1 |
| Lechuga Crespa | 15 |
| Ripia | 10 |
| Mostaza | 10 |
| Papel Envoltorio 29×29 | 1 |
| Salsa de Carne | 5 |
| Cebolla Blanca | 0.2 |
| Pimienta Negra | 0.7 |
| Cabeza de Ajo | 0.2 |
| Orégano en Polvo | 0.5 |
| Porción Salsa Acompañamiento | 1 |
| Salsa Piña | 15 |
| Cebollín | 2 |

**Perro Caliente (12 registros, convertido a ÷10)**

| Insumo | cantidad_por_unidad |
|---|---|
| Porta Perro | 1 |
| Salchicha Perro Jumbo | 1 |
| Pan Perro Artesanal | 1 |
| Aceite Ideal | 2 |
| Ripia | 15 |
| Salsa Piña | 4 |
| Salsa Tomate Grande | 4 |
| Porción Salsa Acompañamiento | 0.1 |
| Papel Envoltorio 29×29 | 0.5 |
| Maíz (bolsa 1kg) | 8 |
| Servilleta | 4 |
| Queso Mozzarella | 2 |

**Salchipapa (13 registros, sin Trinche)**

| Insumo | cantidad_por_unidad |
|---|---|
| Papa | 160 |
| Aceite Ideal | 20 |
| Empaque J1 | 1 |
| Porción Salsa Acompañamiento | 2 |
| Salsa Piña | 20 |
| Salsa Tomate Grande | 30 |
| Salchicha Manguera | 0.5 |
| Queso Duro | 60 |
| Ripia | 15 |
| Servilleta | 5 |
| Bolsa | 1 |
| Lechuga Bola | 27 |
| Paprika | 5 |

**Salchipapa Especial (15 registros, sin Trinche)**

| Insumo | cantidad_por_unidad |
|---|---|
| Papa | 150 |
| Chorizo Don Vitto | 1 |
| Empaque J1 | 1 |
| Porción Salsa Acompañamiento | 1 |
| Salsa Piña | 30 |
| Salsa Tomate Grande | 30 |
| Salchicha Manguera | 0.5 |
| Queso Duro | 60 |
| Ripia | 10 |
| Servilleta | 4 |
| Bolsa | 1 |
| Lechuga Crespa | 27 |
| Paprika | 5 |
| Pechuga de Pollo | 120 |
| — | *(nota: papel envoltorio sin costo en Excel, excluido)* |

**Total: ~59 registros en producto_insumos**

### Validación

Para cada producto verificar:
```
Σ (cantidad_por_unidad × insumo.costo_unitario) ≈ costo_receta_Excel
```

| Producto | Costo Excel | Costo esperado | Tolerancia |
|---|---|---|---|
| Burger Classic | $6.683 | ±$5 | OK |
| Perro Caliente | $3.721/porción | ±$5 | OK |
| Salchipapa | $6.385 | ±$5 | OK |
| Salchipapa Especial | $9.371 | ±$5 | OK |

---

## FASE 5 — Costos

### Prerrequisito
Fase 1 completada (costos ya incluidos en insumos).

### Acciones
- Verificar que cada `insumo.costo_unitario` coincide con EQUIVALENCIA
- Verificar fórmula: `precio_presentacion / equivalencia_unidades = costo_unitario`
- Documentar cualquier discrepancia

### Validación
- 40 insumos con costo verificado
- 0 costos inventados

---

## FASE 6 — Validación

### Acciones
1. `npm run build` — debe pasar ✅
2. `npm run lint` — debe pasar ✅
3. Verificar conteo de registros:
   - insumos: 40
   - producto_insumos: ~59
   - proveedores: 3
   - productos: 8–10 (según decisiones)
4. Verificar costos de receta vs Excel
5. Verificar que datos preexistentes no fueron alterados:
   - 14 clientes: intactos
   - 15 stamp_logs: intactos
   - 1 venta de prueba: intacta
   - 1 sesión de caja: intacta

---

## FASE 7 — Stock Inicial

### Prerrequisito
Toma física realizada por el propietario.

### Acciones
- Actualizar `stock_actual` de cada insumo con cantidades reales
- Registrar como `movimiento_inventario` de tipo "toma_fisica" o "ajuste_inicial"

### Validación
- Cada insumo con stock ≥ 0
- Total de movimientos = total de insumos con stock > 0

---

## RESUMEN DEL PLAN

| Fase | Registros | Dependencia | Riesgo |
|---|---|---|---|
| 0 — Schema | 3 columnas | Aprobación propietario | Bajo |
| 1 — Insumos | 1 UPDATE + 39 INSERT | Fase 0 | Bajo |
| 2 — Proveedores | 3 INSERT | Ninguna | Bajo |
| 3 — Productos | 1–2 INSERT/UPDATE | Decisiones propietario | Medio |
| 4 — Recetas | ~59 INSERT | Fases 1+3 | Bajo |
| 5 — Costos | Verificación | Fase 1 | Bajo |
| 6 — Validación | 0 cambios | Fases 1–5 | Bajo |
| 7 — Stock | N updates | Toma física | Medio |

---

```
ESTE DOCUMENTO ES UN PLAN.
NO SE EJECUTÓ NINGUNA ACCIÓN.
SUPABASE: 0 MODIFICACIONES.
```
