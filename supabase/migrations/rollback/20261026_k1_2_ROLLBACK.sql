-- ROLLBACK de K1.2 — reabre la firma legada de anular_compra.
-- Solo para emergencia: reabre el bypass de la regla de sesion de caja.
GRANT EXECUTE ON FUNCTION public.anular_compra(uuid, text) TO authenticated;
