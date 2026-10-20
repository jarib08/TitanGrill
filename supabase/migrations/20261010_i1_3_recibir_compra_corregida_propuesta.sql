-- =============================================================================
-- Migracion: 20261010_i1_3_recibir_compra_corregida_propuesta.sql
-- Proposito: Propuesta corregida de recibir_compra que resuelve el hallazgo
--            de logica trivaluada SQL en p_metodo_pago = NULL identificado
--            en la auditoria de Fase 10 (Fase 11).
--
-- CAMBIOS RESPECTO A I1.2 (20261010_i1_2):
--   1. Correccion en validacion de metodo de pago:
--      Antes: IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
--             (Si p_metodo_pago era NULL, la expresion evaluaba a UNKNOWN y se
--              saltaba el guard, detonando una excepcion CHECK no controlada en BD).
--      Ahora: IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
--             (Captura de forma controlada NULL, vacios y cadenas no permitidas).
--   2. Preserva el retiro de la sobrecarga antigua de 2 parametros (DROP FUNCTION).
--   3. Preserva la guarda de sesion obligatoria para pagos en EFECTIVO.
--   4. Preserva la compatibilidad de sesion_id = NULL para BANCOLOMBIA y NEQUI fuera de turno.
--   5. Preserva la idempotencia, FOR UPDATE y snapshots inmutables de inventario.
--
-- RESTRICCIONES:
--   - PROPUESTA LOCAL CONTROLADA: NO APLICAR EN PRODUCCION HASTA PRUEBAS EN STAGING.
--   - NO modifica el movimiento historico d6f798e9 ($38.650 Bancolombia).
-- =============================================================================

-- 1. Eliminar la sobrecarga legacy de 2 parametros para erradicar ambiguedades
DROP FUNCTION IF EXISTS public.recibir_compra(uuid, text);

-- 2. Definir la funcion corregida con 3 parametros y valores predeterminados
CREATE OR REPLACE FUNCTION public.recibir_compra(
  p_compra_id uuid,
  p_metodo_pago text DEFAULT 'EFECTIVO'::text,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_total numeric;
  v_existing_key uuid;
  v_detail record;
  v_mov_id uuid;
  v_sesion_id uuid;
  v_costo_unitario_val numeric;
  v_costo_total_val numeric;
BEGIN
  -- 1. Guard de Autorizacion: requiere perfil activo con rol Socio Administrador
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT COALESCE(v_is_socio, false) THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- 2. Validar metodo de pago (lista blanca estricta protegida contra NULL y espacios)
  IF p_metodo_pago IS NULL OR trim(p_metodo_pago) NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  -- 3. Bloqueo de fila y verificacion atomica de estado de la compra
  SELECT estado, total, idempotency_key INTO v_estado, v_total, v_existing_key
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  -- 4. Idempotencia y recuperacion segura
  IF v_estado = 'RECIBIDA' THEN
    IF p_idempotency_key IS NOT NULL AND v_existing_key = p_idempotency_key THEN
      RETURN json_build_object(
        'success', true,
        'recovered', true,
        'message', 'La compra ya fue recibida exitosamente (Recuperado)',
        'total', v_total,
        'metodo_pago', p_metodo_pago
      );
    ELSE
      RETURN json_build_object('success', false, 'message', 'La compra ya ha sido procesada o recibida anteriormente');
    END IF;
  END IF;

  IF v_estado != 'BORRADOR' THEN
    RETURN json_build_object('success', false, 'message', 'La compra no se encuentra en estado BORRADOR y no puede ser recibida');
  END IF;

  -- 5. Obtener la sesion activa PROPIA del trabajador autenticado
  --    fn_get_active_session filtra por trabajador_id = auth.uid() y estado = 'ABIERTA'
  v_sesion_id := public.fn_get_active_session(auth.uid());

  -- 6. Regla contable: EFECTIVO exige obligatoriamente sesion abierta del socio
  IF p_metodo_pago = 'EFECTIVO' AND v_sesion_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Para compras pagadas en EFECTIVO se requiere una sesión de caja abierta del trabajador autenticado'
    );
  END IF;

  -- 7. Calcular total real desde compra_detalles (fuente de verdad)
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  -- 8. Transicion atomica de estado e idempotency_key
  UPDATE public.compras
  SET total = v_total,
      metodo_pago = p_metodo_pago,
      estado = 'RECIBIDA',
      idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
  WHERE id = p_compra_id;

  -- 9. Registrar egreso financiero en movimientos_caja
  --    v_sesion_id sera la sesion propia del socio o NULL si es pago bancario de tesoreria
  INSERT INTO public.movimientos_caja (
    tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, compra_id, idempotency_key
  ) VALUES (
    'EGRESO',
    v_total,
    p_metodo_pago,
    'Pago de compra de insumos',
    auth.uid(),
    v_sesion_id,
    p_compra_id,
    p_idempotency_key
  ) RETURNING id INTO v_mov_id;

  -- 10. Actualizar inventario con SNAPSHOT historico de costos
  FOR v_detail IN
    SELECT insumo_id, cantidad, costo_unitario
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    v_costo_unitario_val := COALESCE(v_detail.costo_unitario, 0);
    v_costo_total_val := ROUND(v_detail.cantidad * v_costo_unitario_val, 2);

    UPDATE public.insumos
    SET stock_actual = stock_actual + v_detail.cantidad,
        costo_unitario = CASE WHEN v_detail.costo_unitario > 0 THEN v_detail.costo_unitario ELSE costo_unitario END,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    INSERT INTO public.movimientos_inventario (
      insumo_id, tipo, cantidad, motivo, compra_id, usuario_id,
      costo_unitario_historico, costo_total_historico
    ) VALUES (
      v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad,
      'Recepción de compra', auth.uid(),
      v_costo_unitario_val, v_costo_total_val
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'recovered', false,
    'message', 'Compra recibida, inventario alimentado y egreso financiero registrado',
    'movimiento_caja_id', v_mov_id,
    'total', v_total,
    'metodo_pago', p_metodo_pago,
    'sesion_id', v_sesion_id
  );
END;
$$;

-- 3. Permisos de seguridad reforzados
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;
