-- Rollback de J1.1. Solo elimina objetos nuevos; no toca ningun dato de negocio.
BEGIN;
DROP FUNCTION IF EXISTS public.actualizar_fecha_corte_confiabilidad(date);
DROP FUNCTION IF EXISTS public.fn_fecha_corte_confiabilidad();
DROP TABLE IF EXISTS public.configuracion_sistema;
COMMIT;
