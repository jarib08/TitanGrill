-- =====================================================================
-- FASE G1.2 — RPCs DE TURNOS + ARREGLOS DE pagar_liquidacion
-- Fecha: 2026-09-27
-- Diseno: FASE_G_DISENO_TURNOS_Y_NOMINA.md
-- =====================================================================

BEGIN;

-- =====================================================================
-- A. ARREGLOS A pagar_liquidacion (aceptados por el dueno)
-- =====================================================================
-- 1. FOR UPDATE: leia la liquidacion sin bloqueo, asi que dos clics
--    simultaneos podian pagar dos veces.
-- 2. Ambiguedad de caja: si p_sesion_id era NULL tomaba CUALQUIER caja
--    abierta, en silencio. Ahora: si hay exactamente UNA la usa (que es el
--    flujo real del negocio: el dinero sale de la caja fisica del turno), si
--    hay CERO o VARIAS falla pidiendo que se especifique.
--    No se exige sesion explicita porque el administrador no tiene caja
--    abierta: la tiene el trabajador, y de ahi sale el efectivo.
-- 3. Fallback de suplantacion: si auth.uid() era NULL tomaba un socio
--    cualquiera. Inalcanzable porque fn_is_socio() ya falla antes, pero es
--    codigo muerto peligroso.
CREATE OR REPLACE FUNCTION public.pagar_liquidacion(
  p_liquidacion_id uuid,
  p_cuenta_origen  text DEFAULT 'EFECTIVO'::text,
  p_sesion_id      uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_liq RECORD;
    v_mov_id UUID;
    v_user_id UUID;
    v_sesion_id UUID;
    v_abiertas INTEGER;
BEGIN
    IF NOT public.fn_is_socio() THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
    END IF;

    -- FOR UPDATE: serializa dos pagos simultaneos de la misma liquidacion.
    SELECT * INTO v_liq FROM public.liquidaciones WHERE id = p_liquidacion_id FOR UPDATE;
    IF v_liq.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Liquidación no encontrada.');
    END IF;
    IF v_liq.estado = 'PAGADO' THEN
        RETURN json_build_object('success', false, 'message', 'La liquidación ya se encuentra pagada.');
    END IF;
    IF v_liq.estado = 'ANULADO' THEN
        RETURN json_build_object('success', false, 'message', 'No se puede pagar una liquidación anulada.');
    END IF;

    -- Resolver caja sin ambiguedad
    IF p_sesion_id IS NOT NULL THEN
        SELECT id INTO v_sesion_id FROM public.sesiones_caja
        WHERE id = p_sesion_id AND estado = 'ABIERTA';
        IF v_sesion_id IS NULL THEN
            RETURN json_build_object('success', false, 'message', 'La sesión de caja indicada no existe o no está abierta.');
        END IF;
    ELSE
        SELECT count(*) INTO v_abiertas FROM public.sesiones_caja WHERE estado = 'ABIERTA';
        IF v_abiertas = 0 THEN
            RETURN json_build_object('success', false, 'message', 'No hay ninguna caja abierta. Abra la caja antes de registrar el pago.');
        END IF;
        IF v_abiertas > 1 THEN
            RETURN json_build_object('success', false,
              'message', format('Hay %s cajas abiertas: indique de cuál sale el pago.', v_abiertas));
        END IF;
        SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA';
    END IF;

    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, liquidacion_id
    ) VALUES (
        'EGRESO', v_liq.monto_calculado, p_cuenta_origen,
        'Pago de liquidación a trabajador (' || v_liq.modalidad || ')',
        v_user_id, v_sesion_id, p_liquidacion_id
    ) RETURNING id INTO v_mov_id;

    UPDATE public.liquidaciones
    SET estado = 'PAGADO', cuenta_pago = p_cuenta_origen,
        movimiento_caja_id = v_mov_id, updated_at = now()
    WHERE id = p_liquidacion_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Liquidación pagada exitosamente. Se ha registrado el egreso en caja.',
        'movimiento_caja_id', v_mov_id,
        'sesion_id', v_sesion_id
    );
END;
$function$;

-- =====================================================================
-- B. Editor seguro de la tarifa
-- =====================================================================
-- tarifa_pago pasa a ser la fuente de la nomina y hoy NO existe forma de
-- editarlo desde la UI: los unicos UPDATE a perfiles_trabajadores son estado y
-- rol. Sin esto, cambiar la tarifa exigiria una migracion cada vez.
CREATE OR REPLACE FUNCTION public.actualizar_tarifa_trabajador(
  p_trabajador_id uuid,
  p_tarifa        numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_rol text; v_nombre text; v_anterior numeric;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  IF p_tarifa IS NULL OR p_tarifa < 0 THEN
    RETURN json_build_object('success', false, 'message', 'La tarifa no puede ser negativa.');
  END IF;

  SELECT rol, nombre, COALESCE(tarifa_pago, 0)
    INTO v_rol, v_nombre, v_anterior
  FROM public.perfiles_trabajadores WHERE id = p_trabajador_id FOR UPDATE;

  IF v_rol IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El trabajador no existe.');
  END IF;

  UPDATE public.perfiles_trabajadores
  SET tarifa_pago = p_tarifa, updated_at = now()
  WHERE id = p_trabajador_id;

  -- Los turnos ya registrados conservan su tarifa_aplicada: el cambio solo
  -- afecta a los turnos futuros.
  RETURN json_build_object('success', true,
    'message', format('Tarifa de %s actualizada de %s a %s. Los turnos ya registrados conservan su valor.',
                      v_nombre, v_anterior, p_tarifa),
    'tarifa_anterior', v_anterior, 'tarifa_nueva', p_tarifa);
END;
$function$;

-- =====================================================================
-- C. Registrar un turno
-- =====================================================================
CREATE OR REPLACE FUNCTION public.registrar_turno(
  p_trabajador_id uuid,
  p_fecha         date DEFAULT NULL,
  p_tarifa        numeric DEFAULT NULL,
  p_observaciones text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid; v_rol text; v_estado text; v_nombre text;
  v_tarifa numeric; v_fecha date; v_hoy date; v_turno_id uuid;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
  END IF;

  -- Hoy en Bogota, no en UTC: la jornada 4pm-9pm cruza la medianoche en UTC.
  v_hoy   := (now() AT TIME ZONE 'America/Bogota')::date;
  v_fecha := COALESCE(p_fecha, v_hoy);

  IF v_fecha > v_hoy THEN
    RETURN json_build_object('success', false,
      'message', format('No se puede registrar un turno con fecha futura (%s). Hoy en Bogotá es %s.', v_fecha, v_hoy));
  END IF;

  SELECT rol, estado, nombre, COALESCE(tarifa_pago, 0)
    INTO v_rol, v_estado, v_nombre, v_tarifa
  FROM public.perfiles_trabajadores WHERE id = p_trabajador_id;

  IF v_rol IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El trabajador no existe.');
  END IF;
  -- Decision del dueno: los turnos son solo para rol TRABAJADOR.
  IF v_rol <> 'TRABAJADOR' THEN
    RETURN json_build_object('success', false,
      'message', format('Los turnos son solo para perfiles con rol TRABAJADOR. %s tiene rol %s.', v_nombre, v_rol));
  END IF;
  IF v_estado <> 'ACTIVO' THEN
    RETURN json_build_object('success', false,
      'message', format('%s no está ACTIVO: no se pueden registrar turnos.', v_nombre));
  END IF;

  IF p_tarifa IS NOT NULL THEN v_tarifa := p_tarifa; END IF;
  IF v_tarifa IS NULL OR v_tarifa <= 0 THEN
    RETURN json_build_object('success', false,
      'message', format('%s no tiene tarifa por turno configurada. Configúrela antes de registrar turnos.', v_nombre));
  END IF;

  BEGIN
    INSERT INTO public.turnos (trabajador_id, fecha, estado, tarifa_aplicada, confirmado_por, observaciones)
    VALUES (p_trabajador_id, v_fecha, 'REGISTRADO', v_tarifa, v_actor, p_observaciones)
    RETURNING id INTO v_turno_id;
  EXCEPTION WHEN unique_violation THEN
    -- Traduce la violacion del indice parcial a un mensaje util
    RETURN json_build_object('success', false,
      'message', format('%s ya tiene un turno registrado el %s. No se puede registrar dos veces el mismo día.', v_nombre, v_fecha),
      'duplicado', true);
  END;

  RETURN json_build_object('success', true, 'turno_id', v_turno_id,
    'trabajador', v_nombre, 'fecha', v_fecha, 'tarifa', v_tarifa,
    'message', format('Turno de %s registrado para el %s por %s.', v_nombre, v_fecha, v_tarifa));
END;
$function$;

-- =====================================================================
-- D. Pagar un turno
-- =====================================================================
CREATE OR REPLACE FUNCTION public.pagar_turno(
  p_turno_id      uuid,
  p_cuenta_origen text DEFAULT 'EFECTIVO',
  p_sesion_id     uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_turno RECORD; v_liq_id uuid; v_pago json; v_nombre text;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- FOR UPDATE: dos clics simultaneos sobre el mismo turno se serializan y el
  -- segundo encuentra el estado ya en PAGADO.
  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id FOR UPDATE;
  IF v_turno.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El turno no existe.');
  END IF;
  IF v_turno.estado = 'PAGADO' THEN
    RETURN json_build_object('success', false, 'message', 'Este turno ya fue pagado.', 'liquidacion_id', v_turno.liquidacion_id);
  END IF;
  IF v_turno.estado = 'ANULADO' THEN
    RETURN json_build_object('success', false, 'message', 'No se puede pagar un turno anulado.');
  END IF;

  SELECT nombre INTO v_nombre FROM public.perfiles_trabajadores WHERE id = v_turno.trabajador_id;

  -- Se reutiliza el modelo de liquidaciones a proposito: fn_estado_resultados
  -- ya lee liquidaciones PAGADO como nomina del periodo, y el P&L ya excluye
  -- los movimientos_caja con liquidacion_id para no contar el egreso dos veces.
  INSERT INTO public.liquidaciones (trabajador_id, modalidad, monto_calculado, observaciones, estado, fecha)
  VALUES (v_turno.trabajador_id, 'POR_TURNO', v_turno.tarifa_aplicada,
          format('Turno del %s', v_turno.fecha), 'PENDIENTE', now())
  RETURNING id INTO v_liq_id;

  v_pago := public.pagar_liquidacion(v_liq_id, p_cuenta_origen, p_sesion_id);

  IF NOT (v_pago->>'success')::boolean THEN
    -- Aborta todo: no queda liquidacion huerfana ni turno a medio pagar.
    RAISE EXCEPTION 'PAGO_TURNO_FALLIDO: %', v_pago->>'message';
  END IF;

  UPDATE public.turnos
  SET estado = 'PAGADO', liquidacion_id = v_liq_id, updated_at = now()
  WHERE id = p_turno_id;

  RETURN json_build_object('success', true,
    'turno_id', p_turno_id, 'liquidacion_id', v_liq_id,
    'movimiento_caja_id', v_pago->>'movimiento_caja_id',
    'monto', v_turno.tarifa_aplicada,
    'message', format('Turno de %s del %s pagado: %s.', v_nombre, v_turno.fecha, v_turno.tarifa_aplicada));
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'PAGO_TURNO_FALLIDO:%' THEN
    RETURN json_build_object('success', false,
      'message', replace(SQLERRM, 'PAGO_TURNO_FALLIDO: ', ''));
  END IF;
  RAISE;
END;
$function$;

-- =====================================================================
-- E. Accion compuesta: la que usa el boton de la UI
-- =====================================================================
CREATE OR REPLACE FUNCTION public.cerrar_y_pagar_turno(
  p_trabajador_id uuid,
  p_fecha         date DEFAULT NULL,
  p_cuenta_origen text DEFAULT 'EFECTIVO',
  p_observaciones text DEFAULT NULL,
  p_sesion_id     uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_reg json; v_pago json;
BEGIN
  v_reg := public.registrar_turno(p_trabajador_id, p_fecha, NULL, p_observaciones);
  IF NOT (v_reg->>'success')::boolean THEN
    RETURN v_reg;   -- el mensaje ya es explicativo (duplicado, futuro, rol...)
  END IF;

  v_pago := public.pagar_turno((v_reg->>'turno_id')::uuid, p_cuenta_origen, p_sesion_id);
  IF NOT (v_pago->>'success')::boolean THEN
    -- Aborta tambien el registro: o queda turno pagado, o no queda nada.
    RAISE EXCEPTION 'CERRAR_TURNO_FALLIDO: %', v_pago->>'message';
  END IF;

  RETURN v_pago;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'CERRAR_TURNO_FALLIDO:%' THEN
    RETURN json_build_object('success', false,
      'message', replace(SQLERRM, 'CERRAR_TURNO_FALLIDO: ', ''));
  END IF;
  RAISE;
END;
$function$;

-- =====================================================================
-- F. Anular un turno
-- =====================================================================
CREATE OR REPLACE FUNCTION public.anular_turno(p_turno_id uuid, p_motivo text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_turno RECORD;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  SELECT * INTO v_turno FROM public.turnos WHERE id = p_turno_id FOR UPDATE;
  IF v_turno.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El turno no existe.');
  END IF;
  IF v_turno.estado = 'ANULADO' THEN
    RETURN json_build_object('success', false, 'message', 'El turno ya está anulado.');
  END IF;
  -- Mover dinero hacia atras debe ser un acto explicito, no un efecto
  -- secundario de anular el turno.
  IF v_turno.estado = 'PAGADO' THEN
    RETURN json_build_object('success', false,
      'message', 'Este turno ya fue pagado. Anule primero la liquidación asociada (eso genera el movimiento compensatorio en caja) y el turno se anulará automáticamente.',
      'liquidacion_id', v_turno.liquidacion_id);
  END IF;

  UPDATE public.turnos
  SET estado = 'ANULADO',
      observaciones = COALESCE(observaciones || ' | ', '') || 'ANULADO: ' || COALESCE(p_motivo, 'sin motivo'),
      updated_at = now()
  WHERE id = p_turno_id;

  RETURN json_build_object('success', true,
    'message', format('Turno del %s anulado. La fecha queda libre para registrar de nuevo.', v_turno.fecha));
END;
$function$;

-- =====================================================================
-- G. Consulta de turnos del periodo (UI + conciliacion)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_turnos_periodo(p_desde date, p_hasta date)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_turnos json; v_tot_pagado numeric; v_tot_pendiente numeric; v_n_pagados int; v_n_pendientes int;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde THEN
    RETURN json_build_object('success', false, 'message', 'Rango de fechas inválido.');
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
           'id', t.id, 'fecha', t.fecha, 'trabajador_id', t.trabajador_id,
           'trabajador', p.nombre, 'estado', t.estado,
           'tarifa_aplicada', t.tarifa_aplicada, 'liquidacion_id', t.liquidacion_id,
           'observaciones', t.observaciones, 'registrado_en', t.created_at
         ) ORDER BY t.fecha DESC, p.nombre), '[]'::json),
         COALESCE(SUM(CASE WHEN t.estado='PAGADO'     THEN t.tarifa_aplicada ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN t.estado='REGISTRADO' THEN t.tarifa_aplicada ELSE 0 END), 0),
         count(*) FILTER (WHERE t.estado='PAGADO'),
         count(*) FILTER (WHERE t.estado='REGISTRADO')
  INTO v_turnos, v_tot_pagado, v_tot_pendiente, v_n_pagados, v_n_pendientes
  FROM public.turnos t
  JOIN public.perfiles_trabajadores p ON p.id = t.trabajador_id
  WHERE t.fecha >= p_desde AND t.fecha <= p_hasta;

  RETURN json_build_object('success', true,
    'turnos', v_turnos,
    'total_pagado', round(v_tot_pagado, 2),
    'total_pendiente', round(v_tot_pendiente, 2),
    'turnos_pagados', v_n_pagados,
    'turnos_pendientes', v_n_pendientes);
END;
$function$;

-- =====================================================================
-- H. Permisos: nada de esto es para anon
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('registrar_turno','pagar_turno','cerrar_y_pagar_turno','anular_turno',
       'fn_turnos_periodo','actualizar_tarifa_trabajador')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

COMMIT;
