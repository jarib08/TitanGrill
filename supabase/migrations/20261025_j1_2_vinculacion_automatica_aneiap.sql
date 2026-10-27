-- =====================================================================
-- FASE D-1.2 — VINCULACION AUTOMATICA ANEIAP POR CELULAR
-- Fecha: 2026-10-25
-- Rama: handoff/titan-grill-continuidad-tecnica
--
-- OBJETIVO:
--   1. Permitir que los asociados ANEIAP precargados en public.asociados_aneiap
--      se vinculen automaticamente a su tarjeta de fidelizacion al registrarse
--      o ingresar con su numero de celular.
--   2. Garantizar que clientes existentes con sellos y referidos NO se dupliquen
--      ni pierdan su historial.
--   3. Proteger la integridad relacional: solo asociar registros con estado ACTIVO
--      y activo = true; NO reactivar registros inactivos ni sobreescribir vinculaciones.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. FUNCION AUXILIAR IMMUTABLE DE NORMALIZACION DE CELULAR (+57 / 10 DIGITOS)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_normalizar_celular_co(p_celular text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN regexp_replace(COALESCE(p_celular, ''), '\D', '', 'g') ~ '^57\d{10}$'
      THEN substr(regexp_replace(COALESCE(p_celular, ''), '\D', '', 'g'), 3)
    ELSE regexp_replace(COALESCE(p_celular, ''), '\D', '', 'g')
  END;
$$;

-- ---------------------------------------------------------------------
-- 1b. INDICE FUNCIONAL PARA NORMALIZACION RAPIDA DE CELULAR
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_asociados_aneiap_celular_norm
ON public.asociados_aneiap (public.fn_normalizar_celular_co(celular));

-- ---------------------------------------------------------------------
-- 1c. EXTENDER RESTRICCION check_metodo_verificacion PARA AUTO_CELULAR
-- ---------------------------------------------------------------------
ALTER TABLE public.asociados_aneiap
DROP CONSTRAINT IF EXISTS check_metodo_verificacion;

ALTER TABLE public.asociados_aneiap
ADD CONSTRAINT check_metodo_verificacion CHECK (
    metodo_verificacion IN ('PENDIENTE', 'CARNE_PRESENCIAL', 'VALIDACION_ADMIN', 'AUTO_CELULAR')
);

-- ---------------------------------------------------------------------
-- 2. FUNCION INTERNA/PUBLICA: fn_vincular_asociado_por_celular
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_vincular_asociado_por_celular(
  p_cliente_id uuid,
  p_celular text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_candidatos_count integer;
  v_asoc_id uuid;
  v_asoc_cliente_id uuid;
  v_ya_vinculado_id uuid;
BEGIN
  IF p_cliente_id IS NULL THEN
    RETURN json_build_object('success', false, 'vinculado', false, 'message', 'cliente_id requerido.');
  END IF;

  v_norm := public.fn_normalizar_celular_co(p_celular);
  IF v_norm !~ '^\d{10}$' THEN
    RETURN json_build_object('success', false, 'vinculado', false, 'message', 'Celular invalido.');
  END IF;

  -- Advisory lock para serializar operaciones sobre este celular en asociados
  PERFORM pg_advisory_xact_lock(hashtext('asociado_celular:' || v_norm));

  -- 1. Verificar si este cliente YA tiene un asociado vinculado
  SELECT id INTO v_ya_vinculado_id
  FROM public.asociados_aneiap
  WHERE cliente_id = p_cliente_id
  LIMIT 1;

  IF v_ya_vinculado_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'vinculado', true,
      'razon', 'YA_VINCULADO_A_ESTE_CLIENTE',
      'asociado_id', v_ya_vinculado_id
    );
  END IF;

  -- 2. Buscar candidatos en asociados_aneiap que coincidan en celular normalizado
  -- REGLA OBLIGATORIA: Solo se consideran registros activos elegibles (activo = true AND estado = 'ACTIVO')
  -- Registros con activo = false o estados INACTIVO/REVOCADO/PENDIENTE_CORRECCION no se vinculan.
  SELECT COUNT(*), (array_agg(id))[1]
  INTO v_candidatos_count, v_asoc_id
  FROM public.asociados_aneiap
  WHERE public.fn_normalizar_celular_co(celular) = v_norm
    AND activo = true
    AND estado = 'ACTIVO';

  -- Si no hay candidatos activos con ese celular
  IF v_candidatos_count = 0 THEN
    RETURN json_build_object(
      'success', true,
      'vinculado', false,
      'razon', 'NO_COINCIDE_PADRON_ACTIVO'
    );
  END IF;

  -- Si hay mas de un candidato activo con el mismo celular (registro ambiguo - Caso E)
  IF v_candidatos_count > 1 THEN
    RETURN json_build_object(
      'success', false,
      'vinculado', false,
      'razon', 'REGISTROS_AMBIGUOS_MULTIPLE_COINCIDENCIA',
      'message', 'Existen multiples asociados activos con el mismo numero celular.'
    );
  END IF;

  -- Tenemos exactamente 1 candidato activo: v_asoc_id
  SELECT cliente_id INTO v_asoc_cliente_id
  FROM public.asociados_aneiap
  WHERE id = v_asoc_id;

  -- Si ya esta vinculado a otro cliente, NO sobrescribir (Caso D)
  IF v_asoc_cliente_id IS NOT NULL AND v_asoc_cliente_id <> p_cliente_id THEN
    RETURN json_build_object(
      'success', true,
      'vinculado', false,
      'razon', 'YA_VINCULADO_A_OTRO_CLIENTE',
      'message', 'El registro ANEIAP ya se encuentra vinculado a otra cuenta.'
    );
  END IF;

  -- Si estaba libre (cliente_id IS NULL), vincularlo de forma atomica
  UPDATE public.asociados_aneiap
  SET cliente_id = p_cliente_id,
      metodo_verificacion = CASE
        WHEN metodo_verificacion = 'PENDIENTE' THEN 'AUTO_CELULAR'
        ELSE metodo_verificacion
      END,
      updated_at = now()
  WHERE id = v_asoc_id
    AND cliente_id IS NULL;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'vinculado', true,
      'razon', 'VINCULACION_EXITOSA',
      'asociado_id', v_asoc_id
    );
  ELSE
    RETURN json_build_object(
      'success', true,
      'vinculado', false,
      'razon', 'CONCURRENCIA_YA_ASIGNADO'
    );
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. ACTUALIZACION ADITIVA DE fn_registrar_cliente_publico
-- ---------------------------------------------------------------------
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
  v_es_aneiap boolean := false;
  v_estado_aneiap text := 'NO_ASOCIADO';
  v_descuento_pct numeric := 0;
  v_consumidas_hoy integer := 0;
  v_disponibles_hoy integer := 0;
  v_fecha_hoy date;
  v_asoc_id uuid;
BEGIN
  v_norm   := public.fn_normalizar_celular_co(p_celular);
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

  -- Lock para serializar registros por numero
  PERFORM pg_advisory_xact_lock(hashtext('cliente_celular:' || v_norm));

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code
    INTO v_id, v_out_nombre, v_stamps, v_code
  FROM clientes c WHERE c.celular = v_norm LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Cliente existente: Vincular con ANEIAP si coincide el celular con padron disponible
    PERFORM public.fn_vincular_asociado_por_celular(v_id, v_norm);

    -- Consultar estado ANEIAP resultante
    SELECT a.id, (a.activo = true AND a.estado = 'ACTIVO'), a.estado, a.descuento_porcentaje
    INTO v_asoc_id, v_es_aneiap, v_estado_aneiap, v_descuento_pct
    FROM public.asociados_aneiap a WHERE a.cliente_id = v_id LIMIT 1;

    IF v_asoc_id IS NOT NULL AND v_es_aneiap = true THEN
      v_fecha_hoy := (now() AT TIME ZONE 'America/Bogota')::date;
      SELECT COALESCE(SUM(unidades_descontadas), 0) INTO v_consumidas_hoy
      FROM public.asociado_consumos_aneiap
      WHERE asociado_id = v_asoc_id AND fecha_consumo = v_fecha_hoy AND estado = 'ACTIVO';
      v_disponibles_hoy := GREATEST(0, 2 - v_consumidas_hoy);
    END IF;

    RETURN json_build_object('success', true, 'creado', false,
      'cliente', json_build_object(
        'id', v_id, 'nombre', v_out_nombre,
        'stamps_count', v_stamps, 'referral_code', v_code,
        'es_aneiap', COALESCE(v_es_aneiap, false),
        'estado_aneiap', COALESCE(v_estado_aneiap, 'NO_ASOCIADO'),
        'descuento_porcentaje', COALESCE(v_descuento_pct, 0),
        'unidades_consumidas_hoy', COALESCE(v_consumidas_hoy, 0),
        'unidades_disponibles_hoy', COALESCE(v_disponibles_hoy, 0)
      ));
  END IF;

  -- Cliente nuevo: insertar
  v_ref := NULL;
  IF p_referred_by IS NOT NULL AND EXISTS (SELECT 1 FROM clientes WHERE id = p_referred_by) THEN
    v_ref := p_referred_by;
  END IF;

  INSERT INTO clientes (nombre, celular, email, stamps_count, referred_by)
  VALUES (v_nombre, v_norm, v_email, 0, v_ref)
  RETURNING id, nombre, stamps_count, referral_code
  INTO v_id, v_out_nombre, v_stamps, v_code;

  -- Vincular con ANEIAP de forma automatica
  PERFORM public.fn_vincular_asociado_por_celular(v_id, v_norm);

  -- Consultar estado ANEIAP resultante
  SELECT a.id, (a.activo = true AND a.estado = 'ACTIVO'), a.estado, a.descuento_porcentaje
  INTO v_asoc_id, v_es_aneiap, v_estado_aneiap, v_descuento_pct
  FROM public.asociados_aneiap a WHERE a.cliente_id = v_id LIMIT 1;

  IF v_asoc_id IS NOT NULL AND v_es_aneiap = true THEN
    v_fecha_hoy := (now() AT TIME ZONE 'America/Bogota')::date;
    SELECT COALESCE(SUM(unidades_descontadas), 0) INTO v_consumidas_hoy
    FROM public.asociado_consumos_aneiap
    WHERE asociado_id = v_asoc_id AND fecha_consumo = v_fecha_hoy AND estado = 'ACTIVO';
    v_disponibles_hoy := GREATEST(0, 2 - v_consumidas_hoy);
  END IF;

  RETURN json_build_object('success', true, 'creado', true,
    'cliente', json_build_object(
      'id', v_id, 'nombre', v_out_nombre,
      'stamps_count', v_stamps, 'referral_code', v_code,
      'es_aneiap', COALESCE(v_es_aneiap, false),
      'estado_aneiap', COALESCE(v_estado_aneiap, 'NO_ASOCIADO'),
      'descuento_porcentaje', COALESCE(v_descuento_pct, 0),
      'unidades_consumidas_hoy', COALESCE(v_consumidas_hoy, 0),
      'unidades_disponibles_hoy', COALESCE(v_disponibles_hoy, 0)
    ));
END;
$function$;

-- ---------------------------------------------------------------------
-- 4. ACTUALIZACION ADITIVA DE fn_cliente_por_id
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cliente_por_id(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_nombre text;
  v_stamps integer;
  v_code text;
  v_celular text;
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

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code, c.celular
    INTO v_id, v_nombre, v_stamps, v_code, v_celular
  FROM clientes c WHERE c.id = p_id;

  IF v_id IS NULL THEN
    RETURN json_build_object('success', true, 'encontrado', false, 'cliente', NULL);
  END IF;

  -- Si el cliente existe pero no tiene asociado vinculado aun,
  -- intentamos vincularlo si en asociados_aneiap hay un registro activo disponible
  IF NOT EXISTS (SELECT 1 FROM public.asociados_aneiap WHERE cliente_id = v_id) THEN
    IF v_celular IS NOT NULL AND length(v_celular) >= 10 THEN
      -- Verificamos si existe candidato antes de intentar vincular
      IF EXISTS (
        SELECT 1 FROM public.asociados_aneiap a
        WHERE public.fn_normalizar_celular_co(a.celular) = public.fn_normalizar_celular_co(v_celular)
          AND a.activo = true
          AND a.estado = 'ACTIVO'
          AND a.cliente_id IS NULL
      ) THEN
        PERFORM public.fn_vincular_asociado_por_celular(v_id, v_celular);
      END IF;
    END IF;
  END IF;

  -- Comprobar membresia ANEIAP de forma segura sin exponer datos privados de terceros
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

-- ---------------------------------------------------------------------
-- 5. PERMISOS DE EJECUCION
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_normalizar_celular_co(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_normalizar_celular_co(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_vincular_asociado_por_celular(uuid, text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) TO anon, authenticated, service_role;

COMMIT;
