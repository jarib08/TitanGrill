-- =====================================================================
-- PROCEDIMIENTO DE ROLLBACK: 20261025_j1_1_membresia_aneiap.sql
-- Titan Grill — Rama: handoff/titan-grill-continuidad-tecnica
--
-- OBJETIVO:
--   Revertir de manera controlada e idempotente las modificaciones de la
--   fase ANEIAP (descuento 15 % y límite diario), restaurando las RPCs a
--   su versión probada y endurecida previa (2026-09-27) sin corromper datos.
--
-- POLITICA DE INTEGRIDAD:
--   - MODO SEGURO POR DEFECTO: Desactiva el beneficio, elimina triggers y
--     restaura registrar_venta y fn_cliente_por_id sin destruir tablas históricas.
--   - MODO REVERSION TOTAL (Comentado): Opcionalmente elimina tablas auxiliares
--     si se requiere remover la estructura por completo.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. ELIMINAR TRIGGER DE ANULACIONES ANEIAP
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ventas_anulacion_aneiap ON public.ventas;
DROP FUNCTION IF EXISTS public.fn_trg_anular_consumo_aneiap();

-- ---------------------------------------------------------------------
-- 2. ELIMINAR RPCs AUXILIARES DE TRABAJADOR ANEIAP
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fn_buscar_asociado_cajero(text);
DROP FUNCTION IF EXISTS public.fn_vincular_asociado_cajero(uuid, text);

-- ---------------------------------------------------------------------
-- 3. RESTAURAR public.fn_cliente_por_id A VERSION PREVIA (20260927_f1_2)
-- ---------------------------------------------------------------------
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

REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. RESTAURAR public.registrar_venta A VERSION PREVIA (20260927_f1_1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_venta(
  p_cliente_id uuid,
  p_total numeric,
  p_metodo_pago text,
  p_detalles jsonb,
  p_monto_efectivo numeric DEFAULT 0,
  p_monto_nequi numeric DEFAULT 0,
  p_monto_bancolombia numeric DEFAULT 0,
  p_clientes_extra uuid[] DEFAULT NULL::uuid[],
  p_idempotency_key uuid DEFAULT NULL::uuid
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_prod_precio numeric;
  v_subtotal_servidor numeric := 0;
BEGIN
  -- 1. AUTH -- ENDURECIDO (VULN-1)
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
  END IF;

  -- 1b. VALIDACION DE MONTOS -- NUEVO (VULN-2)
  IF p_total IS NULL OR p_total < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Total invalido.');
  END IF;
  IF p_metodo_pago = 'MIXTO' THEN
    IF ROUND(COALESCE(p_monto_efectivo,0) + COALESCE(p_monto_nequi,0) + COALESCE(p_monto_bancolombia,0), 2)
       <> ROUND(p_total, 2) THEN
      RETURN json_build_object('success', false,
        'message', 'Pago mixto inconsistente: la suma de los montos no coincide con el total de la venta.');
    END IF;
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
      RETURN json_build_object(
        'success', false,
        'message', 'Conflicto de idempotencia: la clave ya existe con un payload diferente. No se puede procesar.',
        'recovered', false
      );
    END IF;
  END IF;

  -- 4. SESION DE CAJA (Propia del trabajador)
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = v_worker_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;
  IF v_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: debes abrir caja antes de registrar una venta');
  END IF;

  -- 5. PRE-VALIDACION: Catalogo, Recetas y Stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    v_producto_id := (v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 1);
    IF v_quantity <= 0 THEN
      RETURN json_build_object('success', false, 'message', 'Cantidad de producto invalida.');
    END IF;
    SELECT nombre, COALESCE(requiere_inventario, true), COALESCE(precio, 0)
    INTO v_prod_nombre, v_prod_requiere_inv, v_prod_precio
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_nombre IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Producto no encontrado en el catalogo.');
    END IF;
    v_subtotal_servidor := v_subtotal_servidor + (v_prod_precio * v_quantity);

    IF v_prod_requiere_inv THEN
      IF NOT EXISTS (SELECT 1 FROM public.producto_insumos WHERE producto_id = v_producto_id) THEN
        RETURN json_build_object(
          'success', false,
          'message', 'Venta denegada: El producto "' || v_prod_nombre || '" requiere inventario pero no tiene receta configurada.'
        );
      END IF;
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

  IF ROUND(p_total, 2) > ROUND(v_subtotal_servidor, 2) + 0.01 THEN
    RETURN json_build_object('success', false,
      'message', 'Total invalido: el cobro (' || p_total || ') excede el valor real de los productos ('
                 || v_subtotal_servidor || ').');
  END IF;

  -- 6. REGISTRAR VENTA
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

  -- 8. DESCUENTO ATOMICO DE STOCK CON SNAPSHOT INMUTABLE
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    v_producto_id := (v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 1);
    SELECT COALESCE(requiere_inventario, true) INTO v_prod_requiere_inv
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_requiere_inv THEN
      SELECT array_agg(pi.insumo_id ORDER BY pi.insumo_id)
      INTO v_insumo_ids
      FROM public.producto_insumos pi
      WHERE pi.producto_id = v_producto_id;

      FOREACH v_insumo_id IN ARRAY COALESCE(v_insumo_ids, ARRAY[]::uuid[])
      LOOP
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
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. REVERSION TOTAL DE TABLAS (OPCIONAL / MANUAL)
-- Si la direccion tecnica decide remover completamente las tablas del padron:
-- Descomentar las siguientes 2 lineas bajo autorizacion explicita:
-- DROP TABLE IF EXISTS public.asociado_consumos_aneiap CASCADE;
-- DROP TABLE IF EXISTS public.asociados_aneiap CASCADE;
-- ---------------------------------------------------------------------

COMMIT;
