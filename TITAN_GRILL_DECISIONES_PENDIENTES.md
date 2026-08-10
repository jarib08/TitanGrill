# TITAN GRILL — DECISIONES PENDIENTES
**Fecha:** 2026-08-08 | **Estado:** Pre-importación

---

## 🔴 BLOQUEANTE — Impide ejecutar la importación

### B1. Salchipapa vs Papa en Espiral

| Fuente | Nombre | Precio |
|---|---|---|
| Excel (salchipapa) | Salchipapa | $13.000 |
| Supabase | Papa en Espiral | $8.000 |

**Pregunta:** ¿"Papa en Espiral" en Supabase es el mismo producto que "Salchipapa" del Excel?

**Si SÍ:**
- Actualizar nombre "Papa en Espiral" → "Salchipapa"
- Actualizar precio $8.000 → $13.000
- Crear receta con 13 ingredientes

**Si NO:**
- Crear nuevo producto "Salchipapa" a $13.000
- Mantener "Papa en Espiral" como producto separado
- Decidir si "Papa en Espiral" tiene receta o no

---

### B2. Agregar `costo_unitario` a tabla `insumos`

La tabla actual NO tiene columna para almacenar costos.

```
Requiere: ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
```

**Sin esta columna:**
- Las recetas no pueden calcular margen
- La UI de inventario no muestra costo
- `compra_detalles` ya tiene `costo_unitario` como historial, pero sin insumo.costo_unitario no hay costo "vigente" rápido

**Pregunta:** ¿Aprueba agregar esta columna?

---

## 🟡 RECOMENDACIÓN — No bloquea pero requiere confirmación

### R1. Corn Dog Clásico

Existe en Supabase ($12.000, activo=true) pero no tiene receta en hojas visibles del Excel.

**Opciones:**
- A) Mantener activo sin receta (solo para ventas, sin descuento de inventario)
- B) Desactivar temporalmente
- C) Crear receta nueva (pero no hay datos en Excel visible)

**Recomendación:** Opción A — Mantener, documentar que falta receta.

---

### R2. Trinche en recetas

Trinche ($34/ud) aparece como ítem en salchipapa y especial. Es un utensilio reutilizable.

**Opciones:**
- A) Excluir de recetas (no crear insumo, no descontar)
- B) Incluir como "costo de servicio" ($34 por venta)

**Recomendación:** Opción A — Excluir. No es consumible.

---

### R3. Salsas Bigmag/Tártara/Bacon

Son preparaciones internas documentadas en hoja "salsas".

| Salsa | Costo/porción | "Precio aprobado" | Margen |
|---|---|---|---|
| Bigmag | $412 | $900 | 54% |
| Tártara | $244 | $239 | -2% |
| Bacon | $421 | $239 | -76% |

**Pregunta:** ¿Son subrecetas internas (no se venden por separado) o productos vendibles?

**Recomendación:** Subrecetas internas. El "precio aprobado" probablemente es un costo de referencia, no precio de venta. No importar como productos.

---

## 🟢 RESUELTO — Con evidencia

| ID | Decisión | Evidencia | Resolución |
|---|---|---|---|
| R-D1 | PAPA = papa bolsa premiun | Mismo costo $6,68/g, misma presentación | Fusionar → "Papa" |
| R-D2 | Salsa tomate (grande) ≠ salsa tomate | Solo f17 usada en recetas, precios diferentes | Usar f17 |
| R-D3 | mayoneza ≠ mayo grande | Solo f38 usada en recetas | Usar f38 |
| R-D4 | chorizo don vitto ≠ chorizo | Solo f46 usada en recetas | Usar f46 |
| R-D5 | pan perro artesanal ≠ pan mini chalo | Productos distintos, precios diferentes | Usar f43 |
| R-D6 | LECHUGA CRESPA ≠ lechuga bola | Variedades diferentes, ambas en recetas | Importar ambas |
| R-D7 | salcchicha rooster / Sanchicha mini | Ninguna en recetas visibles | No importar |

---

## Contadores

| Tipo | Cantidad |
|---|---|
| 🔴 BLOQUEANTE | 2 |
| 🟡 RECOMENDACIÓN | 3 |
| 🟢 RESUELTO | 7 |
| Insumos operativos pendientes | 10 (no bloquean la importación principal) |

---

**Para proceder a la importación se necesita:**

1. ✅ Respuesta a B1 (Salchipapa = Papa en Espiral?)
2. ✅ Respuesta a B2 (Agregar costo_unitario?)
3. ⬜ Opcionalmente: R1, R2, R3

Sin las respuestas a B1 y B2, la importación **NO debe ejecutarse**.
