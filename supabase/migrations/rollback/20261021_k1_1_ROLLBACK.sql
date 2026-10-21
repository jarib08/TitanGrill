-- Rollback del Paquete A.
-- ADVERTENCIA: reabre la atribucion de movimientos a cajas ajenas.
-- Las definiciones ORIGINALES de crear_gasto, registrar_movimiento_manual y
-- anular_compra estan en 00000000000000_baseline_recuperado_de_produccion.sql.
-- No se restauran automaticamente a proposito: volver al comportamiento
-- anterior debe ser un acto deliberado.
BEGIN;
DROP FUNCTION IF EXISTS public.fn_resolver_sesion_movimiento(text, uuid);
COMMIT;
