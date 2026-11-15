# TITAN GRILL — IMPORT MANIFEST FINAL
**Fecha:** 2026-08-08 | **Modo:** READ-ONLY | **Supabase modificado:** NO

---

## VALIDACIÓN DE DOCUMENTOS PREVIOS

Los documentos `DRY_RUN_IMPORTACION.md` y `DECISIONES_PENDIENTES.md` fueron contrastados contra:

1. ✅ Excel real (`costo titangrill.xlsx`) — re-leído directamente, 66 elementos EQUIV verificados
2. ✅ Schema real Supabase — columnas, FK, constraints auditados
3. ✅ Datos actuales Supabase — 8 productos, 1 insumo, 1 receta, datos de prueba
4. ✅ RPCs (`registrar_venta`, `recibir_compra`, `anular_compra`) — código fuente completo leído

**Contradicciones encontradas:** 0. Los documentos son consistentes con las fuentes reales.

---

## DECISIÓN B1 — SALCHIPAPA vs PAPA EN ESPIRAL

### Evidencia recopilada

**Supabase:**
| Campo | Valor |
|---|---|
| id | e3bbda11-cf99-417c-b453-a21a4fea8469 |
| nombre | Papa en Espiral |
| precio | $8.000 |
| categoría | Entradas |
| requiere_inventario | true |
| activo | true |
| created_at | 2026-08-07 20:34:48 |
| producto_insumos | **0 registros** (sin receta) |

**Excel (hojas visibles):**
- Hoja "salchipapa": receta completa, 13 ingredientes reales, costo $6.385, precio implícito $13.000
- Hoja "EQUIVALENCIA": no hay un ítem llamado "Papa en Espiral"
- No hay hoja ni celda visible que mencione "Papa en Espiral"

### Análisis

| Criterio | Papa en Espiral (Supabase) | Salchipapa (Excel) |
|---|---|---|
| Fuente | Seed data del sistema | Hoja visible |
| Precio | $8.000 | $13.000 |
| Receta | ❌ Ninguna | ✅ 13 ingredientes |
| Categoría | Entradas | — |
| EQUIVALENCIA | No existe | Componentes listados |

**NO existe evidencia visible suficiente para afirmar que "Papa en Espiral" = "Salchipapa":**
- Precios diferentes ($8k vs $13k)
- Nombres diferentes
- "Papa en Espiral" no aparece en ninguna hoja visible del Excel
- No hay metadata ni comentario que los vincule

**Veredicto B1:** 🔴 **BLOQUEANTE** — Se mantiene. Se requiere confirmación explícita del propietario.

**Opciones para el propietario:**
- **A)** Son el mismo producto → Renombrar a "Salchipapa", precio $13.000, asignar receta
- **B)** Son productos diferentes → Crear "Salchipapa" nuevo, mantener "Papa en Espiral" separado
- **C)** "Papa en Espiral" ya no se vende → Desactivar Papa en Espiral, crear "Salchipapa" nuevo

---

## DECISIÓN B2 — COSTO_UNITARIO

### Análisis de RPCs

#### `recibir_compra(p_compra_id)`
```
FOR cada compra_detalle:
  UPDATE insumos SET stock_actual = stock_actual + cantidad
  INSERT movimientos_inventario (tipo='ENTRADA_COMPRA')
```
**NO toca `costo_unitario`.** Para que se actualice el costo vigente, habría que agregar:
```sql
UPDATE public.insumos
SET costo_unitario = v_detail.costo_unitario_nuevo
WHERE id = v_detail.insumo_id;
```

#### `registrar_venta(...)` 
```
FOR cada producto en la venta:
  IF requiere_inventario:
    verificar que existe receta (producto_insumos)
    verificar stock suficiente
    descontar stock_actual
    INSERT movimientos_inventario (tipo='VENTA')
```
**NO lee ni escribe `costo_unitario`.** No necesita cambios para la importación.

#### `anular_compra(p_compra_id, p_motivo)`
```
Revierte stock_actual (resta la cantidad)
INSERT movimientos_inventario (tipo='MERMA')
```
**NO toca `costo_unitario`.** No necesita cambios inmediatos.

### Veredicto B2: 🟢 **RESUELTO**

**Arquitectura recomendada:**
```sql
ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
```

- `insumos.costo_unitario` = costo vigente (se carga inicialmente con datos de EQUIVALENCIA)
- `compra_detalles.costo_unitario` = costo histórico por compra (ya existe)
- `recibir_compra` **deberá modificarse** en una fase posterior para actualizar `insumos.costo_unitario` automáticamente al recibir compra. Esto NO es necesario para la importación inicial.
- `registrar_venta` no necesita cambios.

**Impacto:** Mínimo. Una columna nueva con default 0. Sin riesgo de romper funcionalidad existente.

---

## AUDITORÍA DE SALSA X

**Decisión: Insumo simple "Porción Salsa Acompañamiento"**

| Criterio | Análisis |
|---|---|
| ¿Insumo de inventario? | Sí — aparece en 4 recetas con cantidad y costo definidos |
| ¿Cómo se abastece? | Vía compra futura o producción interna (preparar salsa → registrar como compra interna) |
| ¿Salsa extra del cliente? | Crear producto "Salsa Extra" con `requiere_inventario=true`, receta: 1 porción de este insumo |
| ¿Subreceta? | No — no tenemos ingredientes confirmados para la salsa |
| Solución más simple | Insumo `unidad_medida='porción'`, `costo_unitario=600`. Compatible con schema actual sin cambios |

---

## AUDITORÍA DE PRODUCTOS SIN RECETA

| Producto | requiere_inv | Tiene receta | Clasificación | Qué pasa si se vende |
|---|---|---|---|---|
| Burger Classic | true | ✅ 1/19 (solo Pan) | **A** → completar receta | ⚠️ Descuenta solo Pan |
| Perro Caliente | true | ❌ 0 | **B** → necesita receta | 🔴 `registrar_venta()` retorna error |
| Corn Dog Clásico | true | ❌ 0 | **D** → sin respaldo visible | 🔴 `registrar_venta()` retorna error |
| Papa en Espiral | true | ❌ 0 | **D** → sin respaldo visible | 🔴 `registrar_venta()` retorna error |
| Postobón Manzana | false | — | **C** → no necesita receta | ✅ Venta OK |
| Coca-Cola | false | — | **C** → no necesita receta | ✅ Venta OK |
| Cerezada | false | — | **C** → no necesita receta | ✅ Venta OK |
| Limonada | false | — | **C** → no necesita receta | ✅ Venta OK |

**Hallazgo crítico:** `registrar_venta()` verifica `EXISTS(producto_insumos)` para productos con `requiere_inventario=true`. Sin receta, la venta es **bloqueada por el sistema**. Esto significa que actualmente Perro Caliente, Corn Dog y Papa en Espiral **no pueden venderse**.

---

## AUDITORÍA DE 39+1 INSUMOS

### 1 UPDATE existente
| Nombre actual | Nombre nuevo | UUID | Costo | Estado |
|---|---|---|---|---|
| Pan de Hamburguesa | Pan Hamburguesa Artesanal | 73548bdb | 1350 | 🟢 SEGURO |

### 39 CREATE — Todos 🟢 SEGURO

Cada uno verificado: nombre en receta visible ↔ fila EQUIVALENCIA ↔ costo_unitario = precio_pres/equiv

| # | Nombre | Fila | Receta | Dupli | Supa | Conf |
|---|---|---|---|---|---|---|
| 1–34 | (insumos productivos) | f4–f68 | ✅ | ❌ | ❌ | 🟢 |
| 35–39 | (empaques) | f11–f45 | ✅ | ❌ | ❌ | 🟢 |

**Excepciones:**
- #30 `Porción Salsa Acompañamiento` → 🟡 Concepto aprobado pero nombre es propuesta (fue "salsa x")

---

## AUDITORÍA DE PROVEEDORES

| Proveedor | Evidencia visible | Insumos | Clasificación |
|---|---|---|---|
| Chalo | inventario ×8 ítems + CONTABILID ×6 compras | Queso, salsa tomate, pan, etc. | ✅ CONFIRMADO |
| Carnecol | inventario ×1 + CONTABILID ×2 | Carne Especial | ✅ CONFIRMADO |
| Olimpica | inventario ×1 | Lechuga Crespa | 🔵 REFERENCIAL |

---

## AUDITORÍA DE STOCK

| Insumo | Stock Supabase | Tipo | Acción |
|---|---|---|---|
| Pan de Hamburguesa | 9 | PRUEBA (de venta test) | NO TOCAR |
| Todos los nuevos | — | — | `stock_actual = 0` |

---

## AUDITORÍA DEL MODELO DE COSTOS

| Producto | Costo Excel | Recalculado | Δ | Estado |
|---|---|---|---|---|
| Burger Classic | $6.683 | $6.683 | 0 | ✅ |
| Perro Caliente | $3.721 | $3.721 | 0 | ✅ |
| Salchipapa | $6.385 | $6.385 | 0 | ✅ |
| Salchipapa Especial | $9.371 | $9.371 | 0 | ✅ |

**0 diferencias materiales.**

---

## FASES DE IMPORTACIÓN

### FASE 0 — SCHEMA
```sql
ALTER TABLE public.insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0;
```
- **Motivo:** Almacenar costo vigente para cálculo de margen
- **Impacto:** Nulo sobre funcionalidad existente (RPCs no leen esta columna)
- **Rollback:** `ALTER TABLE public.insumos DROP COLUMN costo_unitario;`

### FASE 1 — INSUMOS

| Acción | Cantidad | Detalle |
|---|---|---|
| UPDATE | 1 | Pan de Hamburguesa → Pan Hamburguesa Artesanal + costo=1350 |
| CREATE | 39 | 34 productivos + 5 empaques, todos con stock=0, activo=true |
| OMITIR | 27 | 10 operativos + 7 duplicados + 10 excluidos |

### FASE 2 — PROVEEDORES

| Acción | Cantidad |
|---|---|
| CREATE | 3 (Chalo, Carnecol, Olimpica) |

### FASE 3 — PRODUCTOS

| Acción | Producto | Detalle |
|---|---|---|
| CONSERVAR | Burger Classic | Ya existe, coincide |
| CONSERVAR | Perro Caliente | Ya existe, coincide |
| 🔴 B1 | Salchipapa / Papa en Espiral | BLOQUEANTE |
| CREATE | Salchipapa Especial | $18.000, comida, activo, requiere_inventario=true |
| NO TOCAR | Corn Dog Clásico | Sin receta visible, mantener como está |
| NO TOCAR | 4 bebidas | requiere_inventario=false |

### FASE 4 — RECETAS (producto_insumos)

| Producto | Registros | Acción previa |
|---|---|---|
| Burger Classic | 19 | DELETE del registro existente (Pan ×1), luego INSERT ×19 |
| Perro Caliente | 12 | INSERT ×12 |
| Salchipapa* | 13 | *Solo si B1 se resuelve* |
| Salchipapa Especial | 15 | INSERT ×15 |

### FASE 5 — VALIDACIONES
- Verificar Σ(cantidad × costo) ≈ costo Excel para cada receta
- Verificar 0 FK huérfanas
- Verificar 0 duplicados

### FASE 6 — POST-IMPORT CHECKS
- `npm run build` → debe pasar
- Verificar que `registrar_venta()` funciona para Burger Classic
- Verificar que clientes, stamp_logs, ventas históricas no fueron alterados

---

## BACKUP / ROLLBACK PLAN

### Rollback por fase

| Fase | Rollback |
|---|---|
| 0 Schema | `ALTER TABLE public.insumos DROP COLUMN costo_unitario;` |
| 1 Insumos | `DELETE FROM insumos WHERE id IN (nuevos UUIDs); UPDATE insumos SET nombre='Pan de Hamburguesa', costo_unitario=DEFAULT WHERE id='73548bdb...';` |
| 2 Proveedores | `DELETE FROM proveedores WHERE nombre IN ('Chalo','Carnecol','Olimpica');` |
| 3 Productos | `DELETE FROM productos WHERE nombre='Salchipapa Especial';` |
| 4 Recetas | `DELETE FROM producto_insumos WHERE producto_id IN (affected UUIDs); INSERT INTO producto_insumos (...) VALUES (Burger→Pan×1);` |

### Datos que NO se tocan (verificación)
- ✅ 14 clientes → intactos
- ✅ 15 stamp_logs → intactos
- ✅ 1 venta test → intacta
- ✅ 1 sesión caja → intacta
- ✅ 2 movimientos_caja → intactos
- ✅ 1 movimiento_inventario → intacto

---

```
SUPABASE INSERTS: 0
SUPABASE UPDATES: 0
SUPABASE DELETES: 0
SUPABASE MIGRATIONS: 0
```
