-- =====================================================================
-- FASE H1.2 — BLOQUEAR LA ESCRITURA DIRECTA DE stock_actual
-- Fecha: 2026-09-27
--
-- ############################################################
-- ##  NO APLICAR ANTES DE DESPLEGAR EL FRONTEND NUEVO       ##
-- ############################################################
--
-- El build actualmente en produccion escribe stock_actual directamente desde
-- DOS lugares:
--   - handleAjustarStock (el ajuste manual)
--   - handleSaveInsumo   (el formulario de EDITAR insumo, que incluye
--                         stock_actual en su payload de UPDATE)
--
-- El segundo es el mas grave de los dos: editar el nombre o el costo de un
-- insumo sobrescribe su stock con el valor que tenia cargado el formulario, y
-- NO deja ningun registro en movimientos_inventario. Cero trazabilidad.
--
-- Aplicar esta migracion antes del despliegue rompe ambos flujos.
--
-- ORDEN CORRECTO:
--   1. (ya hecho) aplicar 20260927_h1_1_ajuste_stock_atomico.sql  <- aditivo
--   2. desplegar el frontend que usa ajustar_stock_insumo y que ya NO manda
--      stock_actual al editar un insumo
--   3. verificar en la app: ajustar stock y editar un insumo
--   4. recien entonces aplicar ESTA migracion
--
-- QUE HACE
--   Revoca el privilegio de columna UPDATE(stock_actual). A partir de ahi, el
--   stock SOLO puede cambiar por funciones SECURITY DEFINER (ajustar_stock_insumo,
--   registrar_merma_trabajador, registrar_venta, recibir_compra,
--   registrar_carga_masiva_inventario), que son atomicas, bloquean la fila y
--   dejan rastro en movimientos_inventario.
--
--   Es control a nivel de columna porque el RLS no puede expresarlo: una
--   politica aplica a la fila completa, no a un subconjunto de columnas. Y el
--   INSERT se conserva, para poder crear un insumo con su stock inicial.
-- =====================================================================

-- DETALLE DE POSTGRESQL QUE COSTO UNA PRUEBA FALLIDA
--   Un "REVOKE UPDATE (columna)" NO revoca un privilegio concedido a nivel de
--   TABLA. La tabla insumos tiene relacl = authenticated=arwdDxtm, es decir
--   UPDATE sobre todas las columnas. Revocar solo la columna era un no-op y la
--   escritura directa seguia funcionando.
--   El orden correcto es: revocar UPDATE de la TABLA, y luego conceder UPDATE
--   sobre la lista explicita de columnas permitidas.

BEGIN;

REVOKE UPDATE ON public.insumos FROM authenticated;
REVOKE UPDATE ON public.insumos FROM anon;

-- Columnas que un socio SI puede editar (la politica insumos_modify sigue
-- exigiendo fn_is_socio()). stock_actual queda deliberadamente fuera.
GRANT UPDATE (nombre, unidad_medida, stock_minimo, costo_unitario, activo, updated_at)
  ON public.insumos TO authenticated;

COMMIT;
