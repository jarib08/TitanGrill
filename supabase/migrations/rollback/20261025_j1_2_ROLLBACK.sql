-- =====================================================================
-- ROLLBACK FASE D-1.2 — VINCULACION AUTOMATICA ANEIAP POR CELULAR
-- Fecha: 2026-10-25
-- =====================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_asociados_aneiap_celular_norm;
DROP FUNCTION IF EXISTS public.fn_normalizar_celular_co(text);

ALTER TABLE public.asociados_aneiap
DROP CONSTRAINT IF EXISTS check_metodo_verificacion;

ALTER TABLE public.asociados_aneiap
ADD CONSTRAINT check_metodo_verificacion CHECK (
    metodo_verificacion IN ('PENDIENTE', 'CARNE_PRESENCIAL', 'VALIDACION_ADMIN')
);

DROP FUNCTION IF EXISTS public.fn_vincular_asociado_por_celular(uuid, text);

-- Restaurar fn_registrar_cliente_publico a version previa (20260927_f1_2)
CREATE OR REPLACE FUNCTION public.fn_registrar_cliente_publico(
  p_nombre      text,
  p_celular     text,
  p_email       text DEFAULT NULL,
  p_referred_by uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text; v_nombre text; v_email text; v_ref uuid;
  v_id uuid; v_out_nombre text; v_stamps integer; v_code text;
BEGIN
  v_norm   := regexp_replace(COALESCE(p_celular, ''), '\D', '', 'g');
  v_nombre := trim(COALESCE(p_nombre, ''));
  v_email  := NULLIF(trim(COALESCE(p_email, '')), '');

  IF v_norm !~ '^\d{10}$' THEN
    RETURN json_build_object('success', false, 'message', 'El numero debe tener exactamente 10 digitos.');
  END IF;
  IF length(v_nombre) < 2 THEN
    RETURN json_build_object('success', false, 'message', 'El nombre es obligatorio.');
  END IF;
  IF length(v_nombre) > 120 THEN
    RETURN json_build_object('success', false, 'message', 'El nombre es demasiado largo.');
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN json_build_object('success', false, 'message', 'El formato del email no es valido.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('cliente_celular:' || v_norm));

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code
    INTO v_id, v_out_nombre, v_stamps, v_code
  FROM clientes c WHERE c.celular = v_norm LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'creado', false,
      'cliente', json_build_object('id', v_id, 'nombre', v_out_nombre,
                                   'stamps_count', v_stamps, 'referral_code', v_code));
  END IF;

  v_ref := NULL;
  IF p_referred_by IS NOT NULL AND EXISTS (SELECT 1 FROM clientes WHERE id = p_referred_by) THEN
    v_ref := p_referred_by;
  END IF;

  INSERT INTO clientes (nombre, celular, email, stamps_count, referred_by)
  VALUES (v_nombre, v_norm, v_email, 0, v_ref)
  RETURNING id, nombre, stamps_count, referral_code
  INTO v_id, v_out_nombre, v_stamps, v_code;

  RETURN json_build_object('success', true, 'creado', true,
    'cliente', json_build_object('id', v_id, 'nombre', v_out_nombre,
                                 'stamps_count', v_stamps, 'referral_code', v_code));
END;
$function$;

-- Restaurar fn_cliente_por_id a version D-1.1
CREATE OR REPLACE FUNCTION public.fn_cliente_por_id(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_nombre text;
  v_stamps integer;
  v_code text;
  v_asoc_id uuid;
  v_es_aneiap boolean := false;
  v_estado_aneiap text := 'NO_ASOCIADO';
  v_descuento_pct numeric := 0;
  v_consumidas_hoy integer := 0;
  v_disponibles_hoy integer := 0;
  v_fecha_hoy date;
BEGIN
  IF p_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Identificador requerido.');
  END IF;

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code
    INTO v_id, v_nombre, v_stamps, v_code
  FROM clientes c WHERE c.id = p_id;

  IF v_id IS NULL THEN
    RETURN json_build_object('success', true, 'encontrado', false, 'cliente', NULL);
  END IF;

  SELECT
    a.id,
    (a.activo = true AND a.estado = 'ACTIVO'),
    a.estado,
    a.descuento_porcentaje
  INTO v_asoc_id, v_es_aneiap, v_estado_aneiap, v_descuento_pct
  FROM public.asociados_aneiap a
  WHERE a.cliente_id = v_id
  LIMIT 1;

  IF v_asoc_id IS NOT NULL AND v_es_aneiap = true THEN
    v_fecha_hoy := (now() AT TIME ZONE 'America/Bogota')::date;
    SELECT COALESCE(SUM(unidades_descontadas), 0)
    INTO v_consumidas_hoy
    FROM public.asociado_consumos_aneiap
    WHERE asociado_id = v_asoc_id
      AND fecha_consumo = v_fecha_hoy
      AND estado = 'ACTIVO';

    v_disponibles_hoy := GREATEST(0, 2 - v_consumidas_hoy);
  END IF;

  RETURN json_build_object(
    'success', true,
    'encontrado', true,
    'cliente', json_build_object(
      'id', v_id,
      'nombre', v_nombre,
      'stamps_count', v_stamps,
      'referral_code', v_code,
      'es_aneiap', COALESCE(v_es_aneiap, false),
      'estado_aneiap', COALESCE(v_estado_aneiap, 'NO_ASOCIADO'),
      'descuento_porcentaje', COALESCE(v_descuento_pct, 0),
      'unidades_consumidas_hoy', COALESCE(v_consumidas_hoy, 0),
      'unidades_disponibles_hoy', COALESCE(v_disponibles_hoy, 0)
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) TO anon, authenticated, service_role;

COMMIT;
