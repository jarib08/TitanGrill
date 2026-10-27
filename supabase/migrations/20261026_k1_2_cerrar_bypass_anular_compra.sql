-- ============================================================================
--  K1.2 — Cerrar el bypass de la firma legada de anular_compra
-- ============================================================================
--  K1.1 centralizo la resolucion de sesion de caja en
--  fn_resolver_sesion_movimiento y parcho crear_gasto,
--  registrar_movimiento_manual y anular_compra(uuid,text,uuid).
--
--  Pero quedo alcanzable anular_compra(uuid,text) -- la firma vieja de 2
--  argumentos. Escribe en movimientos_caja con su propia logica de sesion y
--  cualquier usuario 'authenticated' podia invocarla, con lo cual la regla
--  centralizada era evitable llamando la firma corta.
--
--  El frontend usa exclusivamente la de 3 argumentos (con idempotency_key):
--  AdminDashboard.jsx:1925. La de 2 no tiene ningun llamador.
--
--  No se elimina la funcion (podria haber dependencias no visibles); se le
--  retira EXECUTE para que deje de ser una via de escritura.
--
--  SIN BEGIN/COMMIT internos a proposito: asi se puede ensayar dentro de una
--  transaccion externa y revertir. Aplicar con:  psql -1 -f <archivo>
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.anular_compra(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.anular_compra(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.anular_compra(uuid, text) FROM PUBLIC;

COMMENT ON FUNCTION public.anular_compra(uuid, text) IS
  'LEGADO, SIN PERMISOS DE EJECUCION. Sustituida por anular_compra(uuid,text,uuid), '
  'que resuelve la sesion de caja via fn_resolver_sesion_movimiento. Ver 20261026_k1_2.';

DO $$
BEGIN
  IF has_function_privilege('authenticated','public.anular_compra(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated todavia puede ejecutar la firma legada';
  END IF;
  IF has_function_privilege('anon','public.anular_compra(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'anon todavia puede ejecutar la firma legada';
  END IF;
  -- la firma vigente DEBE seguir funcionando
  IF NOT has_function_privilege('authenticated','public.anular_compra(uuid,text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'se rompio la firma vigente de 3 argumentos';
  END IF;
  RAISE NOTICE 'K1.2 OK: firma legada sin EXECUTE; la de 3 argumentos intacta.';
END $$;
