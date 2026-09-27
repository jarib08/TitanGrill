-- =====================================================================
-- FASE 1.1 — CIERRE DE BACKDOOR DE AUTENTICACION
-- Fecha: 2026-09-27
-- Rama: audit/titan-grill-forensic-handoff
--
-- HALLAZGOS QUE CIERRA
--   VULN-1  registrar_venta: SECURITY DEFINER, sin guard fn_is_worker(), con
--           fallback que suplantaba "un trabajador activo cualquiera" cuando
--           auth.uid() era NULL, y con PUBLIC EXECUTE.
--           DEMOSTRADO EN AUDITORIA: el rol anon (sin autenticacion) obtuvo
--           success=true registrando una venta de $1 por 10 unidades de un
--           producto de $1.000, atribuida al "Administrador Principal",
--           con COGS de $6.000 descontado del inventario.
--   VULN-1b registrar_venta: si el trabajador no tenia caja abierta, tomaba
--           CUALQUIER caja abierta del negocio.
--   VULN-2  registrar_venta: p_total se aceptaba a ciegas del cliente, sin
--           recalcular contra productos.precio; y para MIXTO no se validaba
--           que efectivo+nequi+bancolombia = total.
--   VULN-3  registrar_carga_masiva_inventario: SIN ningun guard de
--           autorizacion, con doble fallback de suplantacion y PUBLIC
--           EXECUTE. Un anonimo podia reescribir el stock de todos los
--           insumos.
--   B6      Ambas funciones son SECURITY DEFINER; registrar_venta no tenia
--           SET search_path (riesgo de search_path hijacking).
--   LIMPIEZA realizar_transferencia_interna_test_rollback: funcion de prueba
--           olvidada en produccion con PUBLIC EXECUTE.
--
-- LO QUE NO CAMBIA (verificado por diff contra el cuerpo original)
--   - Logica de idempotencia (idempotency_key + payload_fingerprint)
--   - Pre-validacion de receta, ingredientes inactivos y stock
--   - Snapshot inmutable de costos (costo_unitario_historico / _total_)
--   - Orden deterministico de FOR UPDATE (anti-deadlock)
--   - Movimientos de caja y fidelizacion (sellos)
--   - Forma del JSON de respuesta
--
-- ROLLBACK: supabase/migrations/rollback/20260927_f1_1_ROLLBACK.sql
-- BACKUP PREVIO: supabase/backups/ (dump verificado, 305 objetos)
-- =====================================================================

BEGIN;

-- ---------- 1. registrar_venta endurecida ----------
CREATE OR REPLACE FUNCTION public.registrar_venta(p_cliente_id uuid, p_total numeric, p_metodo_pago text, p_detalles jsonb, p_monto_efectivo numeric DEFAULT 0, p_monto_nequi numeric DEFAULT 0, p_monto_bancolombia numeric DEFAULT 0, p_clientes_extra uuid[] DEFAULT NULL::uuid[], p_idempotency_key uuid DEFAULT NULL::uuid)
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
  -- ANTES: si auth.uid() era NULL, la funcion suplantaba a "un trabajador
  -- activo cualquiera" y continuaba. Como la funcion es SECURITY DEFINER y
  -- tenia PUBLIC EXECUTE, un llamador ANONIMO (solo con la anon key, que va
  -- publicada en el bundle JS) podia registrar ventas falsas, descontar
  -- inventario e inyectar movimientos de caja a nombre de un empleado real.
  -- VERIFICADO en auditoria 2026-09-27: el rol anon obtenia success=true.
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

  -- 4. SESION DE CAJA -- ENDURECIDO (VULN-1b)
  -- ANTES: si el trabajador no tenia caja abierta, se tomaba CUALQUIER caja
  -- abierta del negocio. Eso atribuia ventas y efectivo a la caja de otra
  -- persona. Ahora solo se acepta la caja propia.
  SELECT id INTO v_sesion_id
  FROM public.sesiones_caja
  WHERE trabajador_id = v_worker_id AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;
  IF v_sesion_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: debes abrir caja antes de registrar una venta');
  END IF;

  -- 5. PRE-VALIDACION: Receta completa, inactivos y stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    v_producto_id := (v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 1);
    SELECT nombre, COALESCE(requiere_inventario, true), COALESCE(precio, 0)
    INTO v_prod_nombre, v_prod_requiere_inv, v_prod_precio
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_nombre IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Producto no encontrado en el catalogo.');
    END IF;
    -- Acumular subtotal con el PRECIO REAL del catalogo, no el del cliente
    v_subtotal_servidor := v_subtotal_servidor + (v_prod_precio * v_quantity);
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

  -- 5b. VALIDACION DE TOTAL CONTRA PRECIOS REALES -- NUEVO (VULN-2)
  -- El servidor ya no acepta a ciegas el total del cliente. No puede exceder
  -- el valor de los productos segun productos.precio. Los descuentos
  -- (total < subtotal) siguen permitidos.
  IF ROUND(p_total, 2) > ROUND(v_subtotal_servidor, 2) + 0.01 THEN
    RETURN json_build_object('success', false,
      'message', 'Total invalido: el cobro (' || p_total || ') excede el valor real de los productos ('
                 || v_subtotal_servidor || '). Si un precio cambio hace poco, recargue el catalogo del POS e intente de nuevo.');
  END IF;

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
$function$
;

-- ---------- 2. registrar_carga_masiva_inventario endurecida ----------
CREATE OR REPLACE FUNCTION public.registrar_carga_masiva_inventario(p_items jsonb, p_motivo text DEFAULT 'Carga Inicial de Inventario'::text, p_tipo text DEFAULT 'AJUSTE'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- AUTH -- ENDURECIDO (VULN-3)
  -- ANTES: la funcion no tenia NINGUN guard de autorizacion y, si auth.uid()
  -- era NULL, hacia doble fallback (un socio, luego cualquier perfil). Con
  -- PUBLIC EXECUTE, un anonimo podia reescribir el stock de TODOS los insumos.
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
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
$function$
;

-- ---------- 3. Quitar EXECUTE a anon y PUBLIC (defensa en profundidad) ----------
-- Estas dos funciones solo deben invocarse desde sesiones autenticadas.
-- El guard interno ya las protege; esto cierra la superficie de ataque.
REVOKE EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_carga_masiva_inventario(jsonb, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_carga_masiva_inventario(jsonb, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_carga_masiva_inventario(jsonb, text, text) TO authenticated, service_role;

-- ---------- 4. Eliminar funcion de prueba olvidada en produccion ----------
DROP FUNCTION IF EXISTS public.realizar_transferencia_interna_test_rollback(text, text, numeric, text, uuid);

COMMIT;
