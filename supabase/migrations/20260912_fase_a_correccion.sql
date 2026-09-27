-- TITAN GRILL: MIGRACIÓN FASE A - Corrección de caja (V3 Post-Revisión)

-- 1. Crear índice único para evitar concurrencia y cajas dobles por trabajador
CREATE UNIQUE INDEX IF NOT EXISTS idx_sesion_unica_abierta 
ON public.sesiones_caja (trabajador_id) 
WHERE estado = 'ABIERTA';

-- 2. Modificar fn_get_active_session para asegurar determinismo
CREATE OR REPLACE FUNCTION public.fn_get_active_session(p_trabajador_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sesion_id uuid;
BEGIN
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = p_trabajador_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC
  LIMIT 1;
  
  RETURN v_sesion_id;
END;
$function$;

-- 3. Modificar abrir_caja para envolver en try/catch unique_violation
CREATE OR REPLACE FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric DEFAULT 0, p_apertura_bancolombia numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_active_sesion_id uuid;
  v_new_sesion_id uuid;
  v_is_worker boolean;
BEGIN
  SELECT public.fn_is_worker() INTO v_is_worker;
  IF NOT v_is_worker THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;

  SELECT public.fn_get_active_session(auth.uid()) INTO v_active_sesion_id;
  IF v_active_sesion_id IS NOT NULL THEN
    -- Modificado de success=false a success=true para resolver problemas frontend de idempotencia
    RETURN json_build_object('success', true, 'message', 'Ya tienes una sesion de caja abierta', 'sesion_id', v_active_sesion_id);
  END IF;

  BEGIN
    INSERT INTO public.sesiones_caja (trabajador_id, monto_apertura, apertura_nequi, apertura_bancolombia, estado)
    VALUES (auth.uid(), p_monto_apertura, COALESCE(p_apertura_nequi, 0), COALESCE(p_apertura_bancolombia, 0), 'ABIERTA')
    RETURNING id INTO v_new_sesion_id;
  EXCEPTION WHEN unique_violation THEN
    -- Choque de concurrencia detectado, recuperamos id
    SELECT id INTO v_new_sesion_id FROM public.sesiones_caja WHERE trabajador_id = auth.uid() AND estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;
    RETURN json_build_object('success', true, 'message', 'La caja ya estaba abierta (Concurrencia)', 'sesion_id', v_new_sesion_id);
  END;

  RETURN json_build_object(
    'success', true,
    'message', 'Caja abierta con exito',
    'sesion_id', v_new_sesion_id
  );
END;
$function$;

-- 4. Modificar registrar_saldo_inicial para requerir p_sesion_id explícitamente y usar bloqueo por fila FOR UPDATE
CREATE OR REPLACE FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric DEFAULT 0, p_nequi numeric DEFAULT 0, p_bancolombia numeric DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_socio boolean;
  v_user_id uuid;
  v_estado text;
  v_count integer;
  v_locked_sesion_id uuid;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  v_user_id := auth.uid();
  
  -- Bloquear la fila de la sesión para evitar concurrencia en la misma sesión
  SELECT id, estado INTO v_locked_sesion_id, v_estado 
  FROM public.sesiones_caja 
  WHERE id = p_sesion_id 
  FOR UPDATE;
  
  IF v_locked_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'La sesion de caja no existe.');
  END IF;
  
  IF v_estado != 'ABIERTA' THEN
    RETURN json_build_object('success', false, 'message', 'La sesion de caja no esta ABIERTA.');
  END IF;

  -- Validar si la SESIÓN ya tiene saldo inicial (protegido por FOR UPDATE)
  SELECT COUNT(*) INTO v_count FROM public.movimientos_caja WHERE sesion_id = p_sesion_id AND tipo_operacion = 'SALDO_INICIAL';
  IF v_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'El saldo inicial ya fue registrado anteriormente en esta sesion.');
  END IF;

  IF COALESCE(p_efectivo, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_efectivo, 'EFECTIVO', 'Saldo inicial del negocio - Efectivo', v_user_id, p_sesion_id, 'SALDO_INICIAL');
  END IF;

  IF COALESCE(p_nequi, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_nequi, 'NEQUI', 'Saldo inicial del negocio - Nequi', v_user_id, p_sesion_id, 'SALDO_INICIAL');
  END IF;

  IF COALESCE(p_bancolombia, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_bancolombia, 'BANCOLOMBIA', 'Saldo inicial del negocio - Bancolombia', v_user_id, p_sesion_id, 'SALDO_INICIAL');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Saldo inicial registrado exitosamente',
    'sesion_id', p_sesion_id,
    'efectivo', COALESCE(p_efectivo, 0),
    'nequi', COALESCE(p_nequi, 0),
    'bancolombia', COALESCE(p_bancolombia, 0)
  );
END;
$function$;
