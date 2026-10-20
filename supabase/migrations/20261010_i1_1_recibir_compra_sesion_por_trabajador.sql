-- =============================================================================
-- Migracion: 20261010_i1_1_recibir_compra_sesion_por_trabajador.sql
-- Proposito: Corregir la asignacion de sesion en recibir_compra.
--
-- PROBLEMA:
--   La sobrecarga actual obtiene la sesion con:
--     SELECT id FROM sesiones_caja WHERE estado = 'ABIERTA'
--     ORDER BY fecha_apertura DESC LIMIT 1;
--   Esto puede asignar la sesion de OTRO trabajador cuando hay varias abiertas.
--
-- SOLUCION:
--   Usar fn_get_active_session(auth.uid()) que filtra por trabajador autenticado.
--   Si el socio no tiene sesion activa, v_sesion_id queda NULL (comportamiento
--   existente preservado: el movimiento se registra sin sesion en lugar de
--   asignarse a la sesion equivocada).
--
-- COMPATIBILIDAD:
--   - Firma RPC sin cambios: (uuid, text DEFAULT, uuid DEFAULT NULL)
--   - Frontend no necesita cambios
--   - Idempotencia, FOR UPDATE y snapshot de costos preservados
--
-- RESTRICCIONES:
--   - NO modifica la sobrecarga antigua (2 parametros)
--   - NO aplica retroactivamente al movimiento historico d6f798e9
--   - NO ejecutar hasta autorizacion explicita y prueba en staging
-- =============================================================================

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
  -- 1. Guard: requiere rol Socio Administrador
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- 2. Validar metodo de pago (lista blanca explicita)
  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Metodo de pago invalido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  -- 3. Bloqueo de fila y verificacion atomica de estado
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

  -- 5. CORRECCION: Obtener la sesion activa del trabajador autenticado.
  --    fn_get_active_session filtra por trabajador_id = p_trabajador_id.
  --    Bug original: ORDER BY fecha_apertura DESC LIMIT 1 sin filtro por trabajador.
  --    Si el socio no tiene sesion, v_sesion_id = NULL (no asigna sesion ajena).
  v_sesion_id := public.fn_get_active_session(auth.uid());

  -- 6. Calcular total real desde compra_detalles
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  -- 7. Transicion atomica de estado e idempotency_key
  UPDATE public.compras
  SET total = v_total,
      metodo_pago = p_metodo_pago,
      estado = 'RECIBIDA',
      idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
  WHERE id = p_compra_id;

  -- 8. Registrar egreso financiero en movimientos_caja
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

  -- 9. Actualizar inventario con SNAPSHOT historico de costos
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
      'Recepcion de compra', p_compra_id, auth.uid(),
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

-- Preservar permisos de produccion
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recibir_compra(uuid, text, uuid) TO authenticated, service_role;
