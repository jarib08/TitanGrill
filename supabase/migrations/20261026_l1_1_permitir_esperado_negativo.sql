-- ============================================================================
--  L1.1 — Permitir que el efectivo esperado de una sesion sea negativo
-- ============================================================================
--  PROBLEMA
--  El CHECK (monto_cierre_esperado >= 0) parte de un supuesto falso: que el
--  efectivo esperado de una caja nunca puede ser negativo. Si puede: cuando los
--  retiros de socios superan el efectivo que entro por ventas, el esperado es
--  legitimamente negativo.
--
--  CONSECUENCIA OBSERVADA
--  La sesion d23831d6 (10-oct-2026) no se pudo cerrar por este CHECK y alguien
--  la forzo con un UPDATE directo dejando esperado/contado/diferencia en NULL:
--  33 dias con $297.810 de ventas y $1.541.180 de retiros quedaron SIN arqueo.
--  El CHECK no evito el descuadre, solo destruyo la evidencia de que existia.
--
--  DECISION
--  Un arqueo debe poder registrar la verdad, incluso cuando la verdad es
--  incomoda. Se elimina el CHECK de 'esperado'.
--
--  QUE NO SE TOCA (a proposito)
--    monto_cierre_contado >= 0 : el efectivo FISICO contado nunca es negativo.
--    monto_apertura      >= 0 : la base con la que se abre nunca es negativa.
--  Esos dos siguen siendo invariantes reales y se conservan.
--
--  cerrar_caja no necesita cambios: ya calcula y escribe el valor real, era el
--  CHECK el unico que lo rechazaba.
-- ============================================================================

BEGIN;

ALTER TABLE public.sesiones_caja
  DROP CONSTRAINT IF EXISTS sesiones_caja_monto_cierre_esperado_check;

COMMENT ON COLUMN public.sesiones_caja.monto_cierre_esperado IS
  'Efectivo esperado al cierre = apertura + movimientos de la sesion. Puede ser '
  'NEGATIVO cuando los retiros superan el efectivo ingresado; eso es un dato '
  'valido del arqueo, no un error. Ver migracion 20261026_l1_1.';

-- ── Verificacion ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conrelid='public.sesiones_caja'::regclass
               AND conname='sesiones_caja_monto_cierre_esperado_check') THEN
    RAISE EXCEPTION 'el CHECK de esperado sigue presente';
  END IF;

  -- los otros dos invariantes DEBEN seguir ahi
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sesiones_caja'::regclass
                   AND conname='sesiones_caja_monto_cierre_contado_check') THEN
    RAISE EXCEPTION 'se perdio el CHECK de contado, que debia conservarse';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid='public.sesiones_caja'::regclass
                   AND conname='sesiones_caja_monto_apertura_check') THEN
    RAISE EXCEPTION 'se perdio el CHECK de apertura, que debia conservarse';
  END IF;

  RAISE NOTICE 'L1.1 OK: esperado admite negativos; contado y apertura siguen protegidos.';
END $$;

COMMIT;
