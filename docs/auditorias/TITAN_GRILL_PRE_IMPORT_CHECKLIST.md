# TITAN GRILL — PRE-IMPORT CHECKLIST
**Fecha:** 2026-08-08 | **Versión:** 1.0

---

## ESTADO: 🔴 BLOCKED

La importación NO puede ejecutarse hasta resolver B1.

---

## PRERREQUISITOS

- [x] Excel leído y re-verificado directamente
- [x] Schema Supabase auditado (columnas, FK, constraints)
- [x] RPCs leídos y analizados (`registrar_venta`, `recibir_compra`, `anular_compra`)
- [x] Datos existentes auditados (8 productos, 1 insumo, 1 receta, datos prueba)
- [x] `npm run build` → PASS ✅
- [x] 4 recetas verificadas matemáticamente (Δ=0 en todas)
- [x] 7 grupos de duplicados resueltos con evidencia
- [x] SQL transaccional preparado con guards de seguridad
- [x] Rollback plan documentado

## DECISIONES

| ID | Estado | Decisión |
|---|---|---|
| B1 | 🔴 BLOQUEANTE | ¿Salchipapa = Papa en Espiral? |
| B2 | 🟢 RESUELTO | Agregar `costo_unitario` a `insumos` (1 columna) |
| R1 | 🟡 RECOMENDACIÓN | Corn Dog: mantener sin receta (no bloquea) |
| R2 | 🟡 RECOMENDACIÓN | Trinche: excluir de recetas |
| R3 | 🟡 RECOMENDACIÓN | Salsas: subrecetas internas |

## SCHEMA

- [ ] Ejecutar `ALTER TABLE insumos ADD COLUMN costo_unitario NUMERIC DEFAULT 0`
- [ ] Verificar que no rompe RPCs existentes (análisis: ✅ no las rompe)

## DATOS — INSUMOS

- [ ] 1 UPDATE: Pan de Hamburguesa → Pan Hamburguesa Artesanal
- [ ] 39 INSERT: insumos nuevos con stock=0
- [ ] Guard: 0 duplicados por nombre
- [ ] Verificar: 40 insumos activos post-import

## DATOS — PROVEEDORES

- [ ] 3 INSERT: Chalo, Carnecol, Olimpica (teléfono=NULL, contacto=NULL)
- [ ] Guard: 0 duplicados por nombre

## DATOS — PRODUCTOS

- [ ] 1 INSERT: Salchipapa Especial ($18.000)
- [ ] ⬜ B1: resolver Salchipapa / Papa en Espiral
- [ ] Guard: 0 duplicados por nombre
- [ ] Verificar: bebidas no alteradas (requiere_inventario=false)

## DATOS — RECETAS

- [ ] Burger Classic: DELETE 1 existente + INSERT 19
- [ ] Perro Caliente: INSERT 12
- [ ] Salchipapa Especial: INSERT 15
- [ ] ⬜ Salchipapa: INSERT 13 (depende de B1)
- [ ] Guard: todos los insumo_id existen
- [ ] Guard: todos los producto_id existen
- [ ] Verificar Σ(qty × costo) ≈ costo Excel

## INTEGRIDAD

- [ ] 14 clientes: intactos post-import
- [ ] 15 stamp_logs: intactos post-import
- [ ] 1 venta prueba: intacta
- [ ] 1 sesión caja: intacta
- [ ] 2 movimientos caja: intactos
- [ ] 1 movimiento inventario: intacto
- [ ] 0 FK huérfanas

## SEGURIDAD

- [ ] Transacción BEGIN/COMMIT envuelve todo
- [ ] Guards con RAISE EXCEPTION abortan si hay duplicados
- [ ] No se ejecutan DDL adicionales más allá del ALTER

## ROLLBACK

- [ ] Script de rollback probado conceptualmente
- [ ] Incluye restauración de receta original Burger (1 ingrediente)
- [ ] Incluye DROP COLUMN costo_unitario

---

## PARA PROCEDER

1. **Propietario responde B1:** ¿Salchipapa = Papa en Espiral?
   - Opción A: Mismo producto → renombrar + cambiar precio
   - Opción B: Diferentes → crear nuevo
   - Opción C: Papa en Espiral ya no se vende → desactivar + crear nuevo

2. Descomentar la opción elegida en `TITAN_GRILL_IMPORT_SQL_DRY_RUN.sql`

3. Ejecutar el SQL completo

4. Verificar post-import:
   - `npm run build` ✅
   - Probar venta de Burger en POS
   - Verificar descuento de inventario
