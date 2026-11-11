-- =====================================================================
-- MIGRACIÓN: CORRECCIÓN COGS VENTAS ANULADAS Y REVERSIONES EN CAJA
-- Fecha: 2026-11-11
--
-- HALLAZGOS RESUELTOS:
-- 1. Exclusión de COGS de ventas ANULADAS mediante JOIN con ventas
-- 2. Exclusión de reversiones de ventas anuladas de "otros_egresos_caja" (venta_id IS NULL)
-- 3. Mantenimiento estricto del contrato JSON que consume AdminDashboard.jsx
-- =====================================================================

BEGIN;

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

  -- ── VENTAS del periodo (excluyendo anuladas) ─────────────────────────
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_ventas_neto, v_num_ventas
  FROM ventas
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADA';

  SELECT COUNT(*) INTO v_ventas_anuladas
  FROM ventas
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'ANULADA';

  -- ── COGS del periodo (CORRECCIÓN 1: Excluye COGS de ventas ANULADAS) ─
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
      'COGS INCOMPLETO: %s de %s movimientos de venta del periodo no tienen snapshot de costo.',
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
      'Hay %s en liquidaciones PENDIENTES en el periodo que no estan restadas del resultado.',
      round(v_nomina_pendiente, 2));
  END IF;

  -- ── GASTOS del periodo ──────────────────────────────────────────────
  SELECT COALESCE(SUM(monto), 0) INTO v_gastos
  FROM gastos
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADO';

  -- ── EGRESOS DE CAJA (CORRECCIÓN 2: Excluye reversiones venta_id IS NULL)
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') <> 'RETIRO' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') =  'RETIRO' THEN monto ELSE 0 END), 0)
  INTO v_otros_egresos, v_retiros_socios
  FROM movimientos_caja
  WHERE tipo = 'EGRESO'
    AND fecha >= p_desde AND fecha <= p_hasta
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL
    AND venta_id IS NULL
    AND COALESCE(tipo_operacion,'') <> 'TRANSFERENCIA_INTERNA';

  -- Reversiones identificadas por separado
  SELECT COALESCE(SUM(monto), 0)
  INTO v_reversiones_anulacion
  FROM movimientos_caja
  WHERE tipo = 'EGRESO'
    AND fecha >= p_desde AND fecha <= p_hasta
    AND venta_id IS NOT NULL
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL;

  IF v_reversiones_anulacion > 0 THEN
    v_advertencias := v_advertencias || format(
      'Hay %s en reversiones de anulacion de venta. Excluidas del calculo operativo para evitar doble deduccion.',
      round(v_reversiones_anulacion, 2));
  END IF;

  IF v_retiros_socios > 0 THEN
    v_advertencias := v_advertencias || format(
      'Se excluyeron %s en retiros de socios: distribucion de utilidades, no gasto operativo.',
      round(v_retiros_socios, 2));
  END IF;

  -- ── COMPRAS del periodo ─────────────────────────────────────────────
  SELECT COALESCE(SUM(total), 0) INTO v_compras_periodo
  FROM compras
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'RECIBIDA';

  -- ── COSTOS FIJOS Y VARIABLES PRORRATEADOS ───────────────────────────
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

  -- ── RESULTADOS ──────────────────────────────────────────────────────
  v_utilidad_bruta  := v_ventas_neto - v_cogs_snapshot;
  v_total_gastos_op := v_nomina_pagada + v_gastos + v_otros_egresos + v_fijos + v_variables;
  v_resultado       := v_utilidad_bruta - v_total_gastos_op;

  v_margen_contrib     := v_utilidad_bruta - v_variables;
  v_margen_contrib_pct := CASE WHEN v_ventas_neto > 0
                               THEN (v_margen_contrib / v_ventas_neto) * 100 ELSE 0 END;
  IF v_margen_contrib_pct > 0 THEN
    v_punto_equilibrio := v_fijos / (v_margen_contrib_pct / 100.0);
  END IF;

  RETURN json_build_object(
    'success', true,
    'periodo', json_build_object('desde', p_desde, 'hasta', p_hasta, 'dias', v_dias),
    'ventas', json_build_object(
      'neto', round(v_ventas_neto, 2),
      'num_ventas', v_num_ventas,
      'num_anuladas', v_ventas_anuladas,
      'ticket_promedio', CASE WHEN v_num_ventas > 0 THEN round(v_ventas_neto / v_num_ventas, 2) ELSE 0 END
    ),
    'cogs', json_build_object(
      'snapshot', round(v_cogs_snapshot, 2),
      'movimientos_con_snapshot', v_movs_con_snapshot,
      'movimientos_sin_snapshot', v_movs_sin_snapshot,
      'estimado_costo_actual', round(v_cogs_estimado, 2),
      'es_completo', (v_movs_sin_snapshot = 0)
    ),
    'egresos', json_build_object(
      'nomina_pagada', round(v_nomina_pagada, 2),
      'nomina_pendiente', round(v_nomina_pendiente, 2),
      'gastos_operativos', round(v_gastos, 2),
      'otros_egresos_caja', round(v_otros_egresos, 2),
      'reversiones_anulacion_venta', round(v_reversiones_anulacion, 2),
      'costos_fijos', round(v_fijos, 2),
      'costos_variables', round(v_variables, 2),
      'total', round(v_total_gastos_op, 2)
    ),
    'fuera_del_resultado', json_build_object(
      'retiros_socios', round(v_retiros_socios, 2),
      'compras_recibidas', round(v_compras_periodo, 2),
      'reversiones_anulacion_venta', round(v_reversiones_anulacion, 2)
    ),
    'resultados', json_build_object(
      'utilidad_bruta', round(v_utilidad_bruta, 2),
      'margen_bruto_pct', CASE WHEN v_ventas_neto > 0 THEN round((v_utilidad_bruta / v_ventas_neto) * 100, 1) ELSE 0 END,
      'margen_contribucion', round(v_margen_contrib, 2),
      'margen_contribucion_pct', round(v_margen_contrib_pct, 1),
      'resultado_operativo', round(v_resultado, 2),
      'punto_equilibrio', round(v_punto_equilibrio, 2),
      'supera_equilibrio', (v_margen_contrib_pct > 0 AND v_ventas_neto >= v_punto_equilibrio),
      'punto_equilibrio_calculable', (v_margen_contrib_pct > 0)
    ),
    'detalle_costos', v_detalle_costos,
    'advertencias', to_json(v_advertencias)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_estado_resultados(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_estado_resultados(timestamptz, timestamptz) FROM anon;
GRANT  EXECUTE ON FUNCTION public.fn_estado_resultados(timestamptz, timestamptz) TO authenticated, service_role;

COMMIT;
