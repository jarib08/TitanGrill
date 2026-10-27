-- ROLLBACK de L1.1 — restaura el CHECK de esperado >= 0
-- ADVERTENCIA: si ya existe alguna sesion con monto_cierre_esperado < 0, este
-- rollback FALLARA. Eso es correcto: no se debe borrar un arqueo real para
-- poder volver a poner la restriccion.
BEGIN;
ALTER TABLE public.sesiones_caja
  ADD CONSTRAINT sesiones_caja_monto_cierre_esperado_check
  CHECK (monto_cierre_esperado >= 0);
COMMIT;
