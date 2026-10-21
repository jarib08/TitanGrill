-- =====================================================================
-- PAQUETE A — CONTRATOS DE SESION DE CAJA
-- Fecha: 2026-10-21
--
-- ##########################################################
-- ##  NO EJECUTADA. Requiere autorizacion explicita.      ##
-- ##########################################################
--
-- HALLAZGO, MEDIDO EN PRODUCCION HOY
--   Tres funciones resolvian la sesion de caja con
--       WHERE estado = 'ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1
--   sin filtrar por usuario. El movimiento se cargaba a la caja del cajero
--   cuya sesion fuera mas reciente, aunque no tuviera nada que ver.
--
--   Impacto real contado en movimientos_caja:
--     RETIRO                  5 movs   $1.541.180
--     TRANSFERENCIA_INTERNA   6 movs     $399.662
--     SALDO_INICIAL           2 movs     $241.031
--     liquidaciones           2 movs      $80.000
--     INGRESO_MANUAL          1 mov       $47.000
--     ------------------------------------------
--     TOTAL                            $2.308.873  atribuidos a caja ajena
--
--   Consecuencia operativa concreta: la sesion d23831d6 de Trabajador 1
--   acumulo $1.541.180 de retiros que el no hizo. Su arqueo esperado quedo en
--   -$1.029.889, el CHECK (monto_cierre_esperado >= 0) impidio cerrarla por
--   cerrar_caja, y el 10-oct se cerro con un UPDATE directo dejando
--   esperado/contado/diferencia en NULL: 33 dias de operacion sin arqueo.
--
-- DECISION DE NEGOCIO APLICADA (Decision 1, ya aprobada)
--   Registrar el origen real de los fondos; nunca atribuir a caja ajena.
--     NEQUI / BANCOLOMBIA              -> sesion_id = NULL (no pasa por el cajon)
--     EFECTIVO + el actor tiene caja   -> su propia sesion
--     EFECTIVO + el actor NO tiene caja-> sesion_id = NULL
--
-- ALCANCE
--   Solo corrige la ATRIBUCION. No toca montos, no reclasifica historia, no
--   crea ni borra movimientos. Los $2.308.873 ya registrados se quedan donde
--   estan: reasignarlos es una decision aparte (ver INFORME, Gap 2).
--
-- NO INCLUYE (son paquetes separados, con decisiones pendientes)
--   - Paquete B: si el INGRESO compensatorio de anular_compra debe existir
--   - Paquete C: restaurar insumos.costo_unitario al anular una compra
--   - El CHECK que impide cerrar cajas con esperado negativo
--   - Los asientos de inventario inicial que faltan
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. La regla, en UN solo sitio
-- ---------------------------------------------------------------
-- Se centraliza a proposito: la misma logica estaba copiada en tres funciones
-- y en las tres estaba mal. Con un helper, corregirla o cambiarla es un solo
-- punto, y las pruebas apuntan a un solo objetivo.
CREATE OR REPLACE FUNCTION public.fn_resolver_sesion_movimiento(
  p_metodo_pago      text,
  p_sesion_explicita uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_sesion uuid;
BEGIN
  -- Una sesion explicita se respeta, pero solo si existe y esta ABIERTA.
  IF p_sesion_explicita IS NOT NULL THEN
    SELECT id INTO v_sesion FROM sesiones_caja
    WHERE id = p_sesion_explicita AND estado = 'ABIERTA';
    RETURN v_sesion;   -- NULL si no es valida: nunca se inventa una caja
  END IF;

  -- El dinero electronico no entra ni sale del cajon fisico, asi que no
  -- pertenece a ninguna sesion de caja.
  IF p_metodo_pago IS DISTINCT FROM 'EFECTIVO' THEN
    RETURN NULL;
  END IF;

  -- Efectivo: SOLO la caja propia del actor. Si no tiene, el movimiento queda
  -- sin sesion, que es lo correcto para un socio que paga de su bolsillo.
  SELECT id INTO v_sesion FROM sesiones_caja
  WHERE trabajador_id = auth.uid() AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC LIMIT 1;

  RETURN v_sesion;
END;
$function$;

COMMENT ON FUNCTION public.fn_resolver_sesion_movimiento(text, uuid) IS
  'Decision 1: resuelve a que sesion de caja pertenece un movimiento. Nunca devuelve la caja de otro trabajador.';

-- ---------------------------------------------------------------
-- 2. crear_gasto (defecto D-01)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_gasto(p_categoria_id uuid, p_descripcion text, p_monto numeric, p_metodo_pago text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- PAQUETE A: antes hacia
    --   WHERE estado='ABIERTA' ORDER BY fecha_apertura DESC LIMIT 1
    -- sin filtrar por usuario, asi que el gasto se cargaba a la caja del
    -- cajero cuya sesion fuera mas reciente. Medido en produccion:
    -- $2.308.873 en movimientos atribuidos a la caja de otra persona.
    v_sesion_id := public.fn_resolver_sesion_movimiento(p_metodo_pago);


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
$function$
;

-- ---------------------------------------------------------------
-- 3. registrar_movimiento_manual (defecto NO listado en el traspaso)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_movimiento_manual(p_tipo text, p_monto numeric, p_metodo_pago text, p_descripcion text, p_tipo_operacion text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- PAQUETE A: misma correccion que en crear_gasto. Un retiro de socio ya no
  -- se carga contra la caja fisica de un cajero. Medido: 5 retiros por
  -- $1.541.180 quedaron cargados a la sesion de Trabajador 1.
  v_sesion_id := public.fn_resolver_sesion_movimiento(p_metodo_pago);

  INSERT INTO public.movimientos_caja (tipo, monto, metodo_pago, descripcion, trabajador_id, sesion_id, tipo_operacion)
  VALUES (p_tipo, p_monto, p_metodo_pago, COALESCE(p_descripcion, 'Movimiento manual registrado'), v_user_id, v_sesion_id, p_tipo_operacion)
  RETURNING id INTO v_mov_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Movimiento registrado exitosamente',
    'movimiento_id', v_mov_id
  );
END;
$function$
;

-- ---------------------------------------------------------------
-- 4. anular_compra (defecto D-03, solo la parte de atribucion)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anular_compra(p_compra_id uuid, p_motivo text, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- PAQUETE A: ya no toma una caja arbitraria. Para una reversion, lo
  -- simetrico es devolver a la MISMA caja de la que salio el dinero, asi que
  -- mas abajo se usa COALESCE(v_sesion_id, v_egreso.sesion_id) y aqui se
  -- resuelve solo la caja propia del actor.
  -- NOTA: que el INGRESO compensatorio deba existir es una decision aparte
  -- (Paquete B): anular una compra no demuestra que el proveedor devolvio
  -- el dinero. Esta correccion solo evita la atribucion a cajas ajenas.
  v_sesion_id := public.fn_resolver_sesion_movimiento('EFECTIVO');


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
$function$
;

-- ---------------------------------------------------------------
-- 5. Permisos
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fn_resolver_sesion_movimiento(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_resolver_sesion_movimiento(text, uuid) TO authenticated, service_role;

COMMIT;
