-- =====================================================================
-- FASE G1.3 — AJUSTE DE DATOS DE NOMINA (decisiones del dueno)
-- Fecha: 2026-09-27
--
-- Dos cambios de datos, ambos decididos explicitamente:
--   1. tarifa_pago = 40000 para el trabajador. Va por migracion porque NO
--      existe forma de editarlo desde la UI (los unicos UPDATE a
--      perfiles_trabajadores son estado y rol). Desde ahora queda editable con
--      la RPC actualizar_tarifa_trabajador.
--   2. Desactivar los costos de categoria PERSONAL en costos_configuracion.
--      El costo laboral pasa a venir UNICAMENTE de turnos/liquidaciones.
--
-- POR QUE EL PUNTO 2 NO ES OPCIONAL
--   "trabajador1 - Diego" esta como VARIABLE $40.000 DIARIO, y se prorratea por
--   DIA CALENDARIO: 720.000 para el 10-27 de septiembre. Pero solo se paga por
--   DIA TRABAJADO. Si el trabajador labora ~3 dias por semana, el costo real de
--   ese periodo es ~320.000: el P&L cargaba ~400.000 de nomina fantasma, mas el
--   doble conteo con las liquidaciones pagadas.
--
-- Las 2 liquidaciones existentes ($80.000) se conservan INTACTAS como
-- historial sin turno asociado. No se crean turnos retroactivos ficticios.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_n_trab integer;
  v_trab_id uuid;
  v_nombre text;
  v_tarifa_previa numeric;
  v_n_costos integer;
BEGIN
  -- ── 1. Tarifa del trabajador ───────────────────────────────────────
  SELECT count(*) INTO v_n_trab
  FROM public.perfiles_trabajadores WHERE rol = 'TRABAJADOR' AND estado = 'ACTIVO';

  IF v_n_trab = 0 THEN
    RAISE EXCEPTION 'No hay ningun perfil con rol TRABAJADOR activo: revise antes de aplicar.';
  END IF;

  IF v_n_trab > 1 THEN
    -- Deliberadamente se aborta: con varios trabajadores, asignar 40000 a
    -- todos seria una suposicion. Debe hacerse uno por uno con la RPC.
    RAISE EXCEPTION 'Hay % trabajadores activos. Asigne la tarifa individualmente con actualizar_tarifa_trabajador() en vez de aplicar esta migracion.', v_n_trab;
  END IF;

  SELECT id, nombre, COALESCE(tarifa_pago, 0)
    INTO v_trab_id, v_nombre, v_tarifa_previa
  FROM public.perfiles_trabajadores WHERE rol = 'TRABAJADOR' AND estado = 'ACTIVO';

  UPDATE public.perfiles_trabajadores
  SET tarifa_pago = 40000, modalidad_pago = 'POR_TURNO', updated_at = now()
  WHERE id = v_trab_id;

  RAISE NOTICE 'Tarifa de % (%): % -> 40000, modalidad POR_TURNO', v_nombre, v_trab_id, v_tarifa_previa;

  -- ── 2. Desactivar costos de personal ───────────────────────────────
  SELECT count(*) INTO v_n_costos
  FROM public.costos_configuracion WHERE categoria = 'PERSONAL' AND activo;

  UPDATE public.costos_configuracion
  SET activo = false,
      descripcion = COALESCE(descripcion || ' | ', '')
                    || 'Desactivado 2026-09-27: el costo laboral pasa a venir de turnos/liquidaciones pagadas para evitar doble conteo.',
      updated_at = now()
  WHERE categoria = 'PERSONAL' AND activo;

  RAISE NOTICE 'Costos de categoria PERSONAL desactivados: %', v_n_costos;
END $$;

COMMIT;
