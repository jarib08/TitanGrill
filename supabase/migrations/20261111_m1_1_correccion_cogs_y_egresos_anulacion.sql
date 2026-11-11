-- =====================================================================
-- CORRECCIÓN: Ventas Anuladas no deben inflar COGS ni Egresos
-- Aplica al motor contable fn_estado_resultados
--
-- Problemas corregidos:
--   1. COGS incluía movimientos tipo='VENTA' de ventas ANULADAS
--   2. Los egresos de reversión de anulación se contaban como
--      "otros egresos operativos" porque venta_id IS NOT NULL pero
--      compra_id/gasto_id/liquidacion_id son NULL.
--
-- Solución mínima invasiva:
--   1. COGS filtra JOIN ventas WHERE v.estado <> 'ANULADA'
--   2. Otros egresos excluye venta_id IS NOT NULL (reversiones de venta)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_estado_resultados(
  p_desde timestamptz,
  p_hasta timestamptz
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dias                  numeric;
  -- Ventas
  v_ventas_neto           numeric := 0;
  v_num_ventas            integer := 0;
  v_ventas_anuladas       integer := 0;
  -- COGS
  v_cogs_snapshot         numeric := 0;
  v_movs_con_snapshot     integer := 0;
  v_movs_sin_snapshot     integer := 0;
  v_cogs_estimado         numeric := 0;
  -- Egresos
  v_nomina_pagada         numeric := 0;
  v_nomina_pendiente      numeric := 0;
  v_gastos                numeric := 0;
  v_otros_egresos         numeric := 0;
  v_retiros_socios        numeric := 0;
  v_reversiones_anulacion numeric := 0;
  v_compras_periodo       numeric := 0;
  -- Costos configurados
  v_fijos                 numeric := 0;
  v_variables             numeric := 0;
  v_detalle_costos        json;
  -- Resultados
  v_utilidad_bruta        numeric;
  v_total_gastos_op       numeric;
  v_resultado             numeric;
  v_margen_contrib        numeric;
  v_margen_contrib_pct    numeric;
  v_punto_equilibrio      numeric := 0;
  v_advertencias          text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.fn_is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Acceso denegado: se requiere rol Administrador');
  END IF;

  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta <= p_desde THEN
    RETURN json_build_object('success', false, 'message', 'Rango de fechas invalido.');
  END IF;

  v_dias := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_hasta - p_desde)) / 86400.0));

  -- ── VENTAS del periodo ──────────────────────────────────────────────
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_ventas_neto, v_num_ventas
  FROM ventas
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADA';

  SELECT COUNT(*) INTO v_ventas_anuladas
  FROM ventas
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'ANULADA';

  -- ── COGS del periodo, desde el snapshot inmutable ───────────────────
  -- CORRECCIÓN 1: JOIN con ventas para excluir movimientos de ventas ANULADAS.
  -- Sin este JOIN, el COGS incluía el costo de insumos de ventas que
  -- nunca se cobraron, sobreestimando el costo y subestimando la utilidad.
  SELECT
    COALESCE(SUM(mi.costo_total_historico), 0),
    COUNT(mi.costo_total_historico),
    COUNT(*) - COUNT(mi.costo_total_historico)
  INTO v_cogs_snapshot, v_movs_con_snapshot, v_movs_sin_snapshot
  FROM movimientos_inventario mi
  JOIN ventas v ON v.id = mi.venta_id
  WHERE mi.tipo = 'VENTA'
    AND v.estado <> 'ANULADA'
    AND mi.created_at >= p_desde AND mi.created_at <= p_hasta;

  -- Estimacion SOLO para los movimientos sin snapshot, con costo actual.
  SELECT COALESCE(SUM(ABS(mi.cantidad) * COALESCE(i.costo_unitario, 0)), 0)
  INTO v_cogs_estimado
  FROM movimientos_inventario mi
  JOIN insumos i ON i.id = mi.insumo_id
  JOIN ventas v ON v.id = mi.venta_id
  WHERE mi.tipo = 'VENTA'
    AND v.estado <> 'ANULADA'
    AND mi.created_at >= p_desde AND mi.created_at <= p_hasta
    AND mi.costo_total_historico IS NULL;

  IF v_movs_sin_snapshot > 0 THEN
    v_advertencias := v_advertencias || format(
      'COGS INCOMPLETO: %s de %s movimientos de venta del periodo no tienen snapshot de costo (son anteriores a la implementacion del snapshot). El costo real de esas ventas no es reconstruible. La utilidad mostrada esta SOBREESTIMADA.',
      v_movs_sin_snapshot, v_movs_sin_snapshot + v_movs_con_snapshot);
  END IF;

  -- ── NOMINA del periodo ──────────────────────────────────────────────
  SELECT COALESCE(SUM(CASE WHEN estado = 'PAGADO'    THEN monto_calculado ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto_calculado ELSE 0 END), 0)
  INTO v_nomina_pagada, v_nomina_pendiente
  FROM liquidaciones
  WHERE fecha >= p_desde AND fecha <= p_hasta;

  IF v_nomina_pendiente > 0 THEN
    v_advertencias := v_advertencias || format(
      'Hay %s en liquidaciones PENDIENTES en el periodo que no estan restadas del resultado (solo se cuenta lo PAGADO).',
      round(v_nomina_pendiente, 2));
  END IF;

  -- ── GASTOS del periodo ──────────────────────────────────────────────
  SELECT COALESCE(SUM(monto), 0) INTO v_gastos
  FROM gastos
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADO';

  -- ── EGRESOS DE CAJA del periodo, separando lo que NO es gasto ───────
  -- CORRECCIÓN 2: Excluir venta_id IS NOT NULL.
  -- Las reversiones de anulación de venta tienen venta_id asociado pero
  -- compra_id/gasto_id/liquidacion_id = NULL, por lo que antes caían
  -- en v_otros_egresos y se restaban de la utilidad como si fueran gastos
  -- operativos reales. Ahora se aíslan en v_reversiones_anulacion.
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') <> 'RETIRO' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') =  'RETIRO' THEN monto ELSE 0 END), 0)
  INTO v_otros_egresos, v_retiros_socios
  FROM movimientos_caja
  WHERE tipo = 'EGRESO'
    AND fecha >= p_desde AND fecha <= p_hasta
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL
    AND venta_id IS NULL   -- ← CORRECCIÓN: excluye reversiones de anulación de venta
    AND COALESCE(tipo_operacion,'') <> 'TRANSFERENCIA_INTERNA';

  -- Capturar reversiones de anulación para reportarlas informativamente
  SELECT COALESCE(SUM(monto), 0)
  INTO v_reversiones_anulacion
  FROM movimientos_caja
  WHERE tipo = 'EGRESO'
    AND fecha >= p_desde AND fecha <= p_hasta
    AND venta_id IS NOT NULL
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL;

  IF v_reversiones_anulacion > 0 THEN
    v_advertencias := v_advertencias || format(
      'Hay %s en reversiones de anulacion de venta en el periodo. Estas NO se restan de la utilidad (son compensaciones de ventas que ya estan excluidas de los ingresos).',
      round(v_reversiones_anulacion, 2));
  END IF;

  IF v_retiros_socios > 0 THEN
    v_advertencias := v_advertencias || format(
      'Se excluyeron %s en retiros de socios: un retiro es distribucion de utilidades, no un gasto operativo. Se reporta aparte.',
      round(v_retiros_socios, 2));
  END IF;

  -- ── COMPRAS del periodo (informativo: son inventario, no gasto) ─────
  SELECT COALESCE(SUM(total), 0) INTO v_compras_periodo
  FROM compras
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'RECIBIDA';

  -- ── COSTOS FIJOS Y VARIABLES, PRORRATEADOS AL PERIODO ───────────────
  WITH vigentes AS (
    SELECT
      c.id, c.nombre, c.tipo_costo, c.categoria, c.monto, c.periodicidad,
      GREATEST(0,
        (LEAST(COALESCE(c.fecha_fin, 'infinity'::date), p_hasta::date, CURRENT_DATE)
         - GREATEST(c.fecha_inicio, p_desde::date)) + 1
      )::numeric AS dias_vigentes
    FROM costos_configuracion c
    WHERE c.activo
      AND c.tipo_costo IN ('FIJO','VARIABLE')
      AND c.fecha_inicio <= p_hasta::date
      AND (c.fecha_fin IS NULL OR c.fecha_fin >= p_desde::date)
  ),
  prorrateados AS (
    SELECT v.*,
      CASE v.periodicidad
        WHEN 'DIARIO'     THEN v.monto * v.dias_vigentes
        WHEN 'SEMANAL'    THEN v.monto / 7.0   * v.dias_vigentes
        WHEN 'QUINCENAL'  THEN v.monto / 15.0  * v.dias_vigentes
        WHEN 'MENSUAL'    THEN v.monto / 30.0  * v.dias_vigentes
        WHEN 'ANUAL'      THEN v.monto / 365.0 * v.dias_vigentes
        WHEN 'PERMANENTE' THEN 0
        ELSE v.monto / 30.0 * v.dias_vigentes
      END AS monto_periodo
    FROM vigentes v
  )
  SELECT
    COALESCE(SUM(CASE WHEN tipo_costo='FIJO'     THEN monto_periodo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_costo='VARIABLE' THEN monto_periodo ELSE 0 END), 0),
    COALESCE(json_agg(json_build_object(
      'nombre', nombre, 'tipo', tipo_costo, 'categoria', categoria,
      'monto_base', monto, 'periodicidad', periodicidad,
      'dias_vigentes', dias_vigentes, 'monto_periodo', round(monto_periodo, 2)
    ) ORDER BY tipo_costo, nombre), '[]'::json)
  INTO v_fijos, v_variables, v_detalle_costos
  FROM prorrateados;

  -- ── ALERTA DE DOBLE CONTEO DE NOMINA ───────────────────────────────
  IF v_nomina_pagada > 0 AND EXISTS (
       SELECT 1 FROM costos_configuracion c
       WHERE c.activo AND c.categoria = 'PERSONAL'
         AND c.tipo_costo IN ('FIJO','VARIABLE')
         AND c.fecha_inicio <= p_hasta::date
         AND (c.fecha_fin IS NULL OR c.fecha_fin >= p_desde::date)
     ) THEN
    v_advertencias := v_advertencias ||
      'POSIBLE DOBLE CONTEO DE NOMINA: hay costos activos de categoria PERSONAL y tambien liquidaciones PAGADAS en este periodo. Si son la misma persona, su sueldo se esta restando dos veces. Use una sola de las dos vias.'::text;
  END IF;

  -- ── RESULTADOS ──────────────────────────────────────────────────────
  v_utilidad_bruta  := v_ventas_neto - v_cogs_snapshot;
  v_total_gastos_op := v_nomina_pagada + v_gastos + v_otros_egresos + v_fijos + v_variables;
  v_resultado       := v_utilidad_bruta - v_total_gastos_op;

  IF v_ventas_neto > 0 THEN
    v_margen_contrib     := v_ventas_neto - v_cogs_snapshot - v_variables;
    v_margen_contrib_pct := ROUND(v_margen_contrib / v_ventas_neto * 100, 2);
    IF (v_margen_contrib_pct > 0) THEN
      v_punto_equilibrio := ROUND(
        (v_nomina_pagada + v_gastos + v_otros_egresos + v_fijos) / (v_margen_contrib_pct / 100.0),
        2);
    END IF;
  END IF;

  RETURN json_build_object(
    'success',              true,
    'desde',                p_desde,
    'hasta',                p_hasta,
    'dias',                 v_dias,
    'ventas', json_build_object(
      'neto',               v_ventas_neto,
      'num_ventas',         v_num_ventas,
      'num_anuladas',       v_ventas_anuladas
    ),
    'cogs', json_build_object(
      'snapshot',           v_cogs_snapshot,
      'estimado',           v_cogs_estimado,
      'movs_con_snapshot',  v_movs_con_snapshot,
      'movs_sin_snapshot',  v_movs_sin_snapshot,
      'es_completo',        (v_movs_sin_snapshot = 0)
    ),
    'nomina', json_build_object(
      'pagada',             v_nomina_pagada,
      'pendiente',          v_nomina_pendiente
    ),
    'gastos',               v_gastos,
    'egresos', json_build_object(
      'otros_egresos_caja', v_otros_egresos,
      'reversiones_anulacion_venta', v_reversiones_anulacion,
      'retiros_socios',     v_retiros_socios
    ),
    'compras_periodo',      v_compras_periodo,
    'costos_configurados', json_build_object(
      'fijos',              v_fijos,
      'variables',          v_variables,
      'detalle',            v_detalle_costos
    ),
    'resultados', json_build_object(
      'utilidad_bruta',     v_utilidad_bruta,
      'total_gastos_op',    v_total_gastos_op,
      'resultado_neto',     v_resultado,
      'margen_contrib',     v_margen_contrib,
      'margen_contrib_pct', v_margen_contrib_pct,
      'punto_equilibrio',   v_punto_equilibrio
    ),
    'advertencias',         v_advertencias
  );
END;
$function$;

