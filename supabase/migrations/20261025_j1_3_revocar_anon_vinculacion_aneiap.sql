-- =====================================================================
-- FASE D-1.3 — REVOCAR ACCESO ANON A fn_vincular_asociado_por_celular
-- Fecha: 2026-10-25
-- Rama: handoff/titan-grill-continuidad-tecnica
--
-- MOTIVO:
--   fn_vincular_asociado_por_celular(uuid, text) es una funcion interna
--   diseñada para ser ejecutada dentro de las RPCs de registro y consulta:
--     - fn_registrar_cliente_publico (SECURITY DEFINER)
--     - fn_cliente_por_id (SECURITY DEFINER)
--   El frontend no requiere ni invoca directamente esta funcion.
--   Revocar EXECUTE a anon y PUBLIC previene su invocacion directa no
--   autorizada via PostgREST RPC, mientras que las funciones publicas
--   SECURITY DEFINER continuan ejecutandola internamente con los permisos
--   del propietario sin interrupcion.
-- =====================================================================

BEGIN;

-- 1. Revocar permiso publico y anonimo
REVOKE EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) FROM anon;

-- 2. Mantener permiso unicamente para roles autorizados de backend y trabajadores autenticados
GRANT EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) TO authenticated, service_role;

COMMIT;
