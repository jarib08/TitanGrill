-- ============================================================================
--  RESET OPERATIVO TITAN GRILL  —  2026-10-22
-- ============================================================================
--  NO EJECUTADO. Requiere autorizacion explicita del socio.
--
--  QUE HACE:   deja la operacion en cero conservando los catalogos.
--  QUE NO HACE: no borra insumos, recetas, productos, proveedores, clientes,
--               sellos (fuego), roles, ni el multiplicador/impuesto de precios.
--               No deshabilita ningun trigger, FK ni RLS: el orden de borrado
--               esta construido para que los triggers de inmutabilidad nunca
--               se disparen (ver los comentarios del paso 1).
--
--  PRERREQUISITO OBLIGATORIO: dump completo verificado inmediatamente antes.
--    pg_dump "$SUPABASE_DB_URL" -Fc -f supabase/backups/<ts>_pre_reset.dump
--    pg_restore -l supabase/backups/<ts>_pre_reset.dump | wc -l   # debe dar >360
--
--  Se ejecuta DENTRO de una transaccion. Si cualquier conteo final no cuadra,
--  se hace ROLLBACK y no se pierde nada.
-- ============================================================================

BEGIN;

-- Un solo escritor a la vez, para que no entre una venta a mitad del reset.
SELECT pg_advisory_xact_lock(hashtext('titangrill_reset_operativo'));

-- ── 0. FOTO PREVIA (queda en el log de la sesion) ───────────────────────────
\echo '--- ANTES ---'
SELECT 'ventas' t, count(*) n FROM ventas
UNION ALL SELECT 'movimientos_caja', count(*) FROM movimientos_caja
UNION ALL SELECT 'movimientos_inventario', count(*) FROM movimientos_inventario
UNION ALL SELECT 'sesiones_caja', count(*) FROM sesiones_caja
UNION ALL SELECT 'compras', count(*) FROM compras
UNION ALL SELECT 'liquidaciones', count(*) FROM liquidaciones
UNION ALL SELECT 'insumos stock>0', count(*) FROM insumos WHERE stock_actual > 0
ORDER BY 1;

-- ── 1. BORRADO, en orden hijo -> padre ──────────────────────────────────────
-- El orden lo imponen las 6 FK con ON DELETE NO ACTION. No se usa TRUNCATE
-- ni CASCADE a ciegas: cada tabla se borra explicitamente.

DELETE FROM solicitudes_anulacion_venta;   -- FK NO ACTION -> ventas

-- movimientos_inventario va PRIMERO a proposito: sus FK a ventas y compras son
-- ON DELETE SET NULL, y ese SET NULL disparara trg_immutable_cost_snapshot
-- (UPDATE) y abortaria. Si la tabla ya esta vacia, no hay fila que actualizar.
DELETE FROM movimientos_inventario;

-- Hay un ciclo de FK entre movimientos_caja y liquidaciones:
--   movimientos_caja.liquidacion_id  -> liquidaciones      (NO ACTION)
--   liquidaciones.movimiento_caja_id -> movimientos_caja   (SET NULL)
-- y ese SET NULL lo bloquea trg_liquidacion_inmutable_si_pagada. Se rompe el
-- ciclo soltando primero el lado que NO tiene trigger (movimientos_caja no
-- tiene ningun trigger), y borrando liquidaciones antes que movimientos_caja.
UPDATE movimientos_caja SET liquidacion_id = NULL WHERE liquidacion_id IS NOT NULL;
DELETE FROM turnos;                        -- FK NO ACTION -> liquidaciones
DELETE FROM liquidaciones;                 -- nominas; ya nadie la referencia
DELETE FROM movimientos_caja;              -- liquidaciones ya no existe: sin trigger

DELETE FROM ventas;
DELETE FROM compra_detalles;               -- FK CASCADE, explicito de todos modos
DELETE FROM compras;                       -- historial de compras
DELETE FROM gastos;                        -- egresos
DELETE FROM sesiones_caja;                 -- arqueos: ninguno queda pendiente

-- ── 2. INSUMOS: solo la cantidad a 0, el registro se conserva ───────────────
UPDATE insumos SET stock_actual = 0, updated_at = now() WHERE stock_actual <> 0;

-- ── 3. COSTOS FIJOS Y VARIABLES: sin nada definido ──────────────────────────
-- Se conservan MULTIPLICADOR e IMPUESTO: no son gasto, son el motor de precios
-- de los productos, y borrarlos cambiaria los precios de venta.
DELETE FROM costos_configuracion WHERE tipo_costo IN ('FIJO','VARIABLE');

-- ── 4. VERIFICACION: todo o nada ────────────────────────────────────────────
DO $$
DECLARE v_err text := '';
BEGIN
  IF (SELECT count(*) FROM ventas)                 <> 0 THEN v_err := v_err||'ventas '; END IF;
  IF (SELECT count(*) FROM movimientos_caja)       <> 0 THEN v_err := v_err||'mov_caja '; END IF;
  IF (SELECT count(*) FROM movimientos_inventario) <> 0 THEN v_err := v_err||'mov_inv '; END IF;
  IF (SELECT count(*) FROM sesiones_caja)          <> 0 THEN v_err := v_err||'sesiones '; END IF;
  IF (SELECT count(*) FROM compras)                <> 0 THEN v_err := v_err||'compras '; END IF;
  IF (SELECT count(*) FROM compra_detalles)        <> 0 THEN v_err := v_err||'compra_det '; END IF;
  IF (SELECT count(*) FROM liquidaciones)          <> 0 THEN v_err := v_err||'liquidaciones '; END IF;
  IF (SELECT count(*) FROM turnos)                 <> 0 THEN v_err := v_err||'turnos '; END IF;
  IF (SELECT count(*) FROM gastos)                 <> 0 THEN v_err := v_err||'gastos '; END IF;
  IF (SELECT count(*) FROM insumos WHERE stock_actual <> 0) <> 0 THEN v_err := v_err||'stock '; END IF;
  IF (SELECT count(*) FROM costos_configuracion WHERE tipo_costo IN ('FIJO','VARIABLE')) <> 0
     THEN v_err := v_err||'costos '; END IF;
  IF v_err <> '' THEN RAISE EXCEPTION 'RESET INCOMPLETO en: %', v_err; END IF;

  -- Y lo que NO se debio tocar sigue ahi, con los conteos exactos de hoy:
  IF (SELECT count(*) FROM insumos)             <> 52 THEN RAISE EXCEPTION 'insumos perdidos: %',    (SELECT count(*) FROM insumos); END IF;
  IF (SELECT count(*) FROM productos)           <> 13 THEN RAISE EXCEPTION 'productos perdidos: %',  (SELECT count(*) FROM productos); END IF;
  IF (SELECT count(*) FROM producto_insumos)    <> 41 THEN RAISE EXCEPTION 'recetas perdidas: %',    (SELECT count(*) FROM producto_insumos); END IF;
  IF (SELECT count(*) FROM proveedores)         <>  5 THEN RAISE EXCEPTION 'proveedores perdidos: %',(SELECT count(*) FROM proveedores); END IF;
  IF (SELECT count(*) FROM clientes)            <> 29 THEN RAISE EXCEPTION 'clientes perdidos: %',   (SELECT count(*) FROM clientes); END IF;
  IF (SELECT coalesce(sum(stamps_count),0) FROM clientes) <> 27 THEN RAISE EXCEPTION 'sellos alterados: %', (SELECT sum(stamps_count) FROM clientes); END IF;
  IF (SELECT count(*) FROM perfiles_trabajadores) <> 3 THEN RAISE EXCEPTION 'roles perdidos: %',     (SELECT count(*) FROM perfiles_trabajadores); END IF;
  IF (SELECT count(*) FROM costos_configuracion WHERE tipo_costo IN ('MULTIPLICADOR','IMPUESTO')) <> 2
     THEN RAISE EXCEPTION 'se borro el multiplicador o el impuesto de precios'; END IF;

  RAISE NOTICE 'RESET OK — catalogos intactos, operacion en cero.';
END $$;

\echo '--- DESPUES ---'
SELECT 'ventas' t, count(*) n FROM ventas
UNION ALL SELECT 'movimientos_caja', count(*) FROM movimientos_caja
UNION ALL SELECT 'movimientos_inventario', count(*) FROM movimientos_inventario
UNION ALL SELECT 'sesiones_caja', count(*) FROM sesiones_caja
UNION ALL SELECT 'insumos (conservados)', count(*) FROM insumos
UNION ALL SELECT 'recetas (conservadas)', count(*) FROM producto_insumos
UNION ALL SELECT 'clientes (conservados)', count(*) FROM clientes
UNION ALL SELECT 'sellos fuego (conservados)', coalesce(sum(stamps_count),0)::bigint FROM clientes
ORDER BY 1;

-- ============================================================================
--  CAMBIAR A COMMIT SOLO CON AUTORIZACION EXPLICITA.
--  Tal como esta, este script NO modifica nada.
-- ============================================================================
ROLLBACK;
