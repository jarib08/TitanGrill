-- =====================================================================
-- BASELINE RECUPERADO DE PRODUCCION — TITAN GRILL
-- Generado con: pg_dump --schema=public --schema-only (SOLO LECTURA)
-- Servidor: PostgreSQL 17.6
--
-- POR QUE EXISTE ESTE ARCHIVO (hallazgo E1):
--   Hasta ahora supabase/migrations/ tenia solo 2 archivos, mientras que
--   produccion contenia 39 funciones y 42 politicas RLS que NO estaban en
--   Git. Toda la logica contable (registrar_venta, cerrar_caja,
--   recibir_compra, generar_liquidacion, calcular_saldo_global...) existia
--   unicamente en la base de datos: imposible de revisar o revertir.
--
--   Los .sql de la raiz del repo (movidos a supabase/legacy/) NO reflejaban
--   produccion. Ejemplo verificado: supabase_security_hardening.sql declara
--   "clientes UPDATE USING (auth.role()='authenticated')" cuando la politica
--   real en produccion es "clientes_update_admin_only USING fn_is_admin()".
--
-- USO:
--   Este archivo es la FOTO DE REFERENCIA del estado de produccion al
--   momento del handoff. Sirve para diff y revision de codigo.
--   NO esta pensado para re-ejecutarse sobre la base existente.
--   Para reconstruir desde cero usar el dump binario del backup.
--
-- ESTADO CONOCIDO AL MOMENTO DE ESTA FOTO (ver informe de auditoria):
--   - registrar_venta: SECURITY DEFINER sin fn_is_worker(), con fallback
--     que suplanta un trabajador activo si auth.uid() es NULL, y con
--     PUBLIC EXECUTE. VULNERABILIDAD ABIERTA.
--   - 11 funciones SECURITY DEFINER sin SET search_path.
--   - clientes: SELECT e INSERT abiertos a role public.
--   - registrar_saldo_inicial: 2 sobrecargas; el frontend usa la vieja.
--   - realizar_transferencia_interna_test_rollback: funcion de prueba
--     olvidada en produccion.
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: abrir_caja(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric DEFAULT 0, p_apertura_bancolombia numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: anular_compra(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_detail record;
  v_egreso record;
  v_ya_compensado boolean;
BEGIN
  -- 1. Guard: requiere rol Socio Administrador
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- 2. Obtener y validar la compra
  SELECT estado INTO v_estado
  FROM public.compras
  WHERE id = p_compra_id;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  IF v_estado = 'ANULADA' THEN
    RETURN json_build_object('success', false, 'message', 'La compra ya se encuentra anulada');
  END IF;

  -- 3. Si es BORRADOR: anular sin afectar inventario ni caja
  IF v_estado = 'BORRADOR' THEN
    UPDATE public.compras
    SET estado = 'ANULADA',
        observaciones = COALESCE(observaciones || ' | ', '') || 'Anulación borrador: ' || p_motivo
    WHERE id = p_compra_id;
    RETURN json_build_object('success', true, 'message', 'Compra borrador anulada con éxito');
  END IF;

  -- 4. Si es RECIBIDA: verificar stock suficiente para revertir
  FOR v_detail IN
    SELECT cd.insumo_id, cd.cantidad, i.nombre, i.stock_actual
    FROM public.compra_detalles cd
    JOIN public.insumos i ON i.id = cd.insumo_id
    WHERE cd.compra_id = p_compra_id
  LOOP
    IF v_detail.stock_actual < v_detail.cantidad THEN
      RETURN json_build_object(
        'success', false,
        'message', 'No es posible anular la compra. Revertir el stock dejaría saldo negativo para el insumo: ' || v_detail.nombre
      );
    END IF;
  END LOOP;

  -- 5. Idempotencia de reversión financiera:
  --    Verificar si ya existe un movimiento compensatorio (INGRESO) para esta compra
  SELECT EXISTS (
    SELECT 1 FROM public.movimientos_caja
    WHERE compra_id = p_compra_id AND tipo = 'INGRESO'
  ) INTO v_ya_compensado;

  -- 6. Si existe egreso original y no hay compensación aún: crear INGRESO compensatorio
  IF NOT v_ya_compensado THEN
    SELECT id, monto, metodo_pago INTO v_egreso
    FROM public.movimientos_caja
    WHERE compra_id = p_compra_id AND tipo = 'EGRESO'
    LIMIT 1;

    IF v_egreso.id IS NOT NULL THEN
      INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, compra_id
      ) VALUES (
        'INGRESO',
        v_egreso.monto,
        v_egreso.metodo_pago,
        'Reversión financiera por anulación de compra: ' || p_motivo,
        auth.uid(),
        p_compra_id
      );
    END IF;
  END IF;

  -- 7. Actualizar estado de la compra
  UPDATE public.compras
  SET estado = 'ANULADA',
      observaciones = COALESCE(observaciones || ' | ', '') || 'Anulación: ' || p_motivo
  WHERE id = p_compra_id;

  -- 8. Revertir stock e ingresar movimientos de inventario negativos
  FOR v_detail IN
    SELECT insumo_id, cantidad
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    UPDATE public.insumos
    SET stock_actual = stock_actual - v_detail.cantidad,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    INSERT INTO public.movimientos_inventario (insumo_id, tipo, cantidad, motivo, compra_id, usuario_id)
    VALUES (v_detail.insumo_id, 'MERMA', -v_detail.cantidad, 'Reversión por anulación de compra', p_compra_id, auth.uid());
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Compra anulada, stock revertido y movimiento financiero compensado correctamente'
  );
END;
$$;


--
-- Name: anular_compra(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_existing_key uuid;
  v_detail record;
  v_egreso record;
  v_ya_compensado boolean;
  v_sesion_id uuid;
BEGIN
  -- 1. Guard: requiere rol Socio Administrador
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- 2. Bloqueo de fila y verificación atómica de estado (FOR UPDATE para prevenir carreras de concurrencia)
  SELECT estado, idempotency_key INTO v_estado, v_existing_key
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  -- 3. Idempotencia y recuperación segura en anulación
  IF v_estado = 'ANULADA' THEN
    IF p_idempotency_key IS NOT NULL AND v_existing_key = p_idempotency_key THEN
      RETURN json_build_object(
        'success', true,
        'recovered', true,
        'message', 'La compra ya se encuentra anulada (Recuperado)'
      );
    ELSE
      RETURN json_build_object('success', false, 'message', 'La compra ya se encuentra anulada');
    END IF;
  END IF;

  -- 4. Si es BORRADOR: anular sin afectar inventario ni caja
  IF v_estado = 'BORRADOR' THEN
    UPDATE public.compras
    SET estado = 'ANULADA',
        observaciones = COALESCE(observaciones || ' | ', '') || 'Anulación borrador: ' || p_motivo,
        idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
    WHERE id = p_compra_id;
    RETURN json_build_object('success', true, 'recovered', false, 'message', 'Compra borrador anulada con éxito');
  END IF;

  -- 5. Si es RECIBIDA: verificar stock suficiente para revertir
  FOR v_detail IN
    SELECT cd.insumo_id, cd.cantidad, i.nombre, i.stock_actual
    FROM public.compra_detalles cd
    JOIN public.insumos i ON i.id = cd.insumo_id
    WHERE cd.compra_id = p_compra_id
  LOOP
    IF v_detail.stock_actual < v_detail.cantidad THEN
      RETURN json_build_object(
        'success', false,
        'message', 'No es posible anular la compra. Revertir el stock dejaría saldo negativo para el insumo: ' || v_detail.nombre
      );
    END IF;
  END LOOP;

  -- 6. Obtener sesión de caja abierta activa (si existe) para vincular la reversión financiera
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  -- 7. Idempotencia de reversión financiera:
  --    Verificar si ya existe un movimiento compensatorio (INGRESO) para esta compra
  SELECT EXISTS (
    SELECT 1 FROM public.movimientos_caja
    WHERE compra_id = p_compra_id AND tipo = 'INGRESO'
  ) INTO v_ya_compensado;

  -- 8. Si existe egreso original y no hay compensación aún: crear INGRESO compensatorio
  IF NOT v_ya_compensado THEN
    SELECT id, monto, metodo_pago, sesion_id INTO v_egreso
    FROM public.movimientos_caja
    WHERE compra_id = p_compra_id AND tipo = 'EGRESO'
    LIMIT 1;

    IF v_egreso.id IS NOT NULL THEN
      INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, compra_id, idempotency_key
      ) VALUES (
        'INGRESO',
        v_egreso.monto,
        v_egreso.metodo_pago,
        'Reversión financiera por anulación de compra: ' || p_motivo,
        auth.uid(),
        COALESCE(v_sesion_id, v_egreso.sesion_id),
        p_compra_id,
        p_idempotency_key
      );
    END IF;
  END IF;

  -- 9. Transición atómica a estado ANULADA
  UPDATE public.compras
  SET estado = 'ANULADA',
      observaciones = COALESCE(observaciones || ' | ', '') || 'Anulación: ' || p_motivo,
      idempotency_key = COALESCE(p_idempotency_key, idempotency_key)
  WHERE id = p_compra_id;

  -- 10. Revertir stock e ingresar movimientos de inventario con tipo ANULACION_COMPRA
  FOR v_detail IN
    SELECT insumo_id, cantidad
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    UPDATE public.insumos
    SET stock_actual = stock_actual - v_detail.cantidad,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    INSERT INTO public.movimientos_inventario (insumo_id, tipo, cantidad, motivo, compra_id, usuario_id)
    VALUES (v_detail.insumo_id, 'ANULACION_COMPRA', -v_detail.cantidad, 'Reversión por anulación de compra: ' || p_motivo, p_compra_id, auth.uid());
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'recovered', false,
    'message', 'Compra anulada, stock revertido y movimiento financiero compensado correctamente'
  );
END;
$$;


--
-- Name: anular_gasto(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio BOOLEAN;
    v_gasto record;
    v_ya_compensado BOOLEAN;
    v_user_id UUID;
    v_sesion_id UUID;
    v_mov_id UUID;
BEGIN
    -- 1. Guard: Check authorization
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    -- 2. Get and validate expense
    SELECT * INTO v_gasto FROM public.gastos WHERE id = p_gasto_id;
    IF v_gasto.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Gasto no encontrado');
    END IF;

    IF v_gasto.estado = 'ANULADO' THEN
        RETURN json_build_object('success', false, 'message', 'El gasto ya se encuentra anulado');
    END IF;

    -- 3. Idempotency checks
    SELECT EXISTS (
        SELECT 1 FROM public.movimientos_caja
        WHERE gasto_id = p_gasto_id AND tipo = 'INGRESO'
    ) INTO v_ya_compensado;

    IF v_ya_compensado THEN
        RETURN json_build_object('success', false, 'message', 'El movimiento financiero compensatorio ya existe para este gasto');
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No se pudo determinar el usuario actual.');
    END IF;

    -- Find active box session
    SELECT id INTO v_sesion_id 
    FROM public.sesiones_caja 
    WHERE estado = 'ABIERTA' 
    ORDER BY fecha_apertura DESC LIMIT 1;

    -- 4. Create compensating INGRESO movement
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, gasto_id, fecha
    ) VALUES (
        'INGRESO',
        v_gasto.monto,
        v_gasto.metodo_pago,
        'Reversión por anulación de gasto: ' || COALESCE(p_motivo, 'Sin motivo especificado'),
        v_user_id,
        v_sesion_id,
        p_gasto_id,
        now()
    ) RETURNING id INTO v_mov_id;

    -- 5. Update expense state
    UPDATE public.gastos
    SET estado = 'ANULADO',
        descripcion = COALESCE(descripcion || ' | ', '') || 'ANULACIÓN: ' || COALESCE(p_motivo, 'Sin motivo especificado')
    WHERE id = p_gasto_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Gasto anulado y egreso revertido correctamente',
        'movimiento_caja_id', v_mov_id
    );
END;
$$;


--
-- Name: anular_liquidacion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text DEFAULT 'Anulación por administrador'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio BOOLEAN;
    v_liq RECORD;
    v_mov_compensatorio_id UUID;
    v_user_id UUID;
    v_sesion_id UUID;
BEGIN
    -- 1. Verificar socio
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    -- 2. Buscar liquidación
    SELECT * INTO v_liq FROM public.liquidaciones WHERE id = p_liquidacion_id;
    IF v_liq.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Liquidación no encontrada.');
    END IF;

    -- 3. Idempotencia: si ya está anulada, retornar éxito sin hacer nada
    IF v_liq.estado = 'ANULADO' THEN
        RETURN json_build_object('success', true, 'message', 'La liquidación ya se encuentra anulada. Sin cambios.');
    END IF;

    -- 4. Resolver usuario y sesión
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.perfiles_trabajadores WHERE es_socio = true LIMIT 1;
    END IF;

    -- 5. Si estaba PAGADO, crear INGRESO compensatorio
    IF v_liq.estado = 'PAGADO' THEN
        v_sesion_id := NULL;
        SELECT id INTO v_sesion_id
        FROM public.sesiones_caja
        WHERE estado = 'ABIERTA'
        ORDER BY fecha_apertura DESC LIMIT 1;

        INSERT INTO public.movimientos_caja (
            tipo,
            monto,
            metodo_pago,
            descripcion,
            trabajador_id,
            sesion_id,
            liquidacion_id
        ) VALUES (
            'INGRESO',
            v_liq.monto_calculado,
            v_liq.cuenta_pago,
            'Reversión por anulación de liquidación: ' || COALESCE(p_motivo, 'Sin motivo'),
            v_user_id,
            v_sesion_id,
            p_liquidacion_id
        ) RETURNING id INTO v_mov_compensatorio_id;
    END IF;

    -- 6. Marcar como ANULADO (preservar movimiento_caja_id original)
    UPDATE public.liquidaciones
    SET estado = 'ANULADO',
        observaciones = COALESCE(observaciones, '') || ' | ANULADO: ' || COALESCE(p_motivo, 'Sin motivo'),
        updated_at = now()
    WHERE id = p_liquidacion_id;

    -- 7. Respuesta
    IF v_liq.estado = 'PAGADO' THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Liquidación anulada. Se ha registrado un INGRESO compensatorio en caja.',
            'movimiento_compensatorio_id', v_mov_compensatorio_id
        );
    ELSE
        RETURN json_build_object(
            'success', true,
            'message', 'Liquidación PENDIENTE anulada. No se requirió movimiento financiero.'
        );
    END IF;
END;
$$;


--
-- Name: anular_venta_directa(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_venta record;
  v_mov record;
  v_inv record;
  v_sesion_id uuid;
  v_stamp record;
  v_solicitud_id uuid;
BEGIN
  -- Must be socio/admin
  v_admin_id := auth.uid();
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: solo socios/administradores pueden anular directamente');
  END IF;

  -- Validate motivo
  IF trim(COALESCE(p_motivo, '')) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El motivo es obligatorio');
  END IF;

  -- Fetch and lock venta
  SELECT * INTO v_venta
  FROM public.ventas
  WHERE id = p_venta_id
  FOR UPDATE;

  IF v_venta IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Venta no encontrada');
  END IF;

  -- Idempotent: already annulled
  IF v_venta.estado = 'ANULADA' THEN
    RETURN json_build_object('success', true, 'message', 'La venta ya fue anulada previamente');
  END IF;

  IF v_venta.estado != 'COMPLETADA' THEN
    RETURN json_build_object('success', false, 'message', 'Solo se pueden anular ventas COMPLETADAS. Estado actual: ' || v_venta.estado);
  END IF;

  -- Check no active solicitud exists (prevent conflict)
  IF EXISTS (
    SELECT 1 FROM public.solicitudes_anulacion_venta
    WHERE venta_id = p_venta_id AND estado NOT IN ('EJECUTADA', 'RECHAZADA')
  ) THEN
    -- Reject pending solicitudes since admin is anulling directly
    UPDATE public.solicitudes_anulacion_venta
    SET estado = 'EJECUTADA', ejecutada_fecha = now(), updated_at = now()
    WHERE venta_id = p_venta_id AND estado NOT IN ('EJECUTADA', 'RECHAZADA');
  END IF;

  -- Create audit trail as solicitud record
  INSERT INTO public.solicitudes_anulacion_venta
    (venta_id, solicitante_id, motivo, estado, aprobador_1_id, aprobador_1_fecha, ejecutada_fecha)
  VALUES
    (p_venta_id, v_admin_id, trim(p_motivo), 'EJECUTADA', v_admin_id, now(), now())
  RETURNING id INTO v_solicitud_id;

  -- Get active session for reversal movements
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  -- ============================================================
  -- 1. REVERSE FINANCIAL MOVEMENTS
  -- ============================================================
  FOR v_mov IN
    SELECT id, tipo, monto, metodo_pago, sesion_id
    FROM public.movimientos_caja
    WHERE venta_id = p_venta_id
      AND tipo = 'INGRESO'
      AND descripcion NOT LIKE '%Reversi%n%'
  LOOP
    INSERT INTO public.movimientos_caja
      (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
    VALUES
      (p_venta_id, 'EGRESO', v_mov.monto, v_mov.metodo_pago, v_admin_id,
       'Reversión financiera por anulación directa de venta (admin)',
       COALESCE(v_sesion_id, v_mov.sesion_id));
  END LOOP;

  -- ============================================================
  -- 2. REVERSE INVENTORY
  -- ============================================================
  FOR v_inv IN
    SELECT insumo_id, cantidad, id as mov_id
    FROM public.movimientos_inventario
    WHERE venta_id = p_venta_id
      AND tipo = 'VENTA'
  LOOP
    UPDATE public.insumos
    SET stock_actual = stock_actual - v_inv.cantidad,
        updated_at = now()
    WHERE id = v_inv.insumo_id;

    INSERT INTO public.movimientos_inventario
      (insumo_id, tipo, cantidad, motivo, venta_id, usuario_id)
    VALUES
      (v_inv.insumo_id, 'ANULACION_VENTA', ABS(v_inv.cantidad),
       'Reversión de inventario por anulación directa',
       p_venta_id, v_admin_id);
  END LOOP;

  -- ============================================================
  -- 3. REVERSE LOYALTY STAMPS
  -- ============================================================
  FOR v_stamp IN
    SELECT client_id FROM public.stamp_logs
    WHERE venta_id = p_venta_id AND tipo = 'VENTA' AND estado = 'ACTIVO'
  LOOP
    UPDATE public.clientes
    SET stamps_count = GREATEST(0, stamps_count - 1)
    WHERE id = v_stamp.client_id;

    UPDATE public.stamp_logs
    SET estado = 'ANULADO', motivo = 'Reversión por anulación directa'
    WHERE venta_id = p_venta_id AND client_id = v_stamp.client_id AND tipo = 'VENTA';
  END LOOP;

  -- ============================================================
  -- 4. UPDATE VENTA STATE
  -- ============================================================
  UPDATE public.ventas
  SET estado = 'ANULADA'
  WHERE id = p_venta_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Venta anulada directamente por administrador. Se reversió caja, inventario y fidelización.',
    'venta_id', p_venta_id,
    'solicitud_id', v_solicitud_id
  );
END;
$$;


--
-- Name: aprobar_anulacion_venta(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_admin_id uuid;
  v_solicitud record;
  v_exec_result json;
BEGIN
  -- Must be socio/admin
  v_admin_id := auth.uid();
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser socio/administrador');
  END IF;

  -- Fetch solicitud with lock
  SELECT * INTO v_solicitud
  FROM public.solicitudes_anulacion_venta
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF v_solicitud IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Solicitud no encontrada');
  END IF;

  -- Cannot approve already executed/rejected
  IF v_solicitud.estado IN ('EJECUTADA', 'RECHAZADA') THEN
    RETURN json_build_object('success', false, 'message', 'Esta solicitud ya fue ' || v_solicitud.estado);
  END IF;

  -- Cannot self-approve (approver cannot be the requestor)
  IF v_admin_id = v_solicitud.solicitante_id THEN
    RETURN json_build_object('success', false, 'message', 'No puede aprobar su propia solicitud');
  END IF;

  -- PENDIENTE -> Single approval + auto-execute
  IF v_solicitud.estado = 'PENDIENTE' THEN
    UPDATE public.solicitudes_anulacion_venta
    SET estado = 'APROBACION_1',
        aprobador_1_id = v_admin_id,
        aprobador_1_fecha = now(),
        updated_at = now()
    WHERE id = p_solicitud_id;

    -- Auto-execute after single approval
    SELECT public.ejecutar_anulacion_venta(p_solicitud_id) INTO v_exec_result;

    RETURN json_build_object(
      'success', true,
      'message', 'Aprobación registrada y anulación ejecutada.',
      'estado', 'EJECUTADA',
      'ejecucion', v_exec_result
    );
  END IF;

  -- APROBACION_1 -> already has one approval, also execute (backward compat)
  IF v_solicitud.estado = 'APROBACION_1' THEN
    UPDATE public.solicitudes_anulacion_venta
    SET estado = 'APROBACION_2',
        aprobador_2_id = v_admin_id,
        aprobador_2_fecha = now(),
        updated_at = now()
    WHERE id = p_solicitud_id;

    SELECT public.ejecutar_anulacion_venta(p_solicitud_id) INTO v_exec_result;

    RETURN json_build_object(
      'success', true,
      'message', 'Segunda aprobación registrada y anulación ejecutada.',
      'estado', 'EJECUTADA',
      'ejecucion', v_exec_result
    );
  END IF;

  -- Already at APROBACION_2 (idempotent)
  IF v_solicitud.estado = 'APROBACION_2' THEN
    RETURN json_build_object('success', true, 'message', 'La solicitud ya tiene ambas aprobaciones', 'estado', 'APROBACION_2');
  END IF;

  RETURN json_build_object('success', false, 'message', 'Estado inesperado: ' || v_solicitud.estado);
END;
$$;


--
-- Name: calcular_saldo_global(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_saldo_global() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_is_worker boolean;
  v_efectivo numeric;
  v_nequi numeric;
  v_bancolombia numeric;
BEGIN
  SELECT public.fn_is_worker() INTO v_is_worker;
  IF NOT v_is_worker THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado');
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN metodo_pago = 'EFECTIVO' THEN CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN metodo_pago = 'NEQUI' THEN CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN metodo_pago = 'BANCOLOMBIA' THEN CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END ELSE 0 END), 0)
  INTO v_efectivo, v_nequi, v_bancolombia
  FROM public.movimientos_caja;

  RETURN json_build_object(
    'success', true,
    'efectivo', v_efectivo,
    'nequi', v_nequi,
    'bancolombia', v_bancolombia,
    'total', v_efectivo + v_nequi + v_bancolombia
  );
END;
$$;


--
-- Name: cerrar_caja(numeric, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric DEFAULT 0, p_contado_bancolombia numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_active_sesion_id uuid;
  v_is_worker boolean;
  v_monto_apertura numeric;
  v_apertura_nequi numeric;
  v_apertura_bancolombia numeric;

  -- Movimientos de sesion por metodo
  v_mov_efectivo numeric := 0;
  v_mov_nequi numeric := 0;
  v_mov_bancolombia numeric := 0;

  -- Esperados por metodo (apertura + movimientos)
  v_esp_efectivo numeric;
  v_esp_nequi numeric;
  v_esp_bancolombia numeric;

  -- Diferencias
  v_dif_efectivo numeric;
  v_dif_nequi numeric;
  v_dif_bancolombia numeric;
  v_dif_total numeric;

  -- Totales
  v_total_esperado numeric;
  v_total_contado numeric;
BEGIN
  SELECT public.fn_is_worker() INTO v_is_worker;
  IF NOT v_is_worker THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;

  SELECT id, monto_apertura, COALESCE(apertura_nequi, 0), COALESCE(apertura_bancolombia, 0)
  INTO v_active_sesion_id, v_monto_apertura, v_apertura_nequi, v_apertura_bancolombia
  FROM public.sesiones_caja
  WHERE trabajador_id = auth.uid() AND estado = 'ABIERTA'
  LIMIT 1;

  IF v_active_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No tienes una sesion de caja abierta');
  END IF;

  -- Calcular movimientos financieros reales de la sesion (sin contar apertura)
  SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
  INTO v_mov_efectivo
  FROM public.movimientos_caja
  WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'EFECTIVO';

  SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
  INTO v_mov_nequi
  FROM public.movimientos_caja
  WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'NEQUI';

  SELECT COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE -monto END), 0)
  INTO v_mov_bancolombia
  FROM public.movimientos_caja
  WHERE sesion_id = v_active_sesion_id AND metodo_pago = 'BANCOLOMBIA';

  -- Esperado = apertura declarada + movimientos financieros de sesion
  v_esp_efectivo := v_monto_apertura + v_mov_efectivo;
  v_esp_nequi := v_apertura_nequi + v_mov_nequi;
  v_esp_bancolombia := v_apertura_bancolombia + v_mov_bancolombia;

  -- Diferencias
  v_dif_efectivo := p_monto_cierre_contado - v_esp_efectivo;
  v_dif_nequi := p_contado_nequi - v_esp_nequi;
  v_dif_bancolombia := p_contado_bancolombia - v_esp_bancolombia;

  v_total_esperado := v_esp_efectivo + v_esp_nequi + v_esp_bancolombia;
  v_total_contado := p_monto_cierre_contado + p_contado_nequi + p_contado_bancolombia;
  v_dif_total := v_total_contado - v_total_esperado;

  UPDATE public.sesiones_caja
  SET fecha_cierre = now(),
      monto_cierre_esperado = v_total_esperado,
      monto_cierre_contado = v_total_contado,
      diferencia = v_dif_total,
      esperado_efectivo = v_esp_efectivo,
      contado_efectivo = p_monto_cierre_contado,
      diferencia_efectivo = v_dif_efectivo,
      esperado_nequi = v_esp_nequi,
      contado_nequi = p_contado_nequi,
      diferencia_nequi = v_dif_nequi,
      esperado_bancolombia = v_esp_bancolombia,
      contado_bancolombia = p_contado_bancolombia,
      diferencia_bancolombia = v_dif_bancolombia,
      cerrado_por = auth.uid(),
      observaciones = p_observaciones,
      estado = 'CERRADA'
  WHERE id = v_active_sesion_id;

  -- Modelo C: cierre es arqueo, NO crea movimiento financiero

  RETURN json_build_object(
    'success', true,
    'message', 'Caja cerrada y arqueada con exito',
    'sesion_id', v_active_sesion_id,
    'efectivo', json_build_object('esperado', v_esp_efectivo, 'contado', p_monto_cierre_contado, 'diferencia', v_dif_efectivo),
    'nequi', json_build_object('esperado', v_esp_nequi, 'contado', p_contado_nequi, 'diferencia', v_dif_nequi),
    'bancolombia', json_build_object('esperado', v_esp_bancolombia, 'contado', p_contado_bancolombia, 'diferencia', v_dif_bancolombia),
    'total', json_build_object('esperado', v_total_esperado, 'contado', v_total_contado, 'diferencia', v_dif_total)
  );
END;
$$;


--
-- Name: crear_gasto(uuid, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio BOOLEAN;
    v_cat_exists BOOLEAN;
    v_gasto_id UUID;
    v_mov_id UUID;
    v_user_id UUID;
    v_sesion_id UUID;
BEGIN
    -- 1. Guard: Check authorization
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    -- 2. Validate parameters
    IF p_monto <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero');
    END IF;

    IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
        RETURN json_build_object('success', false, 'message', 'Método de pago no permitido: debe ser EFECTIVO, NEQUI o BANCOLOMBIA');
    END IF;

    -- Validate category
    SELECT EXISTS (
        SELECT 1 FROM public.categorias_gastos
        WHERE id = p_categoria_id AND activo = true
    ) INTO v_cat_exists;
    
    IF NOT v_cat_exists THEN
        RETURN json_build_object('success', false, 'message', 'La categoría especificada no existe o no está activa');
    END IF;

    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'No se pudo determinar el usuario actual.');
    END IF;

    -- Find active box session
    SELECT id INTO v_sesion_id 
    FROM public.sesiones_caja 
    WHERE estado = 'ABIERTA' 
    ORDER BY fecha_apertura DESC LIMIT 1;

    -- Insert expense
    INSERT INTO public.gastos (
        categoria_id, descripcion, monto, metodo_pago, estado, created_by, fecha
    ) VALUES (
        p_categoria_id, p_descripcion, p_monto, p_metodo_pago, 'REGISTRADO', v_user_id, now()
    ) RETURNING id INTO v_gasto_id;

    -- Insert cash movement
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, gasto_id, fecha
    ) VALUES (
        'EGRESO', p_monto, p_metodo_pago, COALESCE(p_descripcion, 'Gasto operativo registrado'), v_user_id, v_sesion_id, v_gasto_id, now()
    ) RETURNING id INTO v_mov_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Gasto operativo y egreso en caja registrados con éxito',
        'gasto_id', v_gasto_id,
        'movimiento_caja_id', v_mov_id
    );
END;
$$;


--
-- Name: ejecutar_anulacion_venta(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_admin_id uuid;
  v_solicitud record;
  v_venta record;
  v_mov record;
  v_inv record;
  v_sesion_id uuid;
  v_stamp record;
BEGIN
  -- Must be socio
  v_admin_id := auth.uid();
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser socio/administrador');
  END IF;

  -- Fetch and lock solicitud
  SELECT * INTO v_solicitud
  FROM public.solicitudes_anulacion_venta
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF v_solicitud IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Solicitud no encontrada');
  END IF;

  -- Idempotent: already executed
  IF v_solicitud.estado = 'EJECUTADA' THEN
    RETURN json_build_object('success', true, 'message', 'La anulación ya fue ejecutada previamente');
  END IF;

  -- Must have at least one approval (APROBACION_1 or APROBACION_2)
  IF v_solicitud.estado NOT IN ('APROBACION_1', 'APROBACION_2') THEN
    RETURN json_build_object('success', false, 'message', 'La solicitud requiere al menos una aprobación antes de ejecutarse. Estado actual: ' || v_solicitud.estado);
  END IF;

  -- Fetch venta
  SELECT * INTO v_venta
  FROM public.ventas
  WHERE id = v_solicitud.venta_id
  FOR UPDATE;

  IF v_venta IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Venta no encontrada');
  END IF;

  IF v_venta.estado = 'ANULADA' THEN
    UPDATE public.solicitudes_anulacion_venta
    SET estado = 'EJECUTADA', ejecutada_fecha = now(), updated_at = now()
    WHERE id = p_solicitud_id;
    RETURN json_build_object('success', true, 'message', 'La venta ya estaba anulada');
  END IF;

  -- Get active session for the reversal movements
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  -- 1. REVERSE FINANCIAL MOVEMENTS
  FOR v_mov IN
    SELECT id, tipo, monto, metodo_pago, sesion_id
    FROM public.movimientos_caja
    WHERE venta_id = v_solicitud.venta_id
      AND tipo = 'INGRESO'
      AND descripcion NOT LIKE '%Reversi%n%'
  LOOP
    INSERT INTO public.movimientos_caja
      (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
    VALUES
      (v_solicitud.venta_id, 'EGRESO', v_mov.monto, v_mov.metodo_pago, v_admin_id,
       'Reversión financiera por anulación de venta (solicitud: ' || p_solicitud_id || ')',
       COALESCE(v_sesion_id, v_mov.sesion_id));
  END LOOP;

  -- 2. REVERSE INVENTORY
  FOR v_inv IN
    SELECT insumo_id, cantidad, id as mov_id
    FROM public.movimientos_inventario
    WHERE venta_id = v_solicitud.venta_id
      AND tipo = 'VENTA'
  LOOP
    UPDATE public.insumos
    SET stock_actual = stock_actual - v_inv.cantidad,
        updated_at = now()
    WHERE id = v_inv.insumo_id;

    INSERT INTO public.movimientos_inventario
      (insumo_id, tipo, cantidad, motivo, venta_id, usuario_id)
    VALUES
      (v_inv.insumo_id, 'ANULACION_VENTA', ABS(v_inv.cantidad),
       'Reversión de inventario por anulación de venta',
       v_solicitud.venta_id, v_admin_id);
  END LOOP;

  -- 3. REVERSE LOYALTY STAMPS
  FOR v_stamp IN
    SELECT client_id FROM public.stamp_logs
    WHERE venta_id = v_solicitud.venta_id AND tipo = 'VENTA' AND estado = 'ACTIVO'
  LOOP
    UPDATE public.clientes
    SET stamps_count = GREATEST(0, stamps_count - 1)
    WHERE id = v_stamp.client_id;

    UPDATE public.stamp_logs
    SET estado = 'ANULADO', motivo = 'Reversión por anulación de venta'
    WHERE venta_id = v_solicitud.venta_id AND client_id = v_stamp.client_id AND tipo = 'VENTA';
  END LOOP;

  -- 4. UPDATE VENTA STATE
  UPDATE public.ventas
  SET estado = 'ANULADA'
  WHERE id = v_solicitud.venta_id;

  -- 5. MARK SOLICITUD AS EXECUTED
  UPDATE public.solicitudes_anulacion_venta
  SET estado = 'EJECUTADA',
      ejecutada_fecha = now(),
      updated_at = now()
  WHERE id = p_solicitud_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Venta anulada con éxito. Se reversió caja, inventario y fidelización.',
    'venta_id', v_solicitud.venta_id
  );
END;
$$;


--
-- Name: fn_get_active_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_get_active_session(p_trabajador_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: fn_immutable_cost_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_immutable_cost_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Si el campo ya tenía un valor (no-NULL), bloquear sobreescritura
  IF OLD.costo_unitario_historico IS NOT NULL
     AND NEW.costo_unitario_historico IS DISTINCT FROM OLD.costo_unitario_historico THEN
    RAISE EXCEPTION
      'FC-004: costo_unitario_historico es inmutable. movimiento_id=%, valor_previo=%, valor_intentado=%',
      OLD.id, OLD.costo_unitario_historico, NEW.costo_unitario_historico;
  END IF;

  IF OLD.costo_total_historico IS NOT NULL
     AND NEW.costo_total_historico IS DISTINCT FROM OLD.costo_total_historico THEN
    RAISE EXCEPTION
      'FC-004: costo_total_historico es inmutable. movimiento_id=%, valor_previo=%, valor_intentado=%',
      OLD.id, OLD.costo_total_historico, NEW.costo_total_historico;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles_trabajadores
    WHERE id = auth.uid() AND rol = 'ADMINISTRADOR' AND estado = 'ACTIVO'
  );
END;
$$;


--
-- Name: fn_is_socio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_is_socio() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles_trabajadores
    WHERE id = auth.uid() AND rol = 'ADMINISTRADOR' AND es_socio = true AND estado = 'ACTIVO'
  );
END;
$$;


--
-- Name: fn_is_worker(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_is_worker() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles_trabajadores
    WHERE id = auth.uid() AND estado = 'ACTIVO'
  );
END;
$$;


--
-- Name: generar_liquidacion(uuid, text, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio BOOLEAN;
    v_trabajador_exists BOOLEAN;
    v_liq_id UUID;
BEGIN
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    IF p_monto <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.perfiles_trabajadores WHERE id = p_trabajador_id
    ) INTO v_trabajador_exists;

    IF NOT v_trabajador_exists THEN
        RETURN json_build_object('success', false, 'message', 'El trabajador especificado no existe');
    END IF;

    INSERT INTO public.liquidaciones (
        trabajador_id,
        modalidad,
        monto_calculado,
        observaciones,
        estado,
        fecha
    ) VALUES (
        p_trabajador_id,
        COALESCE(p_modalidad, 'POR_TURNO'),
        p_monto,
        p_observaciones,
        'PENDIENTE',
        now()
    ) RETURNING id INTO v_liq_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Liquidación generada con éxito en estado PENDIENTE',
        'liquidacion_id', v_liq_id
    );
END;
$$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin 0, O, 1, I
  result TEXT := '';
  i INTEGER;
  random_index INTEGER;
BEGIN
  -- Generar código de 8 caracteres aleatorios
  FOR i IN 1..8 LOOP
    random_index := floor(random() * length(chars) + 1)::int;
    result := result || substr(chars, random_index, 1);
  END LOOP;
  
  -- Verificar que sea único, si no, regenerar
  WHILE EXISTS (SELECT 1 FROM public.clientes WHERE referral_code = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      random_index := floor(random() * length(chars) + 1)::int;
      result := result || substr(chars, random_index, 1);
    END LOOP;
  END LOOP;
  
  NEW.referral_code := result;
  RETURN NEW;
END;
$$;


--
-- Name: get_client_by_referral_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_client_by_referral_code(ref_code text) RETURNS TABLE(client_id uuid, client_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT id, nombre
  FROM public.clientes
  WHERE UPPER(referral_code) = UPPER(ref_code)
  LIMIT 1;
END;
$$;


--
-- Name: increment_stamps(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_stamps(client_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
  is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol de administrador');
  END IF;

  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  UPDATE clientes 
  SET stamps_count = stamps_count + 1,
      last_stamp_at = now()
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  INSERT INTO public.stamp_logs (client_id, tipo, otorgado_por, notes)
  VALUES (client_id, 'MANUAL', auth.uid(), 'Sello escaneado por admin');

  RETURN json_build_object(
    'success', true,
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;


--
-- Name: pagar_liquidacion(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text DEFAULT 'EFECTIVO'::text, p_sesion_id uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio BOOLEAN;
    v_liq RECORD;
    v_mov_id UUID;
    v_user_id UUID;
    v_sesion_id UUID;
BEGIN
    -- 1. Verificar socio
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    -- 2. Buscar liquidación
    SELECT * INTO v_liq FROM public.liquidaciones WHERE id = p_liquidacion_id;
    IF v_liq.id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Liquidación no encontrada.');
    END IF;

    -- 3. Validar estado (solo PENDIENTE puede pagarse)
    IF v_liq.estado = 'PAGADO' THEN
        RETURN json_build_object('success', false, 'message', 'La liquidación ya se encuentra pagada.');
    END IF;

    IF v_liq.estado = 'ANULADO' THEN
        RETURN json_build_object('success', false, 'message', 'No se puede pagar una liquidación anulada.');
    END IF;

    -- 4. Resolver usuario
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.perfiles_trabajadores WHERE es_socio = true LIMIT 1;
    END IF;

    -- 5. Resolver sesión de caja
    v_sesion_id := p_sesion_id;
    IF v_sesion_id IS NULL THEN
        SELECT id INTO v_sesion_id
        FROM public.sesiones_caja
        WHERE estado = 'ABIERTA'
        ORDER BY fecha_apertura DESC LIMIT 1;
    END IF;

    -- 6. Insertar EGRESO con liquidacion_id
    INSERT INTO public.movimientos_caja (
        tipo,
        monto,
        metodo_pago,
        descripcion,
        trabajador_id,
        sesion_id,
        liquidacion_id
    ) VALUES (
        'EGRESO',
        v_liq.monto_calculado,
        p_cuenta_origen,
        'Pago de liquidación a trabajador (' || v_liq.modalidad || ')',
        v_user_id,
        v_sesion_id,
        p_liquidacion_id
    ) RETURNING id INTO v_mov_id;

    -- 7. Actualizar liquidación
    UPDATE public.liquidaciones
    SET estado = 'PAGADO',
        cuenta_pago = p_cuenta_origen,
        movimiento_caja_id = v_mov_id,
        updated_at = now()
    WHERE id = p_liquidacion_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Liquidación pagada exitosamente. Se ha registrado el egreso en caja.',
        'movimiento_caja_id', v_mov_id
    );
END;
$$;


--
-- Name: process_referral_bonus(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_referral_bonus(new_client_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  referrer_id UUID;
  referrer_name TEXT;
  referred_name TEXT;
  first_stamp_count INTEGER;
  bonus_awarded BOOLEAN := false;
BEGIN
  -- Obtener información del cliente referido
  SELECT referred_by, nombre
  INTO referrer_id, referred_name
  FROM public.clientes
  WHERE id = new_client_id;
  
  -- Si no fue referido por nadie, salir
  IF referrer_id IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'bonus_awarded', false,
      'message', 'Cliente no fue referido'
    );
  END IF;
  
  -- Validar que no sea auto-referencia
  IF referrer_id = new_client_id THEN
    RETURN json_build_object(
      'success', false,
      'bonus_awarded', false,
      'message', 'Auto-referencia no permitida'
    );
  END IF;
  
  -- Contar cuántos sellos tiene el referido en stamp_logs
  SELECT COUNT(*)
  INTO first_stamp_count
  FROM public.stamp_logs
  WHERE client_id = new_client_id;
  
  -- Solo otorgar bonus si es el PRIMER sello
  IF first_stamp_count = 1 THEN
    -- Otorgar +1 sello al referidor
    UPDATE public.clientes
    SET stamps_count = stamps_count + 1
    WHERE id = referrer_id
    RETURNING nombre INTO referrer_name;
    
    -- Registrar el bonus en stamp_logs
    INSERT INTO public.stamp_logs (client_id, notes)
    VALUES (
      referrer_id,
      json_build_object(
        'type', 'referral_bonus',
        'from_client_id', new_client_id,
        'from_client_name', referred_name,
        'bonus_reason', 'Primer sello del referido'
      )::text
    );
    
    bonus_awarded := true;
    
    RAISE NOTICE '🎁 Bonus de referido otorgado a % (ID: %)', referrer_name, referrer_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'bonus_awarded', bonus_awarded,
    'referrer_id', referrer_id,
    'referrer_name', referrer_name,
    'message', CASE 
      WHEN bonus_awarded THEN 'Bonus otorgado exitosamente'
      ELSE 'No es el primer sello, bonus no aplicable'
    END
  );
END;
$$;


--
-- Name: realizar_transferencia_interna(text, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_is_socio boolean;
    v_sesion_id uuid;
    v_trabajador_id uuid;
    v_desc text;
    v_egreso_id uuid;
    v_ingreso_id uuid;
BEGIN
    -- 1. Validar autenticación
    v_trabajador_id := auth.uid();
    IF v_trabajador_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: Usuario no autenticado');
    END IF;

    -- 2. Validar rol/permisos
    SELECT public.fn_is_socio() INTO v_is_socio;
    IF NOT v_is_socio THEN
        RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
    END IF;

    -- 3. Validar cuentas permitidas
    IF p_origen NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') OR p_destino NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
        RETURN json_build_object('success', false, 'message', 'Cuentas origen y destino deben ser EFECTIVO, NEQUI o BANCOLOMBIA');
    END IF;

    -- 4. Impedir origen = destino
    IF p_origen = p_destino THEN
        RETURN json_build_object('success', false, 'message', 'El método de origen y destino no pueden ser iguales.');
    END IF;

    -- 5. Validar monto > 0
    IF p_monto IS NULL OR p_monto <= 0 THEN
        RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a 0.');
    END IF;

    -- 6. Idempotencia: Verificar si ya existe
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.movimientos_caja WHERE idempotency_key = p_idempotency_key) THEN
            RETURN json_build_object('success', true, 'message', 'Transferencia ya fue procesada anteriormente.', 'idempotency_key', p_idempotency_key);
        END IF;
    END IF;

    -- Fetch active sesion_id
    SELECT id INTO v_sesion_id
    FROM public.sesiones_caja
    WHERE estado = 'ABIERTA'
    ORDER BY fecha_apertura DESC LIMIT 1;

    v_desc := 'Transferencia interna: ' || p_origen || ' → ' || p_destino;
    IF p_observaciones IS NOT NULL AND trim(p_observaciones) != '' THEN
        v_desc := v_desc || ' — ' || trim(p_observaciones);
    END IF;

    -- 9. Crear EGRESO
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion, idempotency_key
    ) VALUES (
        'EGRESO', p_monto, p_origen, v_desc, v_trabajador_id, v_sesion_id, 'TRANSFERENCIA_INTERNA', p_idempotency_key
    ) RETURNING id INTO v_egreso_id;

    -- 10. Crear INGRESO (Note: we don't set idempotency_key here to avoid UNIQUE constraint violation, one per transaction is enough)
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion
    ) VALUES (
        'INGRESO', p_monto, p_destino, v_desc, v_trabajador_id, v_sesion_id, 'TRANSFERENCIA_INTERNA'
    ) RETURNING id INTO v_ingreso_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Transferencia registrada con éxito',
        'egreso_id', v_egreso_id,
        'ingreso_id', v_ingreso_id
    );
END;
$$;


--
-- Name: realizar_transferencia_interna_test_rollback(text, text, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.realizar_transferencia_interna_test_rollback(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_sesion_id uuid;
    v_egreso_id uuid;
    v_ingreso_id uuid;
BEGIN
    -- 9. Crear EGRESO
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion, idempotency_key
    ) VALUES (
        'EGRESO', p_monto, p_origen, 'TEST ROLLBACK', NULL, NULL, 'TRANSFERENCIA_INTERNA', p_idempotency_key
    ) RETURNING id INTO v_egreso_id;

    -- Forced error (division by zero)
    p_monto := p_monto / 0;

    -- 10. Crear INGRESO
    INSERT INTO public.movimientos_caja (
        tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion
    ) VALUES (
        'INGRESO', p_monto, p_destino, 'TEST ROLLBACK', NULL, NULL, 'TRANSFERENCIA_INTERNA'
    ) RETURNING id INTO v_ingreso_id;

    RETURN json_build_object('success', true);
END;
$$;


--
-- Name: rechazar_anulacion_venta(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_admin_id uuid;
  v_solicitud record;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser socio/administrador');
  END IF;

  SELECT * INTO v_solicitud
  FROM public.solicitudes_anulacion_venta
  WHERE id = p_solicitud_id
  FOR UPDATE;

  IF v_solicitud IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Solicitud no encontrada');
  END IF;

  IF v_solicitud.estado IN ('EJECUTADA', 'RECHAZADA') THEN
    RETURN json_build_object('success', true, 'message', 'La solicitud ya fue ' || v_solicitud.estado);
  END IF;

  UPDATE public.solicitudes_anulacion_venta
  SET estado = 'RECHAZADA',
      observaciones = COALESCE(p_motivo_rechazo, 'Rechazada por administrador'),
      updated_at = now()
  WHERE id = p_solicitud_id;

  RETURN json_build_object('success', true, 'message', 'Solicitud rechazada');
END;
$$;


--
-- Name: recibir_compra(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_socio boolean;
  v_estado text;
  v_total numeric;
  v_detail record;
  v_mov_id uuid;
BEGIN
  -- 1. Guard: requiere rol Socio Administrador
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  -- 2. Validar método de pago (lista blanca explícita)
  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  -- 3. Obtener y validar la compra
  SELECT estado, total INTO v_estado, v_total
  FROM public.compras
  WHERE id = p_compra_id;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  -- 4. Idempotencia: solo permite BORRADOR (bloquea doble ejecución)
  IF v_estado != 'BORRADOR' THEN
    RETURN json_build_object('success', false, 'message', 'La compra ya ha sido procesada o anulada');
  END IF;

  -- 5. Calcular total real desde compra_detalles (no confiar en compras.total)
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  -- 6. Actualizar total en compras con el valor real calculado
  UPDATE public.compras
  SET total = v_total,
      metodo_pago = p_metodo_pago,
      estado = 'RECIBIDA'
  WHERE id = p_compra_id;

  -- 7. Registrar egreso financiero en movimientos_caja
  INSERT INTO public.movimientos_caja (
    tipo, monto, metodo_pago, descripcion, trabajador_id, compra_id
  ) VALUES (
    'EGRESO',
    v_total,
    p_metodo_pago,
    'Pago de compra de insumos',
    auth.uid(),
    p_compra_id
  ) RETURNING id INTO v_mov_id;

  -- 8. Actualizar inventario y registrar movimientos por cada insumo
  FOR v_detail IN
    SELECT insumo_id, cantidad, costo_unitario
    FROM public.compra_detalles
    WHERE compra_id = p_compra_id
  LOOP
    -- Aumentar stock y actualizar costo_unitario vigente
    UPDATE public.insumos
    SET stock_actual = stock_actual + v_detail.cantidad,
        costo_unitario = CASE WHEN v_detail.costo_unitario > 0 THEN v_detail.costo_unitario ELSE costo_unitario END,
        updated_at = now()
    WHERE id = v_detail.insumo_id;

    -- Registrar movimiento de inventario
    INSERT INTO public.movimientos_inventario (insumo_id, tipo, cantidad, motivo, compra_id, usuario_id)
    VALUES (v_detail.insumo_id, 'ENTRADA_COMPRA', v_detail.cantidad, 'Recepción de compra', p_compra_id, auth.uid());
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Compra recibida, inventario alimentado y egreso financiero registrado',
    'movimiento_caja_id', v_mov_id,
    'total', v_total,
    'metodo_pago', p_metodo_pago
  );
END;
$$;


--
-- Name: recibir_compra(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text DEFAULT 'EFECTIVO'::text, p_idempotency_key uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
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

  -- 2. Validar método de pago
  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Método de pago inválido. Use: EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  -- 3. Bloqueo de fila y verificación atómica de estado
  SELECT estado, total, idempotency_key INTO v_estado, v_total, v_existing_key
  FROM public.compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Compra no encontrada');
  END IF;

  -- 4. Idempotencia y recuperación segura
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

  -- 5. Sesión de caja abierta activa
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  -- 6. Calcular total real desde compra_detalles
  SELECT COALESCE(SUM(subtotal), 0) INTO v_total
  FROM public.compra_detalles
  WHERE compra_id = p_compra_id;

  -- 7. Transición atómica de estado e idempotency_key
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

  -- 9. Actualizar inventario y registrar movimientos de entrada por insumo con SNAPSHOT
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

    -- SNAPSHOT HISTÓRICO DE COMPRA EN MOVIMIENTO DE INVENTARIO
    INSERT INTO public.movimientos_inventario (
      insumo_id, tipo, cantidad, motivo, compra_id, usuario_id,
      costo_unitario_historico, costo_total_historico
    ) VALUES (
      v_detail.insumo_id,
      'ENTRADA_COMPRA',
      v_detail.cantidad,
      'Recepción de compra',
      p_compra_id,
      auth.uid(),
      v_costo_unitario_val,
      v_costo_total_val
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'recovered', false,
    'message', 'Compra recibida, inventario alimentado y egreso financiero registrado',
    'movimiento_caja_id', v_mov_id,
    'total', v_total,
    'metodo_pago', p_metodo_pago
  );
END;
$$;


--
-- Name: redeem_reward(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_reward(client_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_stamps int;
  new_stamps int;
  surplus int;
  is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol de administrador');
  END IF;

  SELECT stamps_count INTO current_stamps 
  FROM public.clientes 
  WHERE id = client_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  IF current_stamps < 10 THEN
     RETURN json_build_object('success', false, 'message', 'No tiene suficientes sellos (Mínimo 10)');
  END IF;

  surplus := current_stamps - 10;
  new_stamps := surplus;

  UPDATE public.clientes
  SET stamps_count = new_stamps
  WHERE id = client_id;

  INSERT INTO public.redemptions (client_id, stamps_exchanged) 
  VALUES (client_id, 10);

  RETURN json_build_object(
    'success', true, 
    'message', 'Premio canjeado con éxito',
    'new_count', new_stamps
  );
END;
$$;


--
-- Name: registrar_carga_masiva_inventario(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_carga_masiva_inventario(p_items jsonb, p_motivo text DEFAULT 'Carga Inicial de Inventario'::text, p_tipo text DEFAULT 'AJUSTE'::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_item jsonb;
  v_insumo_id uuid;
  v_nuevo_stock numeric;
  v_current_stock numeric;
  v_delta numeric;
  v_count integer := 0;
  v_user_id uuid;
BEGIN
  -- GUARD D2.3: No permitir motivo=compra o tipo=ENTRADA_COMPRA sin compra_id real
  IF p_motivo = 'compra' OR p_motivo = 'Recepción de compra' OR p_tipo = 'ENTRADA_COMPRA' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Operación denegada: Las entradas por compra deben realizarse a través del módulo de Compras.'
    );
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.perfiles_trabajadores WHERE es_socio = true LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.perfiles_trabajadores LIMIT 1;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_insumo_id := (v_item->>'insumo_id')::uuid;
    v_nuevo_stock := (v_item->>'nuevo_stock')::numeric;

    SELECT stock_actual INTO v_current_stock
    FROM public.insumos
    WHERE id = v_insumo_id;

    IF v_current_stock IS NOT NULL AND v_nuevo_stock IS NOT NULL THEN
      v_delta := v_nuevo_stock - v_current_stock;

      IF v_delta != 0 THEN
        -- 1. Actualizar stock actual en la tabla insumos
        UPDATE public.insumos
        SET stock_actual = v_nuevo_stock,
            updated_at = now()
        WHERE id = v_insumo_id;

        -- 2. Insertar trazabilidad en movimientos_inventario
        INSERT INTO public.movimientos_inventario (
          insumo_id,
          tipo,
          cantidad,
          motivo,
          usuario_id
        ) VALUES (
          v_insumo_id,
          p_tipo,
          v_delta,
          p_motivo,
          v_user_id
        );

        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Carga de inventario procesada con éxito',
    'items_procesados', v_count
  );
END;
$$;


--
-- Name: registrar_merma_trabajador(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_stock numeric;
  v_new_stock     numeric;
  v_insumo_activo boolean;
BEGIN
  -- 1. Verificar que el usuario es un trabajador activo (cualquier rol, incluyendo socio)
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: usuario no autorizado o inactivo');
  END IF;

  -- 2. Validar cantidad: debe ser estrictamente positiva
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'La cantidad debe ser mayor a cero');
  END IF;

  -- 2b. Validar motivo obligatorio (para prevenir registros de merma sin justificación)
  IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El motivo de la merma es obligatorio');
  END IF;

  -- 3. Leer y bloquear el insumo en la misma transacción (FOR UPDATE evita condiciones de carrera)
  SELECT stock_actual, activo
  INTO v_current_stock, v_insumo_activo
  FROM public.insumos
  WHERE id = p_insumo_id
  FOR UPDATE;

  -- 4. Verificar que el insumo existe
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Insumo no encontrado');
  END IF;

  -- 5. Verificar que el insumo está activo
  IF NOT v_insumo_activo THEN
    RETURN json_build_object('success', false, 'message', 'No se puede registrar merma en un insumo inactivo');
  END IF;

  -- 6. Rechazar si la merma supera el stock disponible (NO usar GREATEST, debe ser un error explícito)
  IF p_cantidad > v_current_stock THEN
    RETURN json_build_object(
      'success', false,
      'message', format('La cantidad de merma (%s) supera el stock disponible (%s)', p_cantidad, v_current_stock)
    );
  END IF;

  -- 7. Calcular nuevo stock
  v_new_stock := v_current_stock - p_cantidad;

  -- 8. Actualizar ÚNICAMENTE stock_actual (ningún otro campo)
  UPDATE public.insumos
  SET
    stock_actual = v_new_stock,
    updated_at   = now()
  WHERE id = p_insumo_id;

  -- 9. Registrar movimiento MERMA con cantidad negativa y trazabilidad completa
  INSERT INTO public.movimientos_inventario (
    insumo_id,
    tipo,
    cantidad,
    motivo,
    usuario_id
  ) VALUES (
    p_insumo_id,
    'MERMA',
    -p_cantidad,
    TRIM(p_motivo),
    auth.uid()
  );

  RETURN json_build_object(
    'success',       true,
    'nuevo_stock',   v_new_stock,
    'cantidad_merma', p_cantidad,
    'message',       'Merma registrada correctamente'
  );
END;
$$;


--
-- Name: registrar_movimiento_manual(text, numeric, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_socio boolean;
  v_sesion_id uuid;
  v_user_id uuid;
  v_mov_id uuid;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  IF p_tipo NOT IN ('INGRESO', 'EGRESO') THEN
    RETURN json_build_object('success', false, 'message', 'Tipo debe ser INGRESO o EGRESO');
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero');
  END IF;

  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Metodo de pago debe ser EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  IF p_tipo_operacion NOT IN ('INGRESO_MANUAL', 'RETIRO', 'EGRESO_MANUAL') THEN
    RETURN json_build_object('success', false, 'message', 'Tipo de operacion no permitido');
  END IF;

  v_user_id := auth.uid();

  SELECT id INTO v_sesion_id FROM public.sesiones_caja WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1;

  INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
  VALUES (p_tipo, p_monto, p_metodo_pago, COALESCE(p_descripcion, 'Movimiento manual registrado'), v_user_id, v_sesion_id, p_tipo_operacion)
  RETURNING id INTO v_mov_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Movimiento registrado exitosamente',
    'movimiento_id', v_mov_id
  );
END;
$$;


--
-- Name: registrar_saldo_inicial(numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_saldo_inicial(p_efectivo numeric DEFAULT 0, p_nequi numeric DEFAULT 0, p_bancolombia numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_socio boolean;
  v_sesion_id uuid;
  v_user_id uuid;
  v_count integer;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  v_user_id := auth.uid();
  
  -- Buscar la sesión DEL usuario actual
  SELECT public.fn_get_active_session(v_user_id) INTO v_sesion_id;
  
  IF v_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Debes abrir una caja primero antes de registrar el saldo inicial.');
  END IF;

  -- Validar si la SESIÓN ACTUAL ya tiene saldo inicial
  SELECT COUNT(*) INTO v_count FROM public.movimientos_caja WHERE sesion_id = v_sesion_id AND tipo_operacion = 'SALDO_INICIAL';
  IF v_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'El saldo inicial ya fue registrado anteriormente en esta sesión. Use ingresos manuales para ajustes posteriores.');
  END IF;

  IF COALESCE(p_efectivo, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_efectivo, 'EFECTIVO', 'Saldo inicial del negocio - Efectivo', v_user_id, v_sesion_id, 'SALDO_INICIAL');
  END IF;

  IF COALESCE(p_nequi, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_nequi, 'NEQUI', 'Saldo inicial del negocio - Nequi', v_user_id, v_sesion_id, 'SALDO_INICIAL');
  END IF;

  IF COALESCE(p_bancolombia, 0) > 0 THEN
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_bancolombia, 'BANCOLOMBIA', 'Saldo inicial del negocio - Bancolombia', v_user_id, v_sesion_id, 'SALDO_INICIAL');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Saldo inicial registrado exitosamente',
    'efectivo', COALESCE(p_efectivo, 0),
    'nequi', COALESCE(p_nequi, 0),
    'bancolombia', COALESCE(p_bancolombia, 0)
  );
END;
$$;


--
-- Name: registrar_saldo_inicial(uuid, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric DEFAULT 0, p_nequi numeric DEFAULT 0, p_bancolombia numeric DEFAULT 0) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric DEFAULT 0, p_monto_nequi numeric DEFAULT 0, p_monto_bancolombia numeric DEFAULT 0, p_clientes_extra uuid[] DEFAULT NULL::uuid[], p_idempotency_key uuid DEFAULT NULL::uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_venta_id uuid;
  v_worker_id uuid;
  v_client_exists boolean;
  v_earned_stamps integer := 0;
  v_sesion_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_quantity numeric;
  v_prod_nombre text;
  v_prod_requiere_inv boolean;
  v_insumo record;
  v_stock_required numeric;
  v_costo_unitario numeric;
  v_costo_total numeric;
  v_all_clients uuid[];
  v_cid uuid;
  v_existing_venta record;
  v_payload_fingerprint text;
  v_insumo_ids uuid[];
  v_insumo_id uuid;
  v_locked_insumo record;
BEGIN
  -- 1. AUTH
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    SELECT id INTO v_worker_id FROM public.perfiles_trabajadores WHERE estado = 'ACTIVO' LIMIT 1;
  END IF;
  IF v_worker_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;

  -- 2. FINGERPRINT SERVER-SIDE
  SELECT md5(
    p_total::text ||
    COALESCE(p_metodo_pago, '') ||
    COALESCE((
      SELECT string_agg(elem::text, ',' ORDER BY (elem->>'id'))
      FROM jsonb_array_elements(COALESCE(p_detalles->'items', '[]'::jsonb)) AS elem
    ), '')
  ) INTO v_payload_fingerprint;

  -- 3. IDEMPOTENCIA
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, payload_fingerprint
    INTO v_existing_venta
    FROM public.ventas
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_venta.id IS NOT NULL THEN
      -- Caso A: mismo payload -> recuperar
      IF v_existing_venta.payload_fingerprint = v_payload_fingerprint THEN
        SELECT COALESCE(count(*), 0) INTO v_earned_stamps
        FROM public.stamp_logs
        WHERE venta_id = v_existing_venta.id AND tipo = 'VENTA' AND estado = 'ACTIVO';
        RETURN json_build_object(
          'success', true,
          'message', 'Venta recuperada (ya registrada)',
          'venta_id', v_existing_venta.id,
          'earned_stamps', v_earned_stamps,
          'recovered', true
        );
      END IF;
      -- Caso B: payload diferente -> RECHAZAR
      RETURN json_build_object(
        'success', false,
        'message', 'Conflicto de idempotencia: la clave ya existe con un payload diferente. No se puede procesar.',
        'recovered', false
      );
    END IF;
  END IF;

  -- 4. SESION DE CAJA
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = v_worker_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;
  IF v_sesion_id IS NULL THEN
    SELECT id INTO v_sesion_id
    FROM public.sesiones_caja
    WHERE estado = 'ABIERTA'
    ORDER BY fecha_apertura DESC LIMIT 1;
  END IF;
  IF v_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: debes abrir caja antes de registrar una venta');
  END IF;

  -- 5. PRE-VALIDACION: Receta completa, inactivos y stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    v_producto_id := (v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 1);
    SELECT nombre, COALESCE(requiere_inventario, true)
    INTO v_prod_nombre, v_prod_requiere_inv
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_nombre IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Producto no encontrado en el catalogo.');
    END IF;
    IF v_prod_requiere_inv THEN
      IF NOT EXISTS (SELECT 1 FROM public.producto_insumos WHERE producto_id = v_producto_id) THEN
        RETURN json_build_object(
          'success', false,
          'message', 'Venta denegada: El producto "' || v_prod_nombre || '" requiere inventario pero no tiene receta configurada.'
        );
      END IF;
      -- FC1-NEW-002: Verificar TODOS los ingredientes (activos e inactivos)
      FOR v_insumo IN
        SELECT pi.insumo_id, pi.cantidad_por_unidad, i.nombre, i.activo, i.stock_actual
        FROM public.producto_insumos pi
        JOIN public.insumos i ON i.id = pi.insumo_id
        WHERE pi.producto_id = v_producto_id
      LOOP
        IF NOT v_insumo.activo THEN
          RETURN json_build_object(
            'success', false,
            'message', 'Venta denegada: El ingrediente "' || v_insumo.nombre || '" del producto "' || v_prod_nombre || '" esta inactivo. Active el ingrediente o actualice la receta.',
            'insumo_inactivo', v_insumo.nombre
          );
        END IF;
        v_stock_required := v_insumo.cantidad_por_unidad * v_quantity;
        IF v_insumo.stock_actual < v_stock_required THEN
          RETURN json_build_object(
            'success', false,
            'message', 'Stock insuficiente. Insumo: ' || v_insumo.nombre ||
                       ' (disponible: ' || v_insumo.stock_actual || ', requerido: ' || v_stock_required || ')'
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- 6. REGISTRAR VENTA (con fingerprint)
  BEGIN
    INSERT INTO public.ventas
      (cliente_id, trabajador_id, total, metodo_pago, detalles, sesion_id, idempotency_key, payload_fingerprint)
    VALUES
      (p_cliente_id, v_worker_id, p_total, p_metodo_pago, p_detalles, v_sesion_id, p_idempotency_key, v_payload_fingerprint)
    RETURNING id INTO v_venta_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF p_idempotency_key IS NOT NULL THEN
        SELECT id, payload_fingerprint INTO v_existing_venta
        FROM public.ventas WHERE idempotency_key = p_idempotency_key;
        IF v_existing_venta.id IS NOT NULL THEN
          IF v_existing_venta.payload_fingerprint = v_payload_fingerprint THEN
            SELECT COALESCE(count(*), 0) INTO v_earned_stamps
            FROM public.stamp_logs
            WHERE venta_id = v_existing_venta.id AND tipo = 'VENTA' AND estado = 'ACTIVO';
            RETURN json_build_object('success', true, 'message', 'Venta recuperada (ya registrada)',
              'venta_id', v_existing_venta.id, 'earned_stamps', v_earned_stamps, 'recovered', true);
          ELSE
            RETURN json_build_object('success', false,
              'message', 'Conflicto de idempotencia: payload diferente.', 'recovered', false);
          END IF;
        END IF;
      END IF;
      RAISE;
  END;

  -- 7. MOVIMIENTOS DE CAJA
  IF p_metodo_pago = 'MIXTO' THEN
    IF p_monto_efectivo > 0 THEN
      INSERT INTO public.movimientos_caja (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
      VALUES (v_venta_id, 'INGRESO', p_monto_efectivo, 'EFECTIVO', v_worker_id, 'Pago parcial de venta mixta', v_sesion_id);
    END IF;
    IF p_monto_nequi > 0 THEN
      INSERT INTO public.movimientos_caja (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
      VALUES (v_venta_id, 'INGRESO', p_monto_nequi, 'NEQUI', v_worker_id, 'Pago parcial de venta mixta', v_sesion_id);
    END IF;
    IF p_monto_bancolombia > 0 THEN
      INSERT INTO public.movimientos_caja (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
      VALUES (v_venta_id, 'INGRESO', p_monto_bancolombia, 'BANCOLOMBIA', v_worker_id, 'Pago parcial de venta mixta', v_sesion_id);
    END IF;
  ELSE
    INSERT INTO public.movimientos_caja (venta_id, tipo, monto, metodo_pago, trabajador_id, descripcion, sesion_id)
    VALUES (v_venta_id, 'INGRESO', p_total, p_metodo_pago, v_worker_id, 'Pago de venta', v_sesion_id);
  END IF;

  -- 8. DESCUENTO ATOMICO CON SNAPSHOT Y FOR UPDATE ORDENADO
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    v_producto_id := (v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 1);
    SELECT COALESCE(requiere_inventario, true) INTO v_prod_requiere_inv
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_requiere_inv THEN
      -- Obtener insumo_ids en orden deterministico sin filtro activo (ya pre-validado)
      SELECT array_agg(pi.insumo_id ORDER BY pi.insumo_id)
      INTO v_insumo_ids
      FROM public.producto_insumos pi
      WHERE pi.producto_id = v_producto_id;

      FOREACH v_insumo_id IN ARRAY COALESCE(v_insumo_ids, ARRAY[]::uuid[])
      LOOP
        -- FOR UPDATE en orden deterministico (anti-deadlock)
        SELECT i.stock_actual, i.nombre, pi.cantidad_por_unidad,
               COALESCE(i.costo_unitario, 0) AS costo_unitario
        INTO v_locked_insumo
        FROM public.insumos i
        JOIN public.producto_insumos pi ON pi.insumo_id = i.id
        WHERE i.id = v_insumo_id AND pi.producto_id = v_producto_id
        FOR UPDATE OF i;

        v_stock_required := v_locked_insumo.cantidad_por_unidad * v_quantity;
        v_costo_unitario := v_locked_insumo.costo_unitario;
        v_costo_total := ROUND(v_costo_unitario * v_stock_required, 2);

        UPDATE public.insumos
        SET stock_actual = stock_actual - v_stock_required, updated_at = now()
        WHERE id = v_insumo_id;

        -- INSERT con snapshot FC-004
        INSERT INTO public.movimientos_inventario
          (insumo_id, tipo, cantidad, motivo, venta_id, usuario_id,
           costo_unitario_historico, costo_total_historico)
        VALUES
          (v_insumo_id, 'VENTA', -v_stock_required, 'Descuento por venta', v_venta_id, v_worker_id,
           v_costo_unitario, v_costo_total);
      END LOOP;
    END IF;
  END LOOP;

  -- 9. FIDELIZACION
  v_all_clients := ARRAY[]::uuid[];
  IF p_cliente_id IS NOT NULL THEN v_all_clients := v_all_clients || p_cliente_id; END IF;
  IF p_clientes_extra IS NOT NULL AND array_length(p_clientes_extra, 1) > 0 THEN
    v_all_clients := v_all_clients || p_clientes_extra;
  END IF;
  SELECT array_agg(DISTINCT x) INTO v_all_clients FROM unnest(v_all_clients) x;
  IF v_all_clients IS NOT NULL THEN
    FOREACH v_cid IN ARRAY v_all_clients
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.clientes WHERE id = v_cid) INTO v_client_exists;
      IF v_client_exists THEN
        IF NOT EXISTS (SELECT 1 FROM public.stamp_logs
          WHERE venta_id = v_venta_id AND client_id = v_cid AND tipo = 'VENTA' AND estado = 'ACTIVO') THEN
          UPDATE public.clientes SET stamps_count = stamps_count + 1, last_stamp_at = now() WHERE id = v_cid;
          INSERT INTO public.stamp_logs (client_id, tipo, otorgado_por, notes, venta_id)
          VALUES (v_cid, 'VENTA', v_worker_id, 'Sello por compra realizada', v_venta_id);
          v_earned_stamps := v_earned_stamps + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Venta registrada con exito',
    'venta_id', v_venta_id,
    'earned_stamps', v_earned_stamps,
    'recovered', false
  );
END;
$$;


--
-- Name: resolver_diferencia_caja(uuid, text, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_is_socio boolean;
  v_sesion record;
  v_user_id uuid;
  v_mov_id uuid;
  v_tipo_op text;
  v_ya_resuelto boolean;
BEGIN
  SELECT public.fn_is_socio() INTO v_is_socio;
  IF NOT v_is_socio THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;

  SELECT * INTO v_sesion FROM public.sesiones_caja WHERE id = p_sesion_id;
  IF v_sesion.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Sesion no encontrada');
  END IF;

  IF v_sesion.estado != 'CERRADA' THEN
    RETURN json_build_object('success', false, 'message', 'Solo se pueden resolver diferencias de sesiones cerradas');
  END IF;

  IF p_tipo NOT IN ('FALTANTE', 'SOBRANTE') THEN
    RETURN json_build_object('success', false, 'message', 'Tipo debe ser FALTANTE o SOBRANTE');
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a cero');
  END IF;

  IF p_metodo_pago NOT IN ('EFECTIVO', 'NEQUI', 'BANCOLOMBIA') THEN
    RETURN json_build_object('success', false, 'message', 'Metodo de pago debe ser EFECTIVO, NEQUI o BANCOLOMBIA');
  END IF;

  -- Anti-duplicacion: verificar que no exista ajuste previo para esta sesion + metodo
  SELECT EXISTS (
    SELECT 1 FROM public.movimientos_caja
    WHERE sesion_id = p_sesion_id
    AND metodo_pago = p_metodo_pago
    AND tipo_operacion IN ('AJUSTE_FALTANTE', 'AJUSTE_SOBRANTE')
  ) INTO v_ya_resuelto;

  IF v_ya_resuelto THEN
    RETURN json_build_object('success', false, 'message', 'Esta diferencia ya fue resuelta anteriormente para este metodo de pago');
  END IF;

  v_user_id := auth.uid();

  IF p_tipo = 'FALTANTE' THEN
    v_tipo_op := 'AJUSTE_FALTANTE';
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('EGRESO', p_monto, p_metodo_pago, 'Ajuste por faltante autorizado: ' || COALESCE(p_motivo, 'Sin motivo'), v_user_id, p_sesion_id, v_tipo_op)
    RETURNING id INTO v_mov_id;
  ELSE
    v_tipo_op := 'AJUSTE_SOBRANTE';
    INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
    VALUES ('INGRESO', p_monto, p_metodo_pago, 'Ajuste por sobrante autorizado: ' || COALESCE(p_motivo, 'Sin motivo'), v_user_id, p_sesion_id, v_tipo_op)
    RETURNING id INTO v_mov_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Diferencia resuelta y registrada exitosamente',
    'movimiento_id', v_mov_id,
    'tipo_ajuste', v_tipo_op
  );
END;
$$;


--
-- Name: solicitar_anulacion_venta(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_worker_id uuid;
  v_venta_estado text;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Auth check
  v_worker_id := auth.uid();
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;

  -- Validate venta exists and is COMPLETADA
  SELECT estado INTO v_venta_estado
  FROM public.ventas WHERE id = p_venta_id;

  IF v_venta_estado IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Venta no encontrada');
  END IF;

  IF v_venta_estado = 'ANULADA' THEN
    RETURN json_build_object('success', false, 'message', 'Esta venta ya fue anulada');
  END IF;

  IF v_venta_estado != 'COMPLETADA' THEN
    RETURN json_build_object('success', false, 'message', 'Solo se pueden anular ventas COMPLETADAS. Estado actual: ' || v_venta_estado);
  END IF;

  -- Check for existing active request
  SELECT id INTO v_existing_id
  FROM public.solicitudes_anulacion_venta
  WHERE venta_id = p_venta_id AND estado NOT IN ('EJECUTADA', 'RECHAZADA')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Ya existe una solicitud activa para esta venta', 'solicitud_id', v_existing_id);
  END IF;

  -- Validate motivo
  IF trim(COALESCE(p_motivo, '')) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El motivo es obligatorio');
  END IF;

  -- Create request
  INSERT INTO public.solicitudes_anulacion_venta (venta_id, solicitante_id, motivo)
  VALUES (p_venta_id, v_worker_id, trim(p_motivo))
  RETURNING id INTO v_new_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Solicitud de anulación creada. Requiere aprobación de 2 administradores.',
    'solicitud_id', v_new_id
  );
END;
$$;


--
-- Name: trigger_check_referral_bonus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_check_referral_bonus() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_stamps_count INTEGER;
    v_referred_by UUID;
    v_client_name TEXT;
    v_referrer_name TEXT;
    v_logs_count INTEGER;
BEGIN
    SELECT stamps_count, referred_by, nombre 
    INTO v_stamps_count, v_referred_by, v_client_name
    FROM public.clientes
    WHERE id = NEW.client_id;

    -- Si tiene referidor y no es auto-referencia
    IF v_referred_by IS NOT NULL AND v_referred_by != NEW.client_id THEN
        
        -- Verificar si es el PRIMER sello (logs = 1)
        SELECT COUNT(*) INTO v_logs_count 
        FROM public.stamp_logs 
        WHERE client_id = NEW.client_id;

        IF v_stamps_count = 1 AND v_logs_count = 1 THEN
            -- Premiar al Referidor
            UPDATE public.clientes
            SET stamps_count = stamps_count + 1
            WHERE id = v_referred_by
            RETURNING nombre INTO v_referrer_name;

            -- Registrar premio
            IF FOUND THEN
                INSERT INTO public.stamp_logs (client_id, notes, created_at)
                VALUES (v_referred_by, 'Bono por referido: ' || COALESCE(v_client_name, 'Usuario'), NOW());
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: trigger_referral_bonus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_referral_bonus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  bonus_result json;
BEGIN
  -- Ejecutar la función de bonus
  SELECT process_referral_bonus(NEW.client_id) INTO bonus_result;
  
  RAISE NOTICE 'Resultado del bonus: %', bonus_result;
  
  RETURN NEW;
END;
$$;


--
-- Name: validate_referral_code(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_referral_code(code text) RETURNS boolean
    LANGUAGE plpgsql
    AS $_$
BEGIN
  -- Validar formato: 8 caracteres alfanuméricos
  IF code IS NULL OR length(code) != 8 THEN
    RETURN false;
  END IF;
  
  -- Validar que solo contenga caracteres permitidos
  IF code !~ '^[A-Z2-9]+$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    target_client_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: perfiles_trabajadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.perfiles_trabajadores (
    id uuid NOT NULL,
    nombre text NOT NULL,
    email text NOT NULL,
    rol text DEFAULT 'TRABAJADOR'::text NOT NULL,
    es_socio boolean DEFAULT false NOT NULL,
    estado text DEFAULT 'ACTIVO'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    modalidad_pago text DEFAULT 'POR_TURNO'::text,
    tarifa_pago numeric DEFAULT 0,
    CONSTRAINT perfiles_trabajadores_estado_check CHECK ((estado = ANY (ARRAY['ACTIVO'::text, 'INACTIVO'::text]))),
    CONSTRAINT perfiles_trabajadores_modalidad_pago_check CHECK ((modalidad_pago = ANY (ARRAY['POR_HORA'::text, 'POR_VENTA'::text, 'POR_TURNO'::text]))),
    CONSTRAINT perfiles_trabajadores_rol_check CHECK ((rol = ANY (ARRAY['ADMINISTRADOR'::text, 'TRABAJADOR'::text])))
);


--
-- Name: admin_users; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_users AS
 SELECT id,
    email
   FROM public.perfiles_trabajadores
  WHERE ((rol = 'ADMINISTRADOR'::text) AND (estado = 'ACTIVO'::text));


--
-- Name: admin_users_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users_legacy (
    id uuid NOT NULL,
    email text
);


--
-- Name: categorias_gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias_gastos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text,
    celular text NOT NULL,
    email text,
    stamps_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    last_stamp_at timestamp with time zone,
    referral_code text,
    referred_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_no_self_referral CHECK (((referred_by IS NULL) OR (referred_by <> id))),
    CONSTRAINT clientes_stamps_count_non_negative CHECK ((stamps_count >= 0))
);


--
-- Name: compra_detalles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compra_detalles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compra_id uuid NOT NULL,
    insumo_id uuid NOT NULL,
    cantidad numeric NOT NULL,
    costo_unitario numeric NOT NULL,
    subtotal numeric NOT NULL,
    precio_total_pagado numeric,
    contenido_comprado numeric,
    unidad_compra text,
    CONSTRAINT compra_detalles_cantidad_check CHECK ((cantidad > (0)::numeric)),
    CONSTRAINT compra_detalles_costo_unitario_check CHECK ((costo_unitario >= (0)::numeric)),
    CONSTRAINT compra_detalles_subtotal_check CHECK ((subtotal >= (0)::numeric))
);


--
-- Name: compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proveedor_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    estado text DEFAULT 'BORRADOR'::text NOT NULL,
    observaciones text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    metodo_pago text,
    idempotency_key uuid,
    CONSTRAINT compras_estado_check CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'RECIBIDA'::text, 'ANULADA'::text]))),
    CONSTRAINT compras_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: costos_configuracion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.costos_configuracion (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    tipo_costo text NOT NULL,
    categoria text DEFAULT 'OTROS'::text NOT NULL,
    monto numeric DEFAULT 0 NOT NULL,
    periodicidad text DEFAULT 'MENSUAL'::text NOT NULL,
    fecha_inicio date DEFAULT CURRENT_DATE NOT NULL,
    fecha_fin date,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    creado_por uuid,
    CONSTRAINT costos_configuracion_monto_check CHECK ((monto >= (0)::numeric)),
    CONSTRAINT costos_configuracion_nombre_check CHECK ((length(TRIM(BOTH FROM nombre)) > 0)),
    CONSTRAINT costos_configuracion_periodicidad_check CHECK ((periodicidad = ANY (ARRAY['DIARIO'::text, 'SEMANAL'::text, 'QUINCENAL'::text, 'MENSUAL'::text, 'ANUAL'::text, 'PERMANENTE'::text]))),
    CONSTRAINT costos_configuracion_tipo_costo_check CHECK ((tipo_costo = ANY (ARRAY['FIJO'::text, 'VARIABLE'::text, 'MULTIPLICADOR'::text, 'IMPUESTO'::text])))
);


--
-- Name: gastos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    categoria_id uuid NOT NULL,
    descripcion text,
    monto numeric NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    metodo_pago text NOT NULL,
    estado text DEFAULT 'REGISTRADO'::text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT gastos_estado_check CHECK ((estado = ANY (ARRAY['REGISTRADO'::text, 'ANULADO'::text]))),
    CONSTRAINT gastos_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['EFECTIVO'::text, 'NEQUI'::text, 'BANCOLOMBIA'::text]))),
    CONSTRAINT gastos_monto_check CHECK ((monto > (0)::numeric))
);


--
-- Name: insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insumos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    unidad_medida text DEFAULT 'unidad'::text NOT NULL,
    stock_actual numeric DEFAULT 0 NOT NULL,
    stock_minimo numeric DEFAULT 0 NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    costo_unitario numeric DEFAULT 0,
    CONSTRAINT insumos_stock_actual_check CHECK ((stock_actual >= (0)::numeric)),
    CONSTRAINT insumos_stock_minimo_check CHECK ((stock_minimo >= (0)::numeric))
);


--
-- Name: liquidaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liquidaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trabajador_id uuid NOT NULL,
    fecha timestamp with time zone DEFAULT now(),
    modalidad text NOT NULL,
    monto_calculado numeric NOT NULL,
    observaciones text,
    estado text DEFAULT 'PENDIENTE'::text,
    cuenta_pago text,
    movimiento_caja_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT liquidaciones_cuenta_pago_check CHECK (((cuenta_pago IS NULL) OR (cuenta_pago = ANY (ARRAY['EFECTIVO'::text, 'NEQUI'::text, 'BANCOLOMBIA'::text])))),
    CONSTRAINT liquidaciones_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'PAGADO'::text, 'ANULADO'::text]))),
    CONSTRAINT liquidaciones_modalidad_check CHECK ((modalidad = ANY (ARRAY['POR_HORA'::text, 'POR_VENTA'::text, 'POR_TURNO'::text]))),
    CONSTRAINT liquidaciones_monto_calculado_check CHECK ((monto_calculado >= (0)::numeric))
);


--
-- Name: movimientos_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_caja (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venta_id uuid,
    tipo text,
    monto numeric NOT NULL,
    metodo_pago text,
    fecha timestamp with time zone DEFAULT now(),
    trabajador_id uuid,
    descripcion text,
    sesion_id uuid,
    compra_id uuid,
    gasto_id uuid,
    liquidacion_id uuid,
    tipo_operacion text,
    idempotency_key uuid,
    CONSTRAINT movimientos_caja_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['EFECTIVO'::text, 'NEQUI'::text, 'BANCOLOMBIA'::text]))),
    CONSTRAINT movimientos_caja_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT movimientos_caja_tipo_check CHECK ((tipo = ANY (ARRAY['INGRESO'::text, 'EGRESO'::text])))
);


--
-- Name: movimientos_inventario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_inventario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    insumo_id uuid NOT NULL,
    tipo text NOT NULL,
    cantidad numeric NOT NULL,
    motivo text,
    venta_id uuid,
    usuario_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    compra_id uuid,
    costo_unitario_historico numeric(14,4),
    costo_total_historico numeric(14,2),
    CONSTRAINT chk_movimientos_compra_trazabilidad CHECK ((NOT (((motivo = 'compra'::text) OR (motivo = 'Recepción de compra'::text) OR (tipo = 'ENTRADA_COMPRA'::text)) AND (compra_id IS NULL)))),
    CONSTRAINT movimientos_inventario_tipo_check CHECK ((tipo = ANY (ARRAY['ENTRADA'::text, 'VENTA'::text, 'AJUSTE'::text, 'MERMA'::text, 'ENTRADA_COMPRA'::text, 'ANULACION_VENTA'::text, 'ANULACION_COMPRA'::text])))
);


--
-- Name: COLUMN movimientos_inventario.costo_unitario_historico; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.movimientos_inventario.costo_unitario_historico IS 'FC-004: Costo unitario en el momento exacto del movimiento. NULL para registros históricos anteriores a D2.1. Inmutable tras inserción.';


--
-- Name: COLUMN movimientos_inventario.costo_total_historico; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.movimientos_inventario.costo_total_historico IS 'FC-004: Costo total (cantidad * costo_unitario_historico) en el momento del movimiento. NULL para registros históricos anteriores a D2.1. Inmutable tras inserción.';


--
-- Name: CONSTRAINT chk_movimientos_compra_trazabilidad ON movimientos_inventario; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT chk_movimientos_compra_trazabilidad ON public.movimientos_inventario IS 'Garantiza que toda entrada por motivo compra este vinculada a una compra_id real (FC1-NEW-003)';


--
-- Name: producto_insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.producto_insumos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    producto_id uuid NOT NULL,
    insumo_id uuid NOT NULL,
    cantidad_por_unidad numeric NOT NULL,
    CONSTRAINT producto_insumos_cantidad_por_unidad_check CHECK ((cantidad_por_unidad > (0)::numeric))
);


--
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    descripcion text,
    precio numeric NOT NULL,
    categoria text NOT NULL,
    imagen text,
    activo boolean DEFAULT true NOT NULL,
    orden integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requiere_inventario boolean DEFAULT true NOT NULL,
    CONSTRAINT productos_precio_check CHECK ((precio >= (0)::numeric))
);


--
-- Name: proveedores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proveedores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    telefono text,
    contacto text,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    stamps_exchanged integer NOT NULL,
    redeemed_at timestamp with time zone DEFAULT now()
);


--
-- Name: sesiones_caja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_caja (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trabajador_id uuid NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    fecha_cierre timestamp with time zone,
    monto_apertura numeric NOT NULL,
    monto_cierre_esperado numeric,
    monto_cierre_contado numeric,
    diferencia numeric,
    observaciones text,
    estado text DEFAULT 'ABIERTA'::text NOT NULL,
    esperado_efectivo numeric DEFAULT 0,
    contado_efectivo numeric,
    diferencia_efectivo numeric,
    esperado_nequi numeric DEFAULT 0,
    contado_nequi numeric,
    diferencia_nequi numeric,
    esperado_bancolombia numeric DEFAULT 0,
    contado_bancolombia numeric,
    diferencia_bancolombia numeric,
    cerrado_por uuid,
    apertura_nequi numeric DEFAULT 0,
    apertura_bancolombia numeric DEFAULT 0,
    CONSTRAINT sesiones_caja_estado_check CHECK ((estado = ANY (ARRAY['ABIERTA'::text, 'CERRADA'::text]))),
    CONSTRAINT sesiones_caja_monto_apertura_check CHECK ((monto_apertura >= (0)::numeric)),
    CONSTRAINT sesiones_caja_monto_cierre_contado_check CHECK ((monto_cierre_contado >= (0)::numeric)),
    CONSTRAINT sesiones_caja_monto_cierre_esperado_check CHECK ((monto_cierre_esperado >= (0)::numeric))
);


--
-- Name: solicitudes_anulacion_venta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_anulacion_venta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    venta_id uuid NOT NULL,
    solicitante_id uuid NOT NULL,
    motivo text NOT NULL,
    estado text DEFAULT 'PENDIENTE'::text NOT NULL,
    aprobador_1_id uuid,
    aprobador_1_fecha timestamp with time zone,
    aprobador_2_id uuid,
    aprobador_2_fecha timestamp with time zone,
    ejecutada_fecha timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    observaciones text,
    CONSTRAINT chk_aprobador_1_not_solicitante CHECK (((aprobador_1_id IS NULL) OR (aprobador_1_id <> solicitante_id))),
    CONSTRAINT chk_aprobador_2_not_aprobador_1 CHECK (((aprobador_2_id IS NULL) OR (aprobador_2_id <> aprobador_1_id))),
    CONSTRAINT chk_aprobador_2_not_solicitante CHECK (((aprobador_2_id IS NULL) OR (aprobador_2_id <> solicitante_id))),
    CONSTRAINT solicitudes_anulacion_venta_estado_check CHECK ((estado = ANY (ARRAY['PENDIENTE'::text, 'APROBACION_1'::text, 'APROBACION_2'::text, 'EJECUTADA'::text, 'RECHAZADA'::text]))),
    CONSTRAINT solicitudes_anulacion_venta_motivo_check CHECK ((length(TRIM(BOTH FROM motivo)) > 0))
);


--
-- Name: stamp_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stamp_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    notes text,
    tipo text DEFAULT 'MANUAL'::text NOT NULL,
    estado text DEFAULT 'ACTIVO'::text NOT NULL,
    otorgado_por uuid,
    motivo text,
    venta_id uuid,
    CONSTRAINT stamp_logs_estado_check CHECK ((estado = ANY (ARRAY['ACTIVO'::text, 'REVERTIDO'::text, 'ANULADO'::text]))),
    CONSTRAINT stamp_logs_tipo_check CHECK ((tipo = ANY (ARRAY['VENTA'::text, 'REFERIDO'::text, 'MANUAL'::text, 'PROMOCIONAL'::text, 'PAGO_DEUDA'::text, 'MIGRACION'::text])))
);


--
-- Name: ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid,
    trabajador_id uuid,
    fecha timestamp with time zone DEFAULT now(),
    estado text DEFAULT 'COMPLETADA'::text,
    total numeric NOT NULL,
    metodo_pago text DEFAULT 'EFECTIVO'::text,
    detalles jsonb,
    sesion_id uuid,
    idempotency_key uuid,
    payload_fingerprint text,
    CONSTRAINT ventas_estado_check CHECK ((estado = ANY (ARRAY['BORRADOR'::text, 'COMPLETADA'::text, 'ANULADA'::text]))),
    CONSTRAINT ventas_metodo_pago_check CHECK ((metodo_pago = ANY (ARRAY['EFECTIVO'::text, 'NEQUI'::text, 'BANCOLOMBIA'::text, 'MIXTO'::text]))),
    CONSTRAINT ventas_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: COLUMN ventas.payload_fingerprint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ventas.payload_fingerprint IS 'D2.2: MD5 del payload normalizado (total + items ordenados por id) calculado server-side para deteccion de payload mismatch en idempotencia.';


--
-- Name: admin_audit_log admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: admin_users_legacy admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users_legacy
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users_legacy admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users_legacy
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: categorias_gastos categorias_gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias_gastos
    ADD CONSTRAINT categorias_gastos_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_referral_code_key UNIQUE (referral_code);


--
-- Name: compra_detalles compra_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra_detalles
    ADD CONSTRAINT compra_detalles_pkey PRIMARY KEY (id);


--
-- Name: compras compras_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: compras compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_pkey PRIMARY KEY (id);


--
-- Name: costos_configuracion costos_configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.costos_configuracion
    ADD CONSTRAINT costos_configuracion_pkey PRIMARY KEY (id);


--
-- Name: gastos gastos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_pkey PRIMARY KEY (id);


--
-- Name: insumos insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insumos
    ADD CONSTRAINT insumos_pkey PRIMARY KEY (id);


--
-- Name: liquidaciones liquidaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_pkey PRIMARY KEY (id);


--
-- Name: movimientos_caja movimientos_caja_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: movimientos_caja movimientos_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_pkey PRIMARY KEY (id);


--
-- Name: movimientos_inventario movimientos_inventario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_pkey PRIMARY KEY (id);


--
-- Name: perfiles_trabajadores perfiles_trabajadores_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_trabajadores
    ADD CONSTRAINT perfiles_trabajadores_email_key UNIQUE (email);


--
-- Name: perfiles_trabajadores perfiles_trabajadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_trabajadores
    ADD CONSTRAINT perfiles_trabajadores_pkey PRIMARY KEY (id);


--
-- Name: producto_insumos producto_insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_insumos
    ADD CONSTRAINT producto_insumos_pkey PRIMARY KEY (id);


--
-- Name: producto_insumos producto_insumos_producto_id_insumo_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_insumos
    ADD CONSTRAINT producto_insumos_producto_id_insumo_id_key UNIQUE (producto_id, insumo_id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: sesiones_caja sesiones_caja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_anulacion_venta solicitudes_anulacion_venta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_anulacion_venta
    ADD CONSTRAINT solicitudes_anulacion_venta_pkey PRIMARY KEY (id);


--
-- Name: stamp_logs stamp_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_logs
    ADD CONSTRAINT stamp_logs_pkey PRIMARY KEY (id);


--
-- Name: ventas ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_pkey PRIMARY KEY (id);


--
-- Name: idx_ajuste_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ajuste_unico ON public.movimientos_caja USING btree (sesion_id, metodo_pago) WHERE (tipo_operacion = ANY (ARRAY['AJUSTE_FALTANTE'::text, 'AJUSTE_SOBRANTE'::text]));


--
-- Name: idx_clientes_celular; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_celular ON public.clientes USING btree (celular);


--
-- Name: idx_costos_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_costos_activo ON public.costos_configuracion USING btree (activo);


--
-- Name: idx_costos_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_costos_tipo ON public.costos_configuracion USING btree (tipo_costo);


--
-- Name: idx_mc_metodo_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mc_metodo_tipo ON public.movimientos_caja USING btree (metodo_pago, tipo);


--
-- Name: idx_movimientos_caja_compra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_caja_compra_id ON public.movimientos_caja USING btree (compra_id);


--
-- Name: idx_movimientos_caja_gasto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_caja_gasto_id ON public.movimientos_caja USING btree (gasto_id);


--
-- Name: idx_movimientos_caja_liquidacion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimientos_caja_liquidacion_id ON public.movimientos_caja USING btree (liquidacion_id);


--
-- Name: idx_movinv_insumo_costo_snap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movinv_insumo_costo_snap ON public.movimientos_inventario USING btree (insumo_id, created_at) WHERE (costo_unitario_historico IS NOT NULL);


--
-- Name: idx_redemptions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redemptions_client_id ON public.redemptions USING btree (client_id);


--
-- Name: idx_sav_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sav_estado ON public.solicitudes_anulacion_venta USING btree (estado);


--
-- Name: idx_sav_venta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sav_venta_id ON public.solicitudes_anulacion_venta USING btree (venta_id);


--
-- Name: idx_sesion_unica_abierta; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_sesion_unica_abierta ON public.sesiones_caja USING btree (trabajador_id) WHERE (estado = 'ABIERTA'::text);


--
-- Name: idx_stamp_logs_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stamp_logs_client_id ON public.stamp_logs USING btree (client_id);


--
-- Name: idx_stamp_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stamp_logs_created_at ON public.stamp_logs USING btree (created_at DESC);


--
-- Name: idx_ventas_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ventas_idempotency_key ON public.ventas USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: unique_active_categoria_nombre; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_active_categoria_nombre ON public.categorias_gastos USING btree (nombre) WHERE (activo = true);


--
-- Name: uq_stamp_logs_venta_client_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stamp_logs_venta_client_tipo ON public.stamp_logs USING btree (venta_id, client_id, tipo) WHERE ((venta_id IS NOT NULL) AND (estado = 'ACTIVO'::text));


--
-- Name: clientes set_referral_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_referral_code BEFORE INSERT ON public.clientes FOR EACH ROW WHEN ((new.referral_code IS NULL)) EXECUTE FUNCTION public.generate_referral_code();


--
-- Name: stamp_logs trg_check_referral_bonus; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_referral_bonus AFTER INSERT ON public.stamp_logs FOR EACH ROW EXECUTE FUNCTION public.trigger_check_referral_bonus();


--
-- Name: movimientos_inventario trg_immutable_cost_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_immutable_cost_snapshot BEFORE UPDATE ON public.movimientos_inventario FOR EACH ROW EXECUTE FUNCTION public.fn_immutable_cost_snapshot();


--
-- Name: admin_audit_log admin_audit_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id);


--
-- Name: admin_audit_log admin_audit_log_target_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_log
    ADD CONSTRAINT admin_audit_log_target_client_id_fkey FOREIGN KEY (target_client_id) REFERENCES public.clientes(id);


--
-- Name: admin_users_legacy admin_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users_legacy
    ADD CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: clientes clientes_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: compra_detalles compra_detalles_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra_detalles
    ADD CONSTRAINT compra_detalles_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE CASCADE;


--
-- Name: compra_detalles compra_detalles_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra_detalles
    ADD CONSTRAINT compra_detalles_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id);


--
-- Name: compras compras_proveedor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id);


--
-- Name: compras compras_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compras
    ADD CONSTRAINT compras_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: costos_configuracion costos_configuracion_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.costos_configuracion
    ADD CONSTRAINT costos_configuracion_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: gastos gastos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias_gastos(id);


--
-- Name: gastos gastos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos
    ADD CONSTRAINT gastos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: liquidaciones liquidaciones_movimiento_caja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_movimiento_caja_id_fkey FOREIGN KEY (movimiento_caja_id) REFERENCES public.movimientos_caja(id) ON DELETE SET NULL;


--
-- Name: liquidaciones liquidaciones_trabajador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liquidaciones
    ADD CONSTRAINT liquidaciones_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.perfiles_trabajadores(id) ON DELETE CASCADE;


--
-- Name: movimientos_caja movimientos_caja_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id);


--
-- Name: movimientos_caja movimientos_caja_gasto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_gasto_id_fkey FOREIGN KEY (gasto_id) REFERENCES public.gastos(id);


--
-- Name: movimientos_caja movimientos_caja_liquidacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_liquidacion_id_fkey FOREIGN KEY (liquidacion_id) REFERENCES public.liquidaciones(id);


--
-- Name: movimientos_caja movimientos_caja_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.sesiones_caja(id) ON DELETE SET NULL;


--
-- Name: movimientos_caja movimientos_caja_trabajador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: movimientos_caja movimientos_caja_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_caja
    ADD CONSTRAINT movimientos_caja_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_compra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id) ON DELETE SET NULL;


--
-- Name: movimientos_inventario movimientos_inventario_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id);


--
-- Name: movimientos_inventario movimientos_inventario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: movimientos_inventario movimientos_inventario_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_inventario
    ADD CONSTRAINT movimientos_inventario_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id) ON DELETE SET NULL;


--
-- Name: perfiles_trabajadores perfiles_trabajadores_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_trabajadores
    ADD CONSTRAINT perfiles_trabajadores_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: producto_insumos producto_insumos_insumo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_insumos
    ADD CONSTRAINT producto_insumos_insumo_id_fkey FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE CASCADE;


--
-- Name: producto_insumos producto_insumos_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.producto_insumos
    ADD CONSTRAINT producto_insumos_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;


--
-- Name: redemptions redemptions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: sesiones_caja sesiones_caja_cerrado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_cerrado_por_fkey FOREIGN KEY (cerrado_por) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: sesiones_caja sesiones_caja_trabajador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_caja
    ADD CONSTRAINT sesiones_caja_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: solicitudes_anulacion_venta solicitudes_anulacion_venta_aprobador_1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_anulacion_venta
    ADD CONSTRAINT solicitudes_anulacion_venta_aprobador_1_id_fkey FOREIGN KEY (aprobador_1_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: solicitudes_anulacion_venta solicitudes_anulacion_venta_aprobador_2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_anulacion_venta
    ADD CONSTRAINT solicitudes_anulacion_venta_aprobador_2_id_fkey FOREIGN KEY (aprobador_2_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: solicitudes_anulacion_venta solicitudes_anulacion_venta_solicitante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_anulacion_venta
    ADD CONSTRAINT solicitudes_anulacion_venta_solicitante_id_fkey FOREIGN KEY (solicitante_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: solicitudes_anulacion_venta solicitudes_anulacion_venta_venta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_anulacion_venta
    ADD CONSTRAINT solicitudes_anulacion_venta_venta_id_fkey FOREIGN KEY (venta_id) REFERENCES public.ventas(id);


--
-- Name: stamp_logs stamp_logs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_logs
    ADD CONSTRAINT stamp_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clientes(id) ON DELETE CASCADE;


--
-- Name: stamp_logs stamp_logs_otorgado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stamp_logs
    ADD CONSTRAINT stamp_logs_otorgado_por_fkey FOREIGN KEY (otorgado_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.sesiones_caja(id) ON DELETE SET NULL;


--
-- Name: ventas ventas_trabajador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ventas
    ADD CONSTRAINT ventas_trabajador_id_fkey FOREIGN KEY (trabajador_id) REFERENCES public.perfiles_trabajadores(id);


--
-- Name: admin_audit_log Admins can view audit log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit log" ON public.admin_audit_log FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: admin_users_legacy Allow individual read own admin status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow individual read own admin status" ON public.admin_users_legacy FOR SELECT USING ((auth.uid() = id));


--
-- Name: admin_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_users_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: categorias_gastos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categorias_gastos ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes clientes_insert_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_insert_public ON public.clientes FOR INSERT WITH CHECK (true);


--
-- Name: clientes clientes_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_select_public ON public.clientes FOR SELECT USING (true);


--
-- Name: clientes clientes_update_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_update_admin_only ON public.clientes FOR UPDATE TO authenticated USING (public.fn_is_admin());


--
-- Name: compra_detalles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compra_detalles ENABLE ROW LEVEL SECURITY;

--
-- Name: compra_detalles compra_detalles_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compra_detalles_modify ON public.compra_detalles TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: compra_detalles compra_detalles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compra_detalles_select ON public.compra_detalles FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: compras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

--
-- Name: compras compras_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compras_modify ON public.compras TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: compras compras_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY compras_select ON public.compras FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: costos_configuracion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.costos_configuracion ENABLE ROW LEVEL SECURITY;

--
-- Name: costos_configuracion costos_modify_socio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY costos_modify_socio ON public.costos_configuracion USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: costos_configuracion costos_select_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY costos_select_worker ON public.costos_configuracion FOR SELECT USING (public.fn_is_worker());


--
-- Name: gastos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

--
-- Name: insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

--
-- Name: insumos insumos_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insumos_modify ON public.insumos TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: insumos insumos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insumos_select ON public.insumos FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: liquidaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.liquidaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: liquidaciones liquidaciones_insert_rpc_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidaciones_insert_rpc_only ON public.liquidaciones FOR INSERT TO authenticated WITH CHECK (public.fn_is_socio());


--
-- Name: liquidaciones liquidaciones_select_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidaciones_select_worker ON public.liquidaciones FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: liquidaciones liquidaciones_update_rpc_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY liquidaciones_update_rpc_only ON public.liquidaciones FOR UPDATE TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: categorias_gastos modify_categorias_gastos_socio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modify_categorias_gastos_socio ON public.categorias_gastos USING (public.fn_is_socio());


--
-- Name: gastos modify_gastos_socio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modify_gastos_socio ON public.gastos USING (public.fn_is_socio());


--
-- Name: movimientos_inventario mov_inv_insert_socio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mov_inv_insert_socio ON public.movimientos_inventario FOR INSERT TO authenticated WITH CHECK (public.fn_is_socio());


--
-- Name: movimientos_inventario mov_inv_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mov_inv_select ON public.movimientos_inventario FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: movimientos_caja; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_caja ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos_caja movimientos_caja_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movimientos_caja_insert_all ON public.movimientos_caja FOR INSERT TO authenticated WITH CHECK (public.fn_is_worker());


--
-- Name: movimientos_caja movimientos_caja_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY movimientos_caja_select_all ON public.movimientos_caja FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: movimientos_inventario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles_trabajadores perfiles_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_select_all ON public.perfiles_trabajadores FOR SELECT TO authenticated USING (true);


--
-- Name: perfiles_trabajadores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.perfiles_trabajadores ENABLE ROW LEVEL SECURITY;

--
-- Name: perfiles_trabajadores perfiles_update_restrictive; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY perfiles_update_restrictive ON public.perfiles_trabajadores FOR UPDATE TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: producto_insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.producto_insumos ENABLE ROW LEVEL SECURITY;

--
-- Name: producto_insumos producto_insumos_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY producto_insumos_modify ON public.producto_insumos TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: producto_insumos producto_insumos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY producto_insumos_select ON public.producto_insumos FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: productos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

--
-- Name: productos productos_modify_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY productos_modify_policy ON public.productos TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: productos productos_public_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY productos_public_select_policy ON public.productos FOR SELECT USING (true);


--
-- Name: productos productos_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY productos_select_policy ON public.productos FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: proveedores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

--
-- Name: proveedores proveedores_modify; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_modify ON public.proveedores TO authenticated USING (public.fn_is_socio()) WITH CHECK (public.fn_is_socio());


--
-- Name: proveedores proveedores_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proveedores_select ON public.proveedores FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: redemptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: redemptions redemptions_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY redemptions_select_admin ON public.redemptions FOR SELECT TO authenticated USING (public.fn_is_admin());


--
-- Name: solicitudes_anulacion_venta sav_insert_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sav_insert_worker ON public.solicitudes_anulacion_venta FOR INSERT WITH CHECK (public.fn_is_worker());


--
-- Name: solicitudes_anulacion_venta sav_select_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sav_select_worker ON public.solicitudes_anulacion_venta FOR SELECT USING (public.fn_is_worker());


--
-- Name: categorias_gastos select_categorias_gastos_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_categorias_gastos_worker ON public.categorias_gastos FOR SELECT USING (public.fn_is_worker());


--
-- Name: gastos select_gastos_worker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY select_gastos_worker ON public.gastos FOR SELECT USING (public.fn_is_worker());


--
-- Name: sesiones_caja; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sesiones_caja ENABLE ROW LEVEL SECURITY;

--
-- Name: sesiones_caja sesiones_caja_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_caja_insert_all ON public.sesiones_caja FOR INSERT TO authenticated WITH CHECK (public.fn_is_worker());


--
-- Name: sesiones_caja sesiones_caja_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_caja_select_all ON public.sesiones_caja FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: sesiones_caja sesiones_caja_update_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sesiones_caja_update_all ON public.sesiones_caja FOR UPDATE TO authenticated USING (public.fn_is_worker()) WITH CHECK (public.fn_is_worker());


--
-- Name: solicitudes_anulacion_venta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_anulacion_venta ENABLE ROW LEVEL SECURITY;

--
-- Name: stamp_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: stamp_logs stamp_logs_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stamp_logs_select_admin ON public.stamp_logs FOR SELECT TO authenticated USING (public.fn_is_admin());


--
-- Name: ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

--
-- Name: ventas ventas_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_insert_all ON public.ventas FOR INSERT TO authenticated WITH CHECK (public.fn_is_worker());


--
-- Name: ventas ventas_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ventas_select_all ON public.ventas FOR SELECT TO authenticated USING (public.fn_is_worker());


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) TO anon;
GRANT ALL ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) TO authenticated;
GRANT ALL ON FUNCTION public.abrir_caja(p_monto_apertura numeric, p_apertura_nequi numeric, p_apertura_bancolombia numeric) TO service_role;


--
-- Name: FUNCTION anular_compra(p_compra_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION anular_gasto(p_gasto_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.anular_gasto(p_gasto_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION anular_liquidacion(p_liquidacion_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.anular_liquidacion(p_liquidacion_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION anular_venta_directa(p_venta_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.anular_venta_directa(p_venta_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION aprobar_anulacion_venta(p_solicitud_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) TO anon;
GRANT ALL ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.aprobar_anulacion_venta(p_solicitud_id uuid) TO service_role;


--
-- Name: FUNCTION calcular_saldo_global(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calcular_saldo_global() TO anon;
GRANT ALL ON FUNCTION public.calcular_saldo_global() TO authenticated;
GRANT ALL ON FUNCTION public.calcular_saldo_global() TO service_role;


--
-- Name: FUNCTION cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) TO anon;
GRANT ALL ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) TO authenticated;
GRANT ALL ON FUNCTION public.cerrar_caja(p_monto_cierre_contado numeric, p_observaciones text, p_contado_nequi numeric, p_contado_bancolombia numeric) TO service_role;


--
-- Name: FUNCTION crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) TO anon;
GRANT ALL ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) TO authenticated;
GRANT ALL ON FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text) TO service_role;


--
-- Name: FUNCTION ejecutar_anulacion_venta(p_solicitud_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) TO anon;
GRANT ALL ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.ejecutar_anulacion_venta(p_solicitud_id uuid) TO service_role;


--
-- Name: FUNCTION fn_get_active_session(p_trabajador_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_get_active_session(p_trabajador_id uuid) TO service_role;


--
-- Name: FUNCTION fn_immutable_cost_snapshot(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_immutable_cost_snapshot() TO anon;
GRANT ALL ON FUNCTION public.fn_immutable_cost_snapshot() TO authenticated;
GRANT ALL ON FUNCTION public.fn_immutable_cost_snapshot() TO service_role;


--
-- Name: FUNCTION fn_is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_is_admin() TO anon;
GRANT ALL ON FUNCTION public.fn_is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.fn_is_admin() TO service_role;


--
-- Name: FUNCTION fn_is_socio(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_is_socio() TO anon;
GRANT ALL ON FUNCTION public.fn_is_socio() TO authenticated;
GRANT ALL ON FUNCTION public.fn_is_socio() TO service_role;


--
-- Name: FUNCTION fn_is_worker(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_is_worker() TO anon;
GRANT ALL ON FUNCTION public.fn_is_worker() TO authenticated;
GRANT ALL ON FUNCTION public.fn_is_worker() TO service_role;


--
-- Name: FUNCTION generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) TO anon;
GRANT ALL ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) TO authenticated;
GRANT ALL ON FUNCTION public.generar_liquidacion(p_trabajador_id uuid, p_modalidad text, p_monto numeric, p_observaciones text) TO service_role;


--
-- Name: FUNCTION generate_referral_code(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.generate_referral_code() TO anon;
GRANT ALL ON FUNCTION public.generate_referral_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_referral_code() TO service_role;


--
-- Name: FUNCTION get_client_by_referral_code(ref_code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_client_by_referral_code(ref_code text) TO anon;
GRANT ALL ON FUNCTION public.get_client_by_referral_code(ref_code text) TO authenticated;
GRANT ALL ON FUNCTION public.get_client_by_referral_code(ref_code text) TO service_role;


--
-- Name: FUNCTION increment_stamps(client_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_stamps(client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_stamps(client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_stamps(client_id uuid) TO service_role;


--
-- Name: FUNCTION pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) TO anon;
GRANT ALL ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.pagar_liquidacion(p_liquidacion_id uuid, p_cuenta_origen text, p_sesion_id uuid) TO service_role;


--
-- Name: FUNCTION process_referral_bonus(new_client_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.process_referral_bonus(new_client_id uuid) TO anon;
GRANT ALL ON FUNCTION public.process_referral_bonus(new_client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.process_referral_bonus(new_client_id uuid) TO service_role;


--
-- Name: FUNCTION realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.realizar_transferencia_interna(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION realizar_transferencia_interna_test_rollback(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.realizar_transferencia_interna_test_rollback(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.realizar_transferencia_interna_test_rollback(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.realizar_transferencia_interna_test_rollback(p_origen text, p_destino text, p_monto numeric, p_observaciones text, p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) TO anon;
GRANT ALL ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) TO authenticated;
GRANT ALL ON FUNCTION public.rechazar_anulacion_venta(p_solicitud_id uuid, p_motivo_rechazo text) TO service_role;


--
-- Name: FUNCTION recibir_compra(p_compra_id uuid, p_metodo_pago text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) TO anon;
GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) TO authenticated;
GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text) TO service_role;


--
-- Name: FUNCTION recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recibir_compra(p_compra_id uuid, p_metodo_pago text, p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION redeem_reward(client_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.redeem_reward(client_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.redeem_reward(client_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(client_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_carga_masiva_inventario(p_items jsonb, p_motivo text, p_tipo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_carga_masiva_inventario(p_items jsonb, p_motivo text, p_tipo text) TO anon;
GRANT ALL ON FUNCTION public.registrar_carga_masiva_inventario(p_items jsonb, p_motivo text, p_tipo text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_carga_masiva_inventario(p_items jsonb, p_motivo text, p_tipo text) TO service_role;


--
-- Name: FUNCTION registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_merma_trabajador(p_insumo_id uuid, p_cantidad numeric, p_motivo text) TO service_role;


--
-- Name: FUNCTION registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) TO anon;
GRANT ALL ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text) TO service_role;


--
-- Name: FUNCTION registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO anon;
GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO service_role;


--
-- Name: FUNCTION registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO anon;
GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_saldo_inicial(p_sesion_id uuid, p_efectivo numeric, p_nequi numeric, p_bancolombia numeric) TO service_role;


--
-- Name: FUNCTION registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric, p_monto_nequi numeric, p_monto_bancolombia numeric, p_clientes_extra uuid[], p_idempotency_key uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric, p_monto_nequi numeric, p_monto_bancolombia numeric, p_clientes_extra uuid[], p_idempotency_key uuid) TO anon;
GRANT ALL ON FUNCTION public.registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric, p_monto_nequi numeric, p_monto_bancolombia numeric, p_clientes_extra uuid[], p_idempotency_key uuid) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric, p_monto_nequi numeric, p_monto_bancolombia numeric, p_clientes_extra uuid[], p_idempotency_key uuid) TO service_role;


--
-- Name: FUNCTION resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.resolver_diferencia_caja(p_sesion_id uuid, p_metodo_pago text, p_monto numeric, p_tipo text, p_motivo text) TO service_role;


--
-- Name: FUNCTION solicitar_anulacion_venta(p_venta_id uuid, p_motivo text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) TO anon;
GRANT ALL ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) TO authenticated;
GRANT ALL ON FUNCTION public.solicitar_anulacion_venta(p_venta_id uuid, p_motivo text) TO service_role;


--
-- Name: FUNCTION trigger_check_referral_bonus(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_check_referral_bonus() TO anon;
GRANT ALL ON FUNCTION public.trigger_check_referral_bonus() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_check_referral_bonus() TO service_role;


--
-- Name: FUNCTION trigger_referral_bonus(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trigger_referral_bonus() TO anon;
GRANT ALL ON FUNCTION public.trigger_referral_bonus() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_referral_bonus() TO service_role;


--
-- Name: FUNCTION validate_referral_code(code text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.validate_referral_code(code text) TO anon;
GRANT ALL ON FUNCTION public.validate_referral_code(code text) TO authenticated;
GRANT ALL ON FUNCTION public.validate_referral_code(code text) TO service_role;


--
-- Name: TABLE admin_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_audit_log TO anon;
GRANT ALL ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;


--
-- Name: TABLE perfiles_trabajadores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.perfiles_trabajadores TO anon;
GRANT ALL ON TABLE public.perfiles_trabajadores TO authenticated;
GRANT ALL ON TABLE public.perfiles_trabajadores TO service_role;


--
-- Name: TABLE admin_users; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users TO anon;
GRANT ALL ON TABLE public.admin_users TO authenticated;
GRANT ALL ON TABLE public.admin_users TO service_role;


--
-- Name: TABLE admin_users_legacy; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_users_legacy TO anon;
GRANT ALL ON TABLE public.admin_users_legacy TO authenticated;
GRANT ALL ON TABLE public.admin_users_legacy TO service_role;


--
-- Name: TABLE categorias_gastos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categorias_gastos TO anon;
GRANT ALL ON TABLE public.categorias_gastos TO authenticated;
GRANT ALL ON TABLE public.categorias_gastos TO service_role;


--
-- Name: TABLE clientes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clientes TO anon;
GRANT ALL ON TABLE public.clientes TO authenticated;
GRANT ALL ON TABLE public.clientes TO service_role;


--
-- Name: TABLE compra_detalles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.compra_detalles TO anon;
GRANT ALL ON TABLE public.compra_detalles TO authenticated;
GRANT ALL ON TABLE public.compra_detalles TO service_role;


--
-- Name: TABLE compras; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.compras TO anon;
GRANT ALL ON TABLE public.compras TO authenticated;
GRANT ALL ON TABLE public.compras TO service_role;


--
-- Name: TABLE costos_configuracion; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.costos_configuracion TO anon;
GRANT ALL ON TABLE public.costos_configuracion TO authenticated;
GRANT ALL ON TABLE public.costos_configuracion TO service_role;


--
-- Name: TABLE gastos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.gastos TO anon;
GRANT ALL ON TABLE public.gastos TO authenticated;
GRANT ALL ON TABLE public.gastos TO service_role;


--
-- Name: TABLE insumos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.insumos TO anon;
GRANT ALL ON TABLE public.insumos TO authenticated;
GRANT ALL ON TABLE public.insumos TO service_role;


--
-- Name: TABLE liquidaciones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.liquidaciones TO anon;
GRANT ALL ON TABLE public.liquidaciones TO authenticated;
GRANT ALL ON TABLE public.liquidaciones TO service_role;


--
-- Name: TABLE movimientos_caja; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.movimientos_caja TO anon;
GRANT ALL ON TABLE public.movimientos_caja TO authenticated;
GRANT ALL ON TABLE public.movimientos_caja TO service_role;


--
-- Name: TABLE movimientos_inventario; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.movimientos_inventario TO anon;
GRANT ALL ON TABLE public.movimientos_inventario TO authenticated;
GRANT ALL ON TABLE public.movimientos_inventario TO service_role;


--
-- Name: TABLE producto_insumos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.producto_insumos TO anon;
GRANT ALL ON TABLE public.producto_insumos TO authenticated;
GRANT ALL ON TABLE public.producto_insumos TO service_role;


--
-- Name: TABLE productos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.productos TO anon;
GRANT ALL ON TABLE public.productos TO authenticated;
GRANT ALL ON TABLE public.productos TO service_role;


--
-- Name: TABLE proveedores; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.proveedores TO anon;
GRANT ALL ON TABLE public.proveedores TO authenticated;
GRANT ALL ON TABLE public.proveedores TO service_role;


--
-- Name: TABLE redemptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.redemptions TO anon;
GRANT ALL ON TABLE public.redemptions TO authenticated;
GRANT ALL ON TABLE public.redemptions TO service_role;


--
-- Name: TABLE sesiones_caja; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sesiones_caja TO anon;
GRANT ALL ON TABLE public.sesiones_caja TO authenticated;
GRANT ALL ON TABLE public.sesiones_caja TO service_role;


--
-- Name: TABLE solicitudes_anulacion_venta; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.solicitudes_anulacion_venta TO anon;
GRANT ALL ON TABLE public.solicitudes_anulacion_venta TO authenticated;
GRANT ALL ON TABLE public.solicitudes_anulacion_venta TO service_role;


--
-- Name: TABLE stamp_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stamp_logs TO anon;
GRANT ALL ON TABLE public.stamp_logs TO authenticated;
GRANT ALL ON TABLE public.stamp_logs TO service_role;


--
-- Name: TABLE ventas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ventas TO anon;
GRANT ALL ON TABLE public.ventas TO authenticated;
GRANT ALL ON TABLE public.ventas TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


