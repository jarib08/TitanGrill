-- =====================================================================
-- FASE 1.4 — ENDURECIMIENTO DE FUNCIONES
-- Fecha: 2026-09-27
--
-- HALLAZGO B6: search_path no fijado en funciones SECURITY DEFINER
--   Una funcion SECURITY DEFINER sin SET search_path puede ser inducida a
--   resolver un nombre de tabla o funcion contra un esquema controlado por el
--   atacante (search_path hijacking), ejecutandose con los privilegios del
--   propietario. Entre las afectadas estaban cerrar_caja y
--   calcular_saldo_global. Otras funciones del mismo proyecto SI lo tenian
--   fijado, asi que era una omision, no una decision.
--
--   Se verifico antes de aplicar que NINGUNA de estas funciones usa funciones
--   de extension sin calificar (pgcrypto y uuid-ossp viven en el esquema
--   "extensions"), por lo que fijar search_path a 'public' no rompe nada.
--
-- HALLAZGO: EXECUTE concedido a anon en funciones de negocio
--   Casi todas las funciones tenian PUBLIC EXECUTE por defecto. Sus guards
--   internos (fn_is_socio / fn_is_worker) ya las defienden — un anonimo
--   recibe "Acceso denegado" — asi que esto es defensa en profundidad, no el
--   agujero activo. Reduce la superficie de ataque.
--
-- EXCLUSIONES DELIBERADAS (NO se les revoca EXECUTE a anon)
--   fn_is_worker / fn_is_socio / fn_is_admin
--     Las evaluan las politicas RLS, y el rol que consulta necesita poder
--     ejecutarlas. Revocarlas convertiria un "0 filas" en un error de
--     permisos (por ejemplo en costos_select_worker, que es roles={public}).
--     No filtran informacion: devuelven un booleano sobre el propio llamador.
--   Funciones de trigger (RETURNS trigger)
--     PostgreSQL no verifica EXECUTE del usuario que ejecuta el DML: el
--     permiso se valida al crear el trigger. Revocar no aporta nada y podria
--     romper el INSERT publico de clientes, que dispara set_referral_code.
--   get_client_by_referral_code, fn_cliente_por_celular, fn_cliente_por_id,
--   fn_registrar_cliente_publico
--     Son las cuatro que la landing publica necesita de verdad.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Fijar search_path (generado desde el catalogo, sin reescribir cuerpos)
-- ---------------------------------------------------------------
ALTER FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) SET search_path TO 'public';
ALTER FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) SET search_path TO 'public';
ALTER FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) SET search_path TO 'public';
ALTER FUNCTION public.calcular_saldo_global() SET search_path TO 'public';
ALTER FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) SET search_path TO 'public';
ALTER FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) SET search_path TO 'public';
ALTER FUNCTION public.fn_immutable_cost_snapshot() SET search_path TO 'public';
ALTER FUNCTION public.generate_referral_code() SET search_path TO 'public';
ALTER FUNCTION public.get_client_by_referral_code(ref_code text) SET search_path TO 'public';
ALTER FUNCTION public.process_referral_bonus(new_client_id uuid) SET search_path TO 'public';
ALTER FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) SET search_path TO 'public';
ALTER FUNCTION public.trigger_check_referral_bonus() SET search_path TO 'public';
ALTER FUNCTION public.trigger_referral_bonus() SET search_path TO 'public';
ALTER FUNCTION public.validate_referral_code(code text) SET search_path TO 'public';

-- ---------------------------------------------------------------
-- 2. Quitar EXECUTE a anon y PUBLIC en las funciones de negocio
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.calcular_saldo_global() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcular_saldo_global() FROM anon;
GRANT  EXECUTE ON FUNCTION public.calcular_saldo_global() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.process_referral_bonus(new_client_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_referral_bonus(new_client_id uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_referral_bonus(new_client_id uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.validate_referral_code(code text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_referral_code(code text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.validate_referral_code(code text) TO authenticated, service_role;

COMMIT;
