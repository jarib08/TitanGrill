-- =====================================================================
-- ROLLBACK de la Fase H1 (ajuste de stock atomico)
-- =====================================================================
-- ADVERTENCIA: revertir devuelve el ajuste de stock al patron no atomico, sin
-- bloqueo de fila y con clamp silencioso. Los movimientos ya registrados con
-- snapshot de costo NO se tocan: son datos validos.

BEGIN;

-- 1. Devolver el privilegio de columna (reabre la escritura directa de stock)
GRANT UPDATE ON public.insumos TO authenticated;

-- 2. RPC nueva
DROP FUNCTION IF EXISTS public.ajustar_stock_insumo(uuid, text, numeric, text, uuid);

-- 3. registrar_merma_trabajador: la version ORIGINAL (sin snapshot de costo)
--    esta en 00000000000000_baseline_recuperado_de_produccion.sql.
--    NO se restaura automaticamente: quitarle el snapshot solo empobrece el
--    COGS sin arreglar nada.

-- 4. Idempotencia: la columna se CONSERVA a proposito. Eliminarla borraria las
--    claves de los ajustes ya registrados y no aporta nada.
--    Para quitarla de todas formas:
--      DROP INDEX IF EXISTS public.idx_movinv_idempotency;
--      ALTER TABLE public.movimientos_inventario DROP COLUMN IF EXISTS idempotency_key;

COMMIT;
