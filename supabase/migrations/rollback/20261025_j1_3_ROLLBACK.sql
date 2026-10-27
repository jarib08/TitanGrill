-- =====================================================================
-- ROLLBACK FASE D-1.3 — RESTAURAR PERMISOS PREVIOS EN fn_vincular_asociado_por_celular
-- Fecha: 2026-10-25
-- =====================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) TO anon, authenticated, service_role;

COMMIT;
