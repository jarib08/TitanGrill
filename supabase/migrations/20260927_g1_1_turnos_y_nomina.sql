-- =====================================================================
-- FASE G1.1 — TURNOS COMO FUENTE OFICIAL DE LA NOMINA
-- Fecha: 2026-09-27
-- Diseno y criterios de aceptacion: FASE_G_DISENO_TURNOS_Y_NOMINA.md
--
-- REGLA DE NEGOCIO
--   El trabajador labora ~4pm-9pm (Bogota), no todos los dias. Cada dia
--   trabajado = 1 turno = $40.000 fijos. El administrador confirma el turno al
--   cerrar y paga de inmediato. Un solo turno por trabajador por fecha. Una vez
--   pagado, el valor queda congelado.
--
-- sesiones_caja NO es fuente de asistencia. Los turnos son independientes.
--
-- POR QUE ESTO CORRIGE LA CONTABILIDAD
--   Hoy el costo laboral entra por dos vias: costos_configuracion cobra
--   $40.000 por DIA CALENDARIO (720.000 en septiembre) y las liquidaciones
--   suman 80.000 aparte. Como solo se paga por DIA TRABAJADO, el P&L carga
--   cientos de miles de nomina fantasma. Con turnos, el costo laboral del
--   periodo es exactamente 40.000 x turnos pagados, conciliable contra caja.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. TABLA turnos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.turnos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trabajador_id   uuid NOT NULL REFERENCES public.perfiles_trabajadores(id),
  -- date, NO timestamptz: la jornada 4pm-9pm de Bogota cruza la medianoche en
  -- UTC (21:00Z a 02:00Z del dia siguiente). Derivar la fecha de un timestamp
  -- sin convertir a America/Bogota mandaria las ultimas dos horas de cada
  -- jornada al dia siguiente.
  fecha           date NOT NULL,
  estado          text NOT NULL DEFAULT 'REGISTRADO',
  -- Snapshot de perfiles_trabajadores.tarifa_pago al registrar. Subir la
  -- tarifa manana no altera los turnos ya registrados.
  tarifa_aplicada numeric(14,2) NOT NULL,
  liquidacion_id  uuid NULL REFERENCES public.liquidaciones(id),
  confirmado_por  uuid NOT NULL REFERENCES public.perfiles_trabajadores(id),
  observaciones   text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT turnos_estado_check
    CHECK (estado IN ('REGISTRADO','PAGADO','ANULADO')),
  CONSTRAINT turnos_tarifa_positiva
    CHECK (tarifa_aplicada > 0),
  -- Un turno PAGADO siempre tiene liquidacion; uno REGISTRADO nunca.
  -- ANULADO puede tener o no, para conservar el historial de un pago revertido.
  CONSTRAINT turnos_pagado_tiene_liquidacion
    CHECK (estado <> 'PAGADO' OR liquidacion_id IS NOT NULL),
  CONSTRAINT turnos_registrado_sin_liquidacion
    CHECK (estado <> 'REGISTRADO' OR liquidacion_id IS NULL)
);

COMMENT ON TABLE public.turnos IS
  'Asistencia explicita: un registro por dia efectivamente trabajado. Fuente oficial de la nomina. NO se deriva de sesiones_caja.';
COMMENT ON COLUMN public.turnos.fecha IS
  'Dia real trabajado en hora de Bogota. Elegido explicitamente, nunca derivado de un timestamp.';
COMMENT ON COLUMN public.turnos.created_at IS
  'Cuando se REGISTRO el turno. Distinto de fecha: permite registrar turnos pasados.';
COMMENT ON COLUMN public.turnos.tarifa_aplicada IS
  'Valor congelado al registrar. Inmutable una vez el turno esta PAGADO.';

-- ---------------------------------------------------------------
-- 2. EL ANTI-DOBLE-PAGO ES UNA RESTRICCION, NO CODIGO
-- ---------------------------------------------------------------
-- Parcial a proposito: un turno registrado por error se anula y el dia queda
-- libre otra vez. Pero no pueden coexistir dos turnos vigentes del mismo
-- trabajador el mismo dia, ni por doble clic, ni por dos pestanas, ni por una
-- condicion de carrera. La base lo rechaza.
CREATE UNIQUE INDEX IF NOT EXISTS idx_turno_unico_por_dia
  ON public.turnos (trabajador_id, fecha)
  WHERE estado <> 'ANULADO';

CREATE INDEX IF NOT EXISTS idx_turnos_fecha        ON public.turnos (fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_estado       ON public.turnos (estado);
CREATE INDEX IF NOT EXISTS idx_turnos_liquidacion  ON public.turnos (liquidacion_id);

-- ---------------------------------------------------------------
-- 3. NO SE PUEDEN REGISTRAR TURNOS FUTUROS
-- ---------------------------------------------------------------
-- Va en trigger y no en CHECK: un CHECK con now() no es inmutable y puede
-- dejar un dump irrestaurable. El trigger tambien bloquea el INSERT directo,
-- no solo la RPC.
CREATE OR REPLACE FUNCTION public.fn_turno_sin_fecha_futura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.fecha > (now() AT TIME ZONE 'America/Bogota')::date THEN
    RAISE EXCEPTION 'No se puede registrar un turno con fecha futura (fecha=%, hoy en Bogota=%)',
      NEW.fecha, (now() AT TIME ZONE 'America/Bogota')::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_turno_sin_fecha_futura ON public.turnos;
CREATE TRIGGER trg_turno_sin_fecha_futura
  BEFORE INSERT OR UPDATE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.fn_turno_sin_fecha_futura();

-- ---------------------------------------------------------------
-- 4. CONGELAMIENTO DEL VALOR PAGADO — turnos
-- ---------------------------------------------------------------
-- Mismo patron que fn_immutable_cost_snapshot de la Fase D2.1.
-- Necesario porque las politicas de liquidaciones llamadas "..._rpc_only" NO
-- lo son: INSERT y UPDATE estan abiertos a cualquier socio via REST.
CREATE OR REPLACE FUNCTION public.fn_turno_inmutable_si_pagado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.estado <> 'PAGADO' THEN
    RETURN NEW;
  END IF;

  IF NEW.tarifa_aplicada IS DISTINCT FROM OLD.tarifa_aplicada THEN
    RAISE EXCEPTION 'turnos.tarifa_aplicada es inmutable en un turno PAGADO. turno=%, valor_previo=%, intentado=%',
      OLD.id, OLD.tarifa_aplicada, NEW.tarifa_aplicada;
  END IF;
  IF NEW.fecha IS DISTINCT FROM OLD.fecha THEN
    RAISE EXCEPTION 'turnos.fecha es inmutable en un turno PAGADO. turno=%', OLD.id;
  END IF;
  IF NEW.trabajador_id IS DISTINCT FROM OLD.trabajador_id THEN
    RAISE EXCEPTION 'turnos.trabajador_id es inmutable en un turno PAGADO. turno=%', OLD.id;
  END IF;
  IF NEW.liquidacion_id IS DISTINCT FROM OLD.liquidacion_id THEN
    RAISE EXCEPTION 'turnos.liquidacion_id es inmutable en un turno PAGADO. turno=%', OLD.id;
  END IF;
  -- Unica transicion de estado permitida: PAGADO -> ANULADO, que ocurre cuando
  -- se anula la liquidacion asociada.
  IF NEW.estado NOT IN ('PAGADO','ANULADO') THEN
    RAISE EXCEPTION 'Un turno PAGADO solo puede pasar a ANULADO (intentado: %). turno=%', NEW.estado, OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_turno_inmutable_si_pagado ON public.turnos;
CREATE TRIGGER trg_turno_inmutable_si_pagado
  BEFORE UPDATE ON public.turnos
  FOR EACH ROW EXECUTE FUNCTION public.fn_turno_inmutable_si_pagado();

-- ---------------------------------------------------------------
-- 5. CONGELAMIENTO DEL VALOR PAGADO — liquidaciones
-- ---------------------------------------------------------------
-- Hoy NADA protege monto_calculado, y es el numero que el P&L usa como nomina.
CREATE OR REPLACE FUNCTION public.fn_liquidacion_inmutable_si_pagada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.estado <> 'PAGADO' THEN
    RETURN NEW;
  END IF;

  IF NEW.monto_calculado IS DISTINCT FROM OLD.monto_calculado THEN
    RAISE EXCEPTION 'liquidaciones.monto_calculado es inmutable en una liquidacion PAGADA. liquidacion=%, valor_previo=%, intentado=%',
      OLD.id, OLD.monto_calculado, NEW.monto_calculado;
  END IF;
  IF NEW.trabajador_id IS DISTINCT FROM OLD.trabajador_id THEN
    RAISE EXCEPTION 'liquidaciones.trabajador_id es inmutable en una liquidacion PAGADA. liquidacion=%', OLD.id;
  END IF;
  IF NEW.movimiento_caja_id IS DISTINCT FROM OLD.movimiento_caja_id THEN
    RAISE EXCEPTION 'liquidaciones.movimiento_caja_id es inmutable en una liquidacion PAGADA. liquidacion=%', OLD.id;
  END IF;
  IF NEW.estado NOT IN ('PAGADO','ANULADO') THEN
    RAISE EXCEPTION 'Una liquidacion PAGADA solo puede pasar a ANULADO (intentado: %). liquidacion=%', NEW.estado, OLD.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_liquidacion_inmutable_si_pagada ON public.liquidaciones;
CREATE TRIGGER trg_liquidacion_inmutable_si_pagada
  BEFORE UPDATE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_liquidacion_inmutable_si_pagada();

-- ---------------------------------------------------------------
-- 6. ANULAR LA LIQUIDACION ANULA SUS TURNOS
-- ---------------------------------------------------------------
-- Garantiza consistencia sea quien sea el que anule y por donde sea, sin tocar
-- la RPC anular_liquidacion existente.
CREATE OR REPLACE FUNCTION public.fn_propagar_anulacion_liquidacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado = 'ANULADO' AND OLD.estado <> 'ANULADO' THEN
    UPDATE public.turnos
       SET estado = 'ANULADO', updated_at = now()
     WHERE liquidacion_id = NEW.id AND estado <> 'ANULADO';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagar_anulacion_liquidacion ON public.liquidaciones;
CREATE TRIGGER trg_propagar_anulacion_liquidacion
  AFTER UPDATE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_propagar_anulacion_liquidacion();

-- ---------------------------------------------------------------
-- 7. RLS: lectura acotada, escritura solo por RPC
-- ---------------------------------------------------------------
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "turnos_select_propio_o_socio" ON public.turnos;
CREATE POLICY "turnos_select_propio_o_socio"
  ON public.turnos FOR SELECT TO authenticated
  USING (public.fn_is_socio() OR trabajador_id = auth.uid());

-- Sin politicas de INSERT/UPDATE/DELETE a proposito: toda escritura entra por
-- las RPCs SECURITY DEFINER. Evita repetir el problema de liquidaciones, cuyas
-- politicas se llaman "..._rpc_only" pero permiten escritura directa.

GRANT SELECT ON public.turnos TO authenticated;
REVOKE ALL ON public.turnos FROM anon;

COMMIT;
