-- =====================================================================
-- FASE D-1 — IMPLEMENTACION DE MEMBRESIA ANEIAP Y DESCUENTO DEL 15 %
-- Fecha: 2026-10-25
-- Rama: handoff/titan-grill-continuidad-tecnica
--
-- OBJETIVO:
--   1. Crear la tabla aislada public.asociados_aneiap con RLS para trabajadores.
--   2. Extender de forma aditiva fn_cliente_por_id para exponer flags seguros.
--   3. Crear RPC autenticada fn_vincular_asociado_cajero para verificacion fisica.
--   4. Crear RPC autenticada fn_buscar_asociado_cajero para consulta en POS.
--   5. Endurecer registrar_venta para validar deterministamente el 15 % en backend.
--
-- REGLAS DE SEGURIDAD:
--   - La anon key NO tiene permiso SELECT, INSERT ni UPDATE sobre asociados_aneiap.
--   - Solo trabajadores activos (fn_is_worker()) pueden verificar carnés y vincular.
--   - Un asociado solo puede vincularse a UNA unica cuenta de cliente (cliente_id UNIQUE).
--   - El descuento del 15 % se valida de manera exacta en el servidor (precios oficiales).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. TABLA public.asociados_aneiap
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asociados_aneiap (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid UNIQUE REFERENCES public.clientes(id) ON DELETE SET NULL,
    documento text UNIQUE NOT NULL,
    nombres text NOT NULL,
    apellidos text NOT NULL,
    celular text,
    activo boolean DEFAULT false NOT NULL,
    estado text DEFAULT 'PENDIENTE_VERIFICACION' NOT NULL,
    descuento_porcentaje numeric(5,2) DEFAULT 15.00 NOT NULL,
    verificado_por uuid REFERENCES public.perfiles_trabajadores(id),
    fecha_verificacion timestamptz,
    metodo_verificacion text DEFAULT 'PENDIENTE' NOT NULL,
    origen text DEFAULT 'EXCEL_UNIMAGDALENA_2026' NOT NULL,
    notas text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT check_estado_asociado CHECK (
        estado IN ('PENDIENTE_VERIFICACION', 'ACTIVO', 'PENDIENTE_CORRECCION', 'REVOCADO', 'INACTIVO')
    ),
    CONSTRAINT check_metodo_verificacion CHECK (
        metodo_verificacion IN ('PENDIENTE', 'CARNE_PRESENCIAL', 'VALIDACION_ADMIN')
    ),
    CONSTRAINT check_descuento_valido CHECK (
        descuento_porcentaje = 15.00
    )
);

CREATE INDEX IF NOT EXISTS idx_asociados_aneiap_cliente ON public.asociados_aneiap(cliente_id);
CREATE INDEX IF NOT EXISTS idx_asociados_aneiap_doc ON public.asociados_aneiap(documento);
CREATE INDEX IF NOT EXISTS idx_asociados_aneiap_estado ON public.asociados_aneiap(estado, activo);

-- ---------------------------------------------------------------------
-- 1b. TABLA public.asociado_consumos_aneiap (CONTROL LIMITE DIARIO 2 UNID/DIA)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asociado_consumos_aneiap (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asociado_id uuid NOT NULL REFERENCES public.asociados_aneiap(id) ON DELETE CASCADE,
    venta_id uuid UNIQUE NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    fecha_consumo date NOT NULL, -- Fecha calendario en America/Bogota
    unidades_descontadas integer NOT NULL CHECK (unidades_descontadas > 0 AND unidades_descontadas <= 2),
    monto_descuento numeric NOT NULL CHECK (monto_descuento >= 0),
    detalles_unidades jsonb DEFAULT '[]'::jsonb NOT NULL,
    estado text DEFAULT 'ACTIVO' NOT NULL CHECK (estado IN ('ACTIVO', 'ANULADO')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asoc_consumos_asoc_fecha 
ON public.asociado_consumos_aneiap(asociado_id, fecha_consumo) 
WHERE estado = 'ACTIVO';

-- ---------------------------------------------------------------------
-- 2. SEGURIDAD Y RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.asociados_aneiap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asociado_consumos_aneiap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asociados_aneiap_select_trabajadores" ON public.asociados_aneiap;
CREATE POLICY "asociados_aneiap_select_trabajadores"
  ON public.asociados_aneiap
  FOR SELECT
  TO authenticated
  USING (public.fn_is_worker());

DROP POLICY IF EXISTS "asociados_aneiap_admin_all" ON public.asociados_aneiap;
CREATE POLICY "asociados_aneiap_admin_all"
  ON public.asociados_aneiap
  FOR ALL
  TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

DROP POLICY IF EXISTS "consumos_aneiap_select_trabajadores" ON public.asociado_consumos_aneiap;
CREATE POLICY "consumos_aneiap_select_trabajadores"
  ON public.asociado_consumos_aneiap
  FOR SELECT
  TO authenticated
  USING (public.fn_is_worker());

DROP POLICY IF EXISTS "consumos_aneiap_admin_all" ON public.asociado_consumos_aneiap;
CREATE POLICY "consumos_aneiap_admin_all"
  ON public.asociado_consumos_aneiap
  FOR ALL
  TO authenticated
  USING (public.fn_is_admin())
  WITH CHECK (public.fn_is_admin());

-- Revocar permisos publicos directos
REVOKE ALL ON public.asociados_aneiap FROM anon, public;
REVOKE ALL ON public.asociado_consumos_aneiap FROM anon, public;
GRANT SELECT ON public.asociados_aneiap TO authenticated;
GRANT SELECT ON public.asociado_consumos_aneiap TO authenticated;

-- ---------------------------------------------------------------------
-- 2b. TRIGGER PARA ANULACIONES (LIBERACION CONTROLADA DE LIMITE)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trg_anular_consumo_aneiap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.estado = 'ANULADA' AND (OLD.estado IS NULL OR OLD.estado <> 'ANULADA') THEN
    UPDATE public.asociado_consumos_aneiap
    SET estado = 'ANULADO', updated_at = now()
    WHERE venta_id = NEW.id AND estado = 'ACTIVO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ventas_anulacion_aneiap ON public.ventas;
CREATE TRIGGER trg_ventas_anulacion_aneiap
AFTER UPDATE OF estado ON public.ventas
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_anular_consumo_aneiap();

-- ---------------------------------------------------------------------
-- 3. ACTUALIZACION ADITIVA DE fn_cliente_por_id
-- ---------------------------------------------------------------------
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
-- 4. RPC AUTENTICADA: fn_buscar_asociado_cajero
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_buscar_asociado_cajero(p_documento text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_asoc record;
  v_cliente_nombre text;
BEGIN
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo.');
  END IF;

  v_norm := regexp_replace(COALESCE(p_documento, ''), '\D', '', 'g');
  IF length(v_norm) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Documento no valido.');
  END IF;

  SELECT * INTO v_asoc FROM public.asociados_aneiap WHERE documento = v_norm LIMIT 1;

  IF v_asoc.id IS NULL THEN
    RETURN json_build_object('success', true, 'encontrado', false, 'message', 'Documento no encontrado en el padron de ANEIAP.');
  END IF;

  IF v_asoc.cliente_id IS NOT NULL THEN
    SELECT nombre INTO v_cliente_nombre FROM public.clientes WHERE id = v_asoc.cliente_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'encontrado', true,
    'asociado', json_build_object(
      'id', v_asoc.id,
      'documento', v_asoc.documento,
      'nombres', v_asoc.nombres,
      'apellidos', v_asoc.apellidos,
      'activo', v_asoc.activo,
      'estado', v_asoc.estado,
      'descuento_porcentaje', v_asoc.descuento_porcentaje,
      'cliente_id', v_asoc.cliente_id,
      'cliente_nombre', v_cliente_nombre,
      'notas', v_asoc.notas
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- 5. RPC AUTENTICADA: fn_vincular_asociado_cajero
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_vincular_asociado_cajero(p_cliente_id uuid, p_documento text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_worker_id uuid;
  v_norm text;
  v_asoc record;
  v_cliente_exists boolean;
BEGIN
  -- 1. Validar autenticacion de trabajador
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo.');
  END IF;
  v_worker_id := auth.uid();

  -- 2. Validar que el cliente existe
  SELECT EXISTS(SELECT 1 FROM public.clientes WHERE id = p_cliente_id) INTO v_cliente_exists;
  IF NOT v_cliente_exists THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado en el sistema.');
  END IF;

  -- 3. Normalizar documento
  v_norm := regexp_replace(COALESCE(p_documento, ''), '\D', '', 'g');
  IF length(v_norm) = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Documento no valido.');
  END IF;

  -- 4. Buscar en asociados_aneiap
  SELECT * INTO v_asoc FROM public.asociados_aneiap WHERE documento = v_norm LIMIT 1;
  IF v_asoc.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El documento ingresado no figura en el padron oficial de ANEIAP.');
  END IF;

  -- 5. Comprobar observaciones de calidad o suspension
  IF v_asoc.estado = 'PENDIENTE_CORRECCION' THEN
    RETURN json_build_object('success', false, 'message', 'Membresia en observacion por datos incompletos en el padron original. Contacte al administrador.');
  END IF;
  IF v_asoc.estado = 'REVOCADO' THEN
    RETURN json_build_object('success', false, 'message', 'La membresia de este asociado ha sido revocada.');
  END IF;

  -- 6. Comprobar conflicto de vinculacion
  IF v_asoc.cliente_id IS NOT NULL AND v_asoc.cliente_id <> p_cliente_id THEN
    RETURN json_build_object('success', false, 'message', 'Este documento ANEIAP ya se encuentra vinculado a otra tarjeta de cliente.');
  END IF;

  -- 7. Comprobar si el cliente ya tenia otra membresia asociada
  IF EXISTS(SELECT 1 FROM public.asociados_aneiap WHERE cliente_id = p_cliente_id AND id <> v_asoc.id) THEN
    RETURN json_build_object('success', false, 'message', 'Este cliente ya tiene otra membresia ANEIAP vinculada.');
  END IF;

  -- 8. Actualizar registro y registrar auditoria presencial
  UPDATE public.asociados_aneiap
  SET cliente_id = p_cliente_id,
      activo = true,
      estado = 'ACTIVO',
      verificado_por = v_worker_id,
      fecha_verificacion = now(),
      metodo_verificacion = 'CARNE_PRESENCIAL',
      updated_at = now()
  WHERE id = v_asoc.id;

  RETURN json_build_object(
    'success', true,
    'message', 'Membresia ANEIAP activada y verificada presencialmente con exito (15 % de descuento concedido).',
    'asociado', json_build_object(
      'id', v_asoc.id,
      'nombres', v_asoc.nombres,
      'apellidos', v_asoc.apellidos,
      'descuento_porcentaje', v_asoc.descuento_porcentaje
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------
-- 6. ENDURECIMIENTO DE registrar_venta (VALIDACION EXACTA DEL 15 %)
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
  v_quantity integer;
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
  v_descuento_tipo text;
  v_es_aneiap_activo boolean := false;
  v_descuento_autorizado numeric := 0;
  v_total_esperado numeric := 0;
  v_asoc record;
  v_fecha_hoy_bogota date;
  v_unidades_consumidas_hoy integer := 0;
  v_unidades_disponibles_hoy integer := 0;
  v_unidades_solicitadas integer := 0;
  v_unidades_limite integer := 0;
  v_unidades_a_descontar integer := 0;
  v_unit_prices numeric[] := ARRAY[]::numeric[];
  v_p numeric;
  v_k integer;
  v_detalles_descuento jsonb := '[]'::jsonb;
BEGIN
  -- 1. AUTH -- GUARD OBLIGATORIO
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere ser trabajador activo');
  END IF;
  v_worker_id := auth.uid();
  IF v_worker_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
  END IF;

  -- 1b. VALIDACION DE MONTOS
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
  IF p_detalles IS NULL OR NOT (p_detalles ? 'items') OR jsonb_typeof(p_detalles->'items') <> 'array' OR jsonb_array_length(p_detalles->'items') = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Detalles invalidos: se requiere una lista no vacia de items.');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_detalles->'items')
  LOOP
    IF (v_item->>'id') IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Producto invalido: identificador requerido.');
    END IF;
    v_producto_id := (v_item->>'id')::uuid;

    -- Validacion estricta de cantidad: entero positivo finito sin decimales
    IF (v_item->>'quantity') IS NULL OR (v_item->>'quantity') !~ '^[1-9][0-9]*$' THEN
      RETURN json_build_object('success', false, 'message', 'Cantidad de producto invalida: debe ser un numero entero positivo.');
    END IF;
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity > 500 THEN
      RETURN json_build_object('success', false, 'message', 'Cantidad de producto excede el limite maximo permitido (500).');
    END IF;
    SELECT nombre, COALESCE(requiere_inventario, true), COALESCE(precio, 0)
    INTO v_prod_nombre, v_prod_requiere_inv, v_prod_precio
    FROM public.productos WHERE id = v_producto_id;
    IF v_prod_nombre IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Producto no encontrado en el catalogo.');
    END IF;
    -- Subtotal oficial del servidor
    v_subtotal_servidor := v_subtotal_servidor + (v_prod_precio * v_quantity);

    -- Expandir unidades individuales para calculo determinista del limite diario
    FOR v_k IN 1..v_quantity::integer LOOP
      v_unit_prices := array_append(v_unit_prices, v_prod_precio);
    END LOOP;

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

  -- 5b. VALIDACION DETERMINISTA DE PRECIOS Y DESCUENTO ANEIAP (LIMITE 2 UNID/DIA EN America/Bogota)
  v_descuento_tipo := COALESCE(p_detalles->>'descuento_tipo', '');

  IF v_descuento_tipo = 'ANEIAP' THEN
    IF p_cliente_id IS NULL THEN
      RETURN json_build_object('success', false, 'message', 'Venta denegada: Se requiere seleccionar un cliente para aplicar el descuento de ANEIAP.');
    END IF;

    -- Bloquear y validar registro del asociado (evita condiciones de carrera concurrentes)
    SELECT id, activo, estado INTO v_asoc
    FROM public.asociados_aneiap
    WHERE cliente_id = p_cliente_id
    FOR UPDATE;

    IF v_asoc.id IS NULL OR NOT (v_asoc.activo = true AND v_asoc.estado = 'ACTIVO') THEN
      RETURN json_build_object('success', false, 'message', 'Venta denegada: El cliente seleccionado no cuenta con membresia ANEIAP activa y autorizada.');
    END IF;

    -- Fecha calendario estricta en 'America/Bogota'
    v_fecha_hoy_bogota := (now() AT TIME ZONE 'America/Bogota')::date;

    -- Conteo transaccional de unidades descontadas hoy
    SELECT COALESCE(SUM(unidades_descontadas), 0)
    INTO v_unidades_consumidas_hoy
    FROM public.asociado_consumos_aneiap
    WHERE asociado_id = v_asoc.id
      AND fecha_consumo = v_fecha_hoy_bogota
      AND estado = 'ACTIVO';

    -- Cupo maximo: 2 unidades por dia calendario
    v_unidades_disponibles_hoy := GREATEST(0, 2 - v_unidades_consumidas_hoy);

    -- Unidades solicitadas con descuento por el cajero (por defecto, todas las disponibles)
    IF p_detalles ? 'unidades_aneiap_solicitadas' AND (p_detalles->>'unidades_aneiap_solicitadas') ~ '^[0-9]+$' THEN
      v_unidades_solicitadas := (p_detalles->>'unidades_aneiap_solicitadas')::integer;
    ELSE
      v_unidades_solicitadas := v_unidades_disponibles_hoy;
    END IF;

    -- El limite efectivo nunca puede superar el cupo disponible ni lo solicitado
    v_unidades_limite := LEAST(v_unidades_disponibles_hoy, GREATEST(0, v_unidades_solicitadas));

    v_descuento_autorizado := 0;
    v_unidades_a_descontar := 0;

    -- Si hay unidades disponibles y productos en la orden, descontar las unidades de mayor valor
    IF v_unidades_limite > 0 AND array_length(v_unit_prices, 1) > 0 THEN
      SELECT array_agg(u ORDER BY u DESC) INTO v_unit_prices FROM unnest(v_unit_prices) u;

      FOR v_k IN 1..LEAST(v_unidades_limite, array_length(v_unit_prices, 1)) LOOP
        v_p := v_unit_prices[v_k];
        v_descuento_autorizado := v_descuento_autorizado + ROUND(v_p * 0.15, 0);
        v_unidades_a_descontar := v_unidades_a_descontar + 1;
        v_detalles_descuento := v_detalles_descuento || jsonb_build_object(
          'unidad', v_k,
          'precio_regular', v_p,
          'descuento_15', ROUND(v_p * 0.15, 0)
        );
      END LOOP;
    END IF;

    v_total_esperado := v_subtotal_servidor - v_descuento_autorizado;

    -- Validar que el total pagado coincida con el total calculado (tolerancia de $1 COP por redondeo)
    IF ABS(ROUND(p_total, 2) - ROUND(v_total_esperado, 2)) > 1.00 THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Total invalido: el cobro (' || p_total || ') no coincide con el calculo del 15 % de ANEIAP para '
                   || v_unidades_a_descontar || ' unidad(es) descontada(s) (' || v_total_esperado || ').'
      );
    END IF;
  ELSE
    -- Venta regular sin descuento ANEIAP: no puede exceder el subtotal oficial
    IF ROUND(p_total, 2) > ROUND(v_subtotal_servidor, 2) + 0.01 THEN
      RETURN json_build_object('success', false,
        'message', 'Total invalido: el cobro (' || p_total || ') excede el valor real de los productos ('
                   || v_subtotal_servidor || ').');
    END IF;
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

  -- 6b. REGISTRAR CONSUMO DIARIO ANEIAP (SI SE APLICARON UNIDADES CON DESCUENTO)
  IF v_descuento_tipo = 'ANEIAP' AND v_unidades_a_descontar > 0 THEN
    INSERT INTO public.asociado_consumos_aneiap
      (asociado_id, venta_id, fecha_consumo, unidades_descontadas, monto_descuento, detalles_unidades)
    VALUES
      (v_asoc.id, v_venta_id, v_fecha_hoy_bogota, v_unidades_a_descontar, v_descuento_autorizado, v_detalles_descuento);
  END IF;

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
    v_quantity := (v_item->>'quantity')::integer;
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

  -- 9. ASIGNACION DE SELLOS DE FIDELIZACION (Mismo flujo inalterado)
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

-- ---------------------------------------------------------------------
-- 7. ENDURECIMIENTO DE PERMISOS DE EJECUCION (SECURITY DEFINER HARDENING)
-- ---------------------------------------------------------------------
-- 1. Trigger de anulacion: no invocable directamente por anon ni public
REVOKE EXECUTE ON FUNCTION public.fn_trg_anular_consumo_aneiap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_trg_anular_consumo_aneiap() TO authenticated, service_role;

-- 2. Consulta publica aditiva de cliente (QR / POS): anon y authenticated
REVOKE EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cliente_por_id(uuid) TO anon, authenticated, service_role;

-- 3. Busqueda de asociado en POS: solo trabajadores autenticados
REVOKE EXECUTE ON FUNCTION public.fn_buscar_asociado_cajero(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_buscar_asociado_cajero(text) TO authenticated, service_role;

-- 4. Vinculacion presencial de carne en POS: solo trabajadores autenticados
REVOKE EXECUTE ON FUNCTION public.fn_vincular_asociado_cajero(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_vincular_asociado_cajero(uuid, text) TO authenticated, service_role;

-- 5. Registro de venta: solo trabajadores autenticados
REVOKE EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_venta(uuid, numeric, text, jsonb, numeric, numeric, numeric, uuid[], uuid) TO authenticated, service_role;

COMMIT;

