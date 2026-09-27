-- =====================================================================
-- FASE 1.2 (PARTE A) — RPCs PUBLICAS DE CLIENTE
-- Fecha: 2026-09-27
--
-- ESTA MIGRACION ES PURAMENTE ADITIVA Y SEGURA DE APLICAR YA.
-- Solo crea funciones nuevas. NO cambia ninguna politica RLS ni toca datos.
-- El cierre de la fuga (cambiar clientes_select_public) va en la PARTE B,
-- que debe aplicarse SOLO DESPUES de desplegar el frontend nuevo.
--
-- HALLAZGO QUE PREPARA (verificado por HTTPS con la anon key real)
--   La politica clientes_select_public es "cmd=SELECT roles={public}
--   USING=true": cualquiera con la anon key — que va publicada en el bundle
--   JS — puede descargar la base completa de clientes. Comprobado: devolvio
--   los 27 registros con nombre, celular, email y referral_code
--   (content-range: 0-26/27).
--
-- POR QUE NO SE ARREGLA SOLO CON RLS
--   El RLS evalua fila por fila, no consulta por consulta: no existe politica
--   que permita "buscar mi tarjeta por celular exacto" y a la vez prohiba
--   "listar todos". La unica forma es que el acceso publico pase por
--   funciones que exigen un valor exacto y devuelven columnas minimas.
--
-- QUE DEVUELVEN ESTAS FUNCIONES
--   Solo id, nombre, stamps_count y referral_code: los 4 campos que
--   LoyaltyCard realmente usa (verificado en el codigo).
--   NO devuelven celular, email, created_at ni referred_by.
--
-- LIMITACION ACEPTADA Y CONSCIENTE
--   fn_cliente_por_celular permite confirmar si un numero YA conocido esta
--   registrado. Eso es inherente a la funcion "buscar mi tarjeta" y es
--   incomparablemente menos grave que exponer los 27 registros completos.
--   No permite enumerar: exige coincidencia exacta de 10 digitos.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Buscar por celular exacto
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cliente_por_celular(p_celular text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_id uuid; v_nombre text; v_stamps integer; v_code text;
BEGIN
  -- Normaliza a digitos: evita que un espacio o guion cambie el resultado
  v_norm := regexp_replace(COALESCE(p_celular, ''), '\D', '', 'g');

  IF v_norm !~ '^\d{10}$' THEN
    RETURN json_build_object('success', false, 'message', 'Numero de celular invalido.');
  END IF;

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code
    INTO v_id, v_nombre, v_stamps, v_code
  FROM clientes c WHERE c.celular = v_norm LIMIT 1;

  IF v_id IS NULL THEN
    RETURN json_build_object('success', true, 'encontrado', false, 'cliente', NULL);
  END IF;

  RETURN json_build_object('success', true, 'encontrado', true,
    'cliente', json_build_object('id', v_id, 'nombre', v_nombre,
                                 'stamps_count', v_stamps, 'referral_code', v_code));
END;
$function$;

-- ---------------------------------------------------------------
-- 2. Leer la propia tarjeta por id (la usa LoyaltyCard para refrescar)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_cliente_por_id(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_nombre text; v_stamps integer; v_code text;
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

  RETURN json_build_object('success', true, 'encontrado', true,
    'cliente', json_build_object('id', v_id, 'nombre', v_nombre,
                                 'stamps_count', v_stamps, 'referral_code', v_code));
END;
$function$;

-- ---------------------------------------------------------------
-- 3. Registro publico atomico (reemplaza consultar-insertar-reintentar)
-- ---------------------------------------------------------------
-- El frontend hacia: SELECT por celular -> si no existe INSERT -> si choca
-- reintentar el SELECT. Ese patron tiene una carrera real, y ademas el
-- reintento era CODIGO MUERTO: no existe indice unico sobre clientes.celular,
-- asi que la unique_violation que esperaba nunca podia ocurrir. Dos personas
-- registrandose a la vez con el mismo numero creaban DOS tarjetas.
--
-- Aqui se serializa por numero con un lock de transaccion, que funciona con o
-- sin indice unico.
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

  -- Serializa por numero. Dos registros simultaneos del mismo celular se
  -- encolan y el segundo encuentra al primero en vez de duplicarlo.
  PERFORM pg_advisory_xact_lock(hashtext('cliente_celular:' || v_norm));

  SELECT c.id, c.nombre, c.stamps_count, c.referral_code
    INTO v_id, v_out_nombre, v_stamps, v_code
  FROM clientes c WHERE c.celular = v_norm LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'creado', false,
      'cliente', json_build_object('id', v_id, 'nombre', v_out_nombre,
                                   'stamps_count', v_stamps, 'referral_code', v_code));
  END IF;

  -- Solo se acepta un referidor que exista de verdad; si no, se ignora en
  -- silencio en vez de reventar por la foreign key.
  v_ref := NULL;
  IF p_referred_by IS NOT NULL AND EXISTS (SELECT 1 FROM clientes WHERE id = p_referred_by) THEN
    v_ref := p_referred_by;
  END IF;

  -- referral_code lo genera el trigger set_referral_code (8 caracteres sin
  -- ambiguos, con verificacion de unicidad). No se genera aqui a proposito.
  INSERT INTO clientes (nombre, celular, email, stamps_count, referred_by)
  VALUES (v_nombre, v_norm, v_email, 0, v_ref)
  RETURNING id, nombre, stamps_count, referral_code
  INTO v_id, v_out_nombre, v_stamps, v_code;

  RETURN json_build_object('success', true, 'creado', true,
    'cliente', json_build_object('id', v_id, 'nombre', v_out_nombre,
                                 'stamps_count', v_stamps, 'referral_code', v_code));
END;
$function$;

-- ---------------------------------------------------------------
-- Permisos: estas tres SI deben ser accesibles por anon (landing publica)
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_celular(text)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_cliente_por_celular(text)      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_registrar_cliente_publico(text, text, text, uuid) TO anon, authenticated, service_role;

COMMIT;
