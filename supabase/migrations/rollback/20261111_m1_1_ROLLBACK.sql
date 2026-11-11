-- ROLLBACK: Restaura fn_estado_resultados a la versión anterior a la corrección de COGS/anulaciones
-- Aplica si necesitas revertir 20261111_m1_1_correccion_cogs_y_egresos_anulacion.sql
-- INSTRUCCIONES: Supabase SQL Editor → pegar completo → RUN

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
  v_ventas_neto           numeric := 0;
  v_num_ventas            integer := 0;
  v_ventas_anuladas       integer := 0;
  v_cogs_snapshot         numeric := 0;
  v_movs_con_snapshot     integer := 0;
  v_movs_sin_snapshot     integer := 0;
  v_cogs_estimado         numeric := 0;
  v_nomina_pagada         numeric := 0;
  v_nomina_pendiente      numeric := 0;
  v_gastos                numeric := 0;
  v_otros_egresos         numeric := 0;
  v_retiros_socios        numeric := 0;
  v_compras_periodo       numeric := 0;
  v_fijos                 numeric := 0;
  v_variables             numeric := 0;
  v_detalle_costos        json;
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
  SELECT COALESCE(SUM(total), 0), COUNT(*) INTO v_ventas_neto, v_num_ventas
  FROM ventas WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADA';
  SELECT COUNT(*) INTO v_ventas_anuladas FROM ventas
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'ANULADA';
  SELECT COALESCE(SUM(mi.costo_total_historico), 0), COUNT(mi.costo_total_historico),
    COUNT(*) - COUNT(mi.costo_total_historico)
  INTO v_cogs_snapshot, v_movs_con_snapshot, v_movs_sin_snapshot
  FROM movimientos_inventario mi
  WHERE mi.tipo = 'VENTA' AND mi.created_at >= p_desde AND mi.created_at <= p_hasta;
  SELECT COALESCE(SUM(ABS(mi.cantidad) * COALESCE(i.costo_unitario, 0)), 0) INTO v_cogs_estimado
  FROM movimientos_inventario mi JOIN insumos i ON i.id = mi.insumo_id
  WHERE mi.tipo = 'VENTA' AND mi.created_at >= p_desde AND mi.created_at <= p_hasta
    AND mi.costo_total_historico IS NULL;
  SELECT COALESCE(SUM(CASE WHEN estado = 'PAGADO' THEN monto_calculado ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN monto_calculado ELSE 0 END), 0)
  INTO v_nomina_pagada, v_nomina_pendiente FROM liquidaciones
  WHERE fecha >= p_desde AND fecha <= p_hasta;
  SELECT COALESCE(SUM(monto), 0) INTO v_gastos FROM gastos
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado <> 'ANULADO';
  SELECT COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') <> 'RETIRO' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') = 'RETIRO' THEN monto ELSE 0 END), 0)
  INTO v_otros_egresos, v_retiros_socios FROM movimientos_caja
  WHERE tipo = 'EGRESO' AND fecha >= p_desde AND fecha <= p_hasta
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL
    AND COALESCE(tipo_operacion,'') <> 'TRANSFERENCIA_INTERNA';
  SELECT COALESCE(SUM(total), 0) INTO v_compras_periodo FROM compras
  WHERE fecha >= p_desde AND fecha <= p_hasta AND estado = 'RECIBIDA';
  WITH vigentes AS (
    SELECT c.id, c.nombre, c.tipo_costo, c.categoria, c.monto, c.periodicidad,
      GREATEST(0, (LEAST(COALESCE(c.fecha_fin,'infinity'::date), p_hasta::date, CURRENT_DATE)
        - GREATEST(c.fecha_inicio, p_desde::date)) + 1)::numeric AS dias_vigentes
    FROM costos_configuracion c WHERE c.activo AND c.tipo_costo IN ('FIJO','VARIABLE')
      AND c.fecha_inicio <= p_hasta::date AND (c.fecha_fin IS NULL OR c.fecha_fin >= p_desde::date)),
  prorrateados AS (
    SELECT v.*, CASE v.periodicidad WHEN 'DIARIO' THEN v.monto * v.dias_vigentes
      WHEN 'SEMANAL' THEN v.monto/7.0*v.dias_vigentes WHEN 'QUINCENAL' THEN v.monto/15.0*v.dias_vigentes
      WHEN 'MENSUAL' THEN v.monto/30.0*v.dias_vigentes WHEN 'ANUAL' THEN v.monto/365.0*v.dias_vigentes
      WHEN 'PERMANENTE' THEN 0 ELSE v.monto/30.0*v.dias_vigentes END AS monto_periodo FROM vigentes v)
  SELECT COALESCE(SUM(CASE WHEN tipo_costo='FIJO' THEN monto_periodo ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN tipo_costo='VARIABLE' THEN monto_periodo ELSE 0 END),0),
    COALESCE(json_agg(json_build_object('nombre',nombre,'tipo',tipo_costo,'categoria',categoria,
      'monto_base',monto,'periodicidad',periodicidad,'dias_vigentes',dias_vigentes,
      'monto_periodo',round(monto_periodo,2)) ORDER BY tipo_costo,nombre),'[]'::json)
  INTO v_fijos, v_variables, v_detalle_costos FROM prorrateados;
  v_utilidad_bruta := v_ventas_neto - v_cogs_snapshot;
  v_total_gastos_op := v_nomina_pagada + v_gastos + v_otros_egresos + v_fijos + v_variables;
  v_resultado := v_utilidad_bruta - v_total_gastos_op;
  RETURN json_build_object('success',true,'desde',p_desde,'hasta',p_hasta,'dias',v_dias,
    'ventas',json_build_object('neto',v_ventas_neto,'num_ventas',v_num_ventas,'num_anuladas',v_ventas_anuladas),
    'cogs',json_build_object('snapshot',v_cogs_snapshot,'estimado',v_cogs_estimado,
      'movs_con_snapshot',v_movs_con_snapshot,'movs_sin_snapshot',v_movs_sin_snapshot,'es_completo',(v_movs_sin_snapshot=0)),
    'nomina',json_build_object('pagada',v_nomina_pagada,'pendiente',v_nomina_pendiente),
    'gastos',v_gastos,'egresos',json_build_object('otros_egresos_caja',v_otros_egresos,'retiros_socios',v_retiros_socios),
    'compras_periodo',v_compras_periodo,
    'costos_configurados',json_build_object('fijos',v_fijos,'variables',v_variables,'detalle',v_detalle_costos),
    'resultados',json_build_object('utilidad_bruta',v_utilidad_bruta,'total_gastos_op',v_total_gastos_op,
      'resultado_neto',v_resultado),'advertencias',v_advertencias);
END;
$function$;

