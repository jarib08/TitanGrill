-- =====================================================================
-- FASE H1.1 — AJUSTE DE STOCK ATOMICO Y TRAZABLE
-- Fecha: 2026-09-27
--
-- HALLAZGOS QUE CIERRA (AdminDashboard.jsx handleAjustarStock, :1447)
--
--   H-1 NO ATOMICO. Hacia UPDATE insumos y luego INSERT movimientos_inventario
--       como dos viajes separados. Si el segundo fallaba, el stock cambiaba
--       SIN DEJAR RASTRO.
--
--   H-2 LECTURA OBSOLETA (lost update). Calculaba el nuevo stock desde
--       insumo.stock_actual cacheado en el navegador. Si el POS vendia entre la
--       carga de la pantalla y el ajuste, la venta se PISABA: el stock quedaba
--       como si esa venta no hubiera ocurrido.
--
--   H-3 CLAMP SILENCIOSO. Math.max(0, ...) convertia un ajuste imposible en
--       stock 0 sin avisar. Un descuadre de -100 sobre 50 unidades se
--       "resolvia" poniendo 0 y ocultando el problema.
--
--   H-4 SIN SNAPSHOT DE COSTO. No escribia costo_unitario_historico ni
--       costo_total_historico, asi que los ajustes y mermas quedaban fuera del
--       COGS que se corrigio en la Fase F.
--
--   H-5 SIN IDEMPOTENCIA. Un doble clic aplicaba el ajuste dos veces.
--
--   H-6 TIPO Y SIGNO INCOHERENTES. Nada impedia insertar tipo='MERMA' con
--       cantidad positiva, es decir inflar el stock llamandolo desperdicio.
--
-- SE SIGUE EL PATRON QUE YA EXISTE EN EL PROYECTO
--   registrar_merma_trabajador ya hacia esto bien (guard, FOR UPDATE, rechazo
--   explicito en vez de GREATEST, atomicidad). Esta RPC replica ese estilo y de
--   paso se le agrega a esa funcion el snapshot de costo, que le faltaba.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Idempotencia en movimientos_inventario (H-5)
-- ---------------------------------------------------------------
-- ventas y movimientos_caja ya tienen idempotency_key; movimientos_inventario
-- no. Nullable para no invalidar los 970 movimientos historicos.
ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS idempotency_key uuid NULL;

COMMENT ON COLUMN public.movimientos_inventario.idempotency_key IS
  'Clave de idempotencia para ajustes manuales. NULL en los movimientos historicos y en los generados por RPCs que no la usan.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_movinv_idempotency
  ON public.movimientos_inventario (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------
-- 2. RPC de ajuste atomico
-- ---------------------------------------------------------------
-- p_cantidad es el DELTA CON SIGNO, no una magnitud. La RPC valida la
-- coherencia entre tipo y signo (H-6):
--   ENTRADA -> debe ser positivo
--   MERMA   -> debe ser negativo
--   AJUSTE  -> cualquiera de los dos (correccion + o -)
CREATE OR REPLACE FUNCTION public.ajustar_stock_insumo(
  p_insumo_id       uuid,
  p_tipo            text,
  p_cantidad        numeric,
  p_motivo          text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor        uuid;
  v_existente    record;
  v_stock_previo numeric;
  v_activo       boolean;
  v_nombre       text;
  v_unidad       text;
  v_costo_unit   numeric;
  v_stock_nuevo  numeric;
  v_costo_total  numeric;
  v_mov_id       uuid;
BEGIN
  IF NOT public.fn_is_socio() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Socio Administrador');
  END IF;
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: sesion no autenticada');
  END IF;

  -- ── Idempotencia (H-5): un doble clic recupera el resultado anterior ──
  IF p_idempotency_key IS NOT NULL THEN
    SELECT mi.id, mi.cantidad, mi.tipo, i.stock_actual
      INTO v_existente
    FROM public.movimientos_inventario mi
    JOIN public.insumos i ON i.id = mi.insumo_id
    WHERE mi.idempotency_key = p_idempotency_key;

    IF v_existente.id IS NOT NULL THEN
      RETURN json_build_object('success', true, 'recuperado', true,
        'movimiento_id', v_existente.id,
        'stock_nuevo', v_existente.stock_actual,
        'message', 'Este ajuste ya se habia registrado. No se aplico dos veces.');
    END IF;
  END IF;

  -- ── Validaciones de entrada ──
  IF p_tipo IS NULL OR p_tipo NOT IN ('ENTRADA','AJUSTE','MERMA') THEN
    RETURN json_build_object('success', false, 'message', 'Tipo invalido. Use ENTRADA, AJUSTE o MERMA.');
  END IF;
  IF p_cantidad IS NULL OR p_cantidad = 0 THEN
    RETURN json_build_object('success', false, 'message', 'La cantidad no puede ser cero.');
  END IF;

  -- H-6: coherencia entre tipo y signo
  IF p_tipo = 'ENTRADA' AND p_cantidad < 0 THEN
    RETURN json_build_object('success', false, 'message', 'Una ENTRADA no puede tener cantidad negativa. Use MERMA o AJUSTE.');
  END IF;
  IF p_tipo = 'MERMA' AND p_cantidad > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Una MERMA no puede aumentar el stock. Use ENTRADA o AJUSTE.');
  END IF;

  -- Motivo obligatorio cuando el stock BAJA o se corrige: un descuadre sin
  -- justificacion no es auditable. Una ENTRADA puede quedar sin motivo.
  IF p_tipo IN ('MERMA','AJUSTE') AND (p_motivo IS NULL OR TRIM(p_motivo) = '') THEN
    RETURN json_build_object('success', false,
      'message', format('El motivo es obligatorio para un movimiento de tipo %s.', p_tipo));
  END IF;

  -- ── H-2: leer y BLOQUEAR el insumo. El stock se calcula desde el valor
  --    bloqueado en la base, nunca desde el que tenia cargado el navegador.
  SELECT stock_actual, activo, nombre, unidad_medida, COALESCE(costo_unitario, 0)
    INTO v_stock_previo, v_activo, v_nombre, v_unidad, v_costo_unit
  FROM public.insumos
  WHERE id = p_insumo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Insumo no encontrado.');
  END IF;

  -- Un insumo inactivo si puede CORREGIRSE (AJUSTE), porque justamente puede
  -- necesitar saneamiento de datos, pero no recibir entradas ni mermas nuevas.
  IF NOT v_activo AND p_tipo IN ('ENTRADA','MERMA') THEN
    RETURN json_build_object('success', false,
      'message', format('%s esta inactivo: no admite %s. Solo se permite AJUSTE para corregir datos.', v_nombre, p_tipo));
  END IF;

  v_stock_nuevo := v_stock_previo + p_cantidad;

  -- ── H-3: rechazo EXPLICITO en vez de clamp silencioso ──
  IF v_stock_nuevo < 0 THEN
    RETURN json_build_object('success', false,
      'message', format('El movimiento dejaria el stock de %s en %s. Stock disponible: %s %s. Revise la cantidad o el conteo fisico.',
                        v_nombre, v_stock_nuevo, v_stock_previo, v_unidad),
      'stock_previo', v_stock_previo, 'stock_resultante', v_stock_nuevo);
  END IF;

  -- ── H-1: UPDATE e INSERT en la MISMA transaccion ──
  UPDATE public.insumos
  SET stock_actual = v_stock_nuevo, updated_at = now()
  WHERE id = p_insumo_id;

  -- ── H-4: snapshot de costo, para que ajustes y mermas entren al COGS ──
  v_costo_total := ROUND(v_costo_unit * ABS(p_cantidad), 2);

  INSERT INTO public.movimientos_inventario (
    insumo_id, tipo, cantidad, motivo, usuario_id,
    costo_unitario_historico, costo_total_historico, idempotency_key
  ) VALUES (
    p_insumo_id, p_tipo, p_cantidad,
    COALESCE(NULLIF(TRIM(COALESCE(p_motivo,'')), ''), 'Ajuste manual del socio'),
    v_actor, v_costo_unit, v_costo_total, p_idempotency_key
  ) RETURNING id INTO v_mov_id;

  RETURN json_build_object('success', true, 'recuperado', false,
    'movimiento_id', v_mov_id,
    'insumo', v_nombre,
    'tipo', p_tipo,
    'cantidad', p_cantidad,
    'stock_previo', v_stock_previo,
    'stock_nuevo', v_stock_nuevo,
    'costo_unitario_historico', v_costo_unit,
    'costo_total_historico', v_costo_total,
    'message', format('%s: %s %s %s. Stock: %s -> %s.',
                      v_nombre, p_tipo,
                      CASE WHEN p_cantidad > 0 THEN '+' ELSE '' END || p_cantidad::text,
                      v_unidad, v_stock_previo, v_stock_nuevo));
END;
$function$;

-- ---------------------------------------------------------------
-- 3. Snapshot de costo tambien en la merma del trabajador (H-4)
-- ---------------------------------------------------------------
-- registrar_merma_trabajador ya era atomica y con FOR UPDATE, pero no grababa
-- el costo historico: las mermas del POS quedaban fuera del COGS.
CREATE OR REPLACE FUNCTION public.registrar_merma_trabajador(
  p_insumo_id uuid, p_cantidad numeric, p_motivo text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_stock numeric;
  v_new_stock     numeric;
  v_insumo_activo boolean;
  v_costo_unit    numeric;
BEGIN
  IF NOT public.fn_is_worker() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: usuario no autorizado o inactivo');
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'La cantidad debe ser mayor a cero');
  END IF;

  IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El motivo de la merma es obligatorio');
  END IF;

  SELECT stock_actual, activo, COALESCE(costo_unitario, 0)
  INTO v_current_stock, v_insumo_activo, v_costo_unit
  FROM public.insumos
  WHERE id = p_insumo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Insumo no encontrado');
  END IF;

  IF NOT v_insumo_activo THEN
    RETURN json_build_object('success', false, 'message', 'No se puede registrar merma en un insumo inactivo');
  END IF;

  IF p_cantidad > v_current_stock THEN
    RETURN json_build_object(
      'success', false,
      'message', format('La cantidad de merma (%s) supera el stock disponible (%s)', p_cantidad, v_current_stock)
    );
  END IF;

  v_new_stock := v_current_stock - p_cantidad;

  UPDATE public.insumos
  SET stock_actual = v_new_stock, updated_at = now()
  WHERE id = p_insumo_id;

  -- NUEVO: snapshot de costo, para que la merma entre al COGS
  INSERT INTO public.movimientos_inventario (
    insumo_id, tipo, cantidad, motivo, usuario_id,
    costo_unitario_historico, costo_total_historico
  ) VALUES (
    p_insumo_id, 'MERMA', -p_cantidad, TRIM(p_motivo), auth.uid(),
    v_costo_unit, ROUND(v_costo_unit * p_cantidad, 2)
  );

  RETURN json_build_object(
    'success',        true,
    'nuevo_stock',    v_new_stock,
    'cantidad_merma', p_cantidad,
    'costo_merma',    ROUND(v_costo_unit * p_cantidad, 2),
    'message',        'Merma registrada correctamente'
  );
END;
$function$;

-- ---------------------------------------------------------------
-- 4. Permisos
-- ---------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.ajustar_stock_insumo(uuid, text, numeric, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ajustar_stock_insumo(uuid, text, numeric, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.ajustar_stock_insumo(uuid, text, numeric, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_merma_trabajador(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_merma_trabajador(uuid, numeric, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_merma_trabajador(uuid, numeric, text) TO authenticated, service_role;

COMMIT;
