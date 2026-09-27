-- =====================================================================
-- FASE 2.1 — MOTOR CONTABLE: ESTADO DE RESULTADOS COHERENTE
-- Fecha: 2026-09-27
--
-- HALLAZGO A1 (CRITICO) QUE CIERRA
--   El Estado de Resultados del AdminDashboard mezclaba periodos distintos
--   en la misma resta:
--     - Ventas: FILTRADAS por el rango de fechas elegido.
--     - COGS: HISTORICO COMPLETO, sin filtro de fecha.
--     - Nomina, gastos y otros egresos: HISTORICO COMPLETO.
--     - Costos fijos/variables: normalizados a MES.
--   Resultado: al elegir "Hoy", el RESULTADO OPERATIVO NETO restaba el COGS,
--   la nomina y los gastos de TODA la historia a las ventas de un solo dia.
--   El Punto de Equilibrio sufria lo mismo.
--
-- OTROS ERRORES CONTABLES QUE CORRIGE
--   A5  Los retiros de socios (tipo_operacion='RETIRO') se restaban como
--       gasto operativo. Un retiro es distribucion de utilidades, no un
--       gasto: no va en el Estado de Resultados. Se reporta aparte.
--   A6  costos_configuracion.fecha_inicio y fecha_fin se ignoraban por
--       completo: un costo fijo vencido seguia contando. Ahora se prorratea
--       por los dias en que el costo estuvo realmente vigente dentro del
--       periodo consultado.
--   A7  El multiplicador de precios y el impuesto (tipo_costo MULTIPLICADOR
--       e IMPUESTO) se mezclaban con los costos fijos/variables. Se excluyen
--       del Estado de Resultados: son configuracion de pricing.
--   A3  Todos los agregados se calculan en SQL. El frontend ya no baja miles
--       de filas para sumarlas en JavaScript, donde PostgREST las truncaba
--       en silencio a 1000.
--
-- HONESTIDAD SOBRE EL COGS (hallazgo verificado en auditoria)
--   Las 896 filas de movimientos_inventario con tipo='VENTA' tienen
--   costo_total_historico en NULL: la RPC registrar_venta si graba el
--   snapshot (verificado en vivo), pero ninguna venta ha pasado por esa ruta
--   desde que se implemento. Por eso el COGS real disponible hoy es 0.
--
--   Esta funcion NO inventa el COGS faltante. Devuelve:
--     - cogs_snapshot: la suma real de costo_total_historico (auditable).
--     - movimientos_sin_snapshot: cuantos movimientos no tienen costo.
--     - cogs_estimado: estimacion usando insumos.costo_unitario ACTUAL,
--       marcada explicitamente como estimacion.
--     - cogs_es_completo: false si falta algun snapshot.
--   La UI debe mostrar la advertencia y nunca presentar la estimacion como
--   dato real. Un COGS de 0 es un dato faltante, no una utilidad alta.
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
  SELECT
    COALESCE(SUM(mi.costo_total_historico), 0),
    COUNT(mi.costo_total_historico),
    COUNT(*) - COUNT(mi.costo_total_historico)
  INTO v_cogs_snapshot, v_movs_con_snapshot, v_movs_sin_snapshot
  FROM movimientos_inventario mi
  WHERE mi.tipo = 'VENTA'
    AND mi.created_at >= p_desde AND mi.created_at <= p_hasta;

  -- Estimacion SOLO para los movimientos sin snapshot, con costo actual.
  -- Se reporta aparte y marcada como estimacion; nunca se suma al real.
  SELECT COALESCE(SUM(ABS(mi.cantidad) * COALESCE(i.costo_unitario, 0)), 0)
  INTO v_cogs_estimado
  FROM movimientos_inventario mi
  JOIN insumos i ON i.id = mi.insumo_id
  WHERE mi.tipo = 'VENTA'
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
  -- Se excluyen los ya contados via compras/gastos/liquidaciones y las
  -- transferencias internas (mover plata entre metodos no es un egreso).
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') <> 'RETIRO' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN COALESCE(tipo_operacion,'') =  'RETIRO' THEN monto ELSE 0 END), 0)
  INTO v_otros_egresos, v_retiros_socios
  FROM movimientos_caja
  WHERE tipo = 'EGRESO'
    AND fecha >= p_desde AND fecha <= p_hasta
    AND compra_id IS NULL AND gasto_id IS NULL AND liquidacion_id IS NULL
    AND COALESCE(tipo_operacion,'') <> 'TRANSFERENCIA_INTERNA';

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
  -- Cada costo aporta solo por los dias en que estuvo vigente dentro del
  -- rango. Antes se mostraba el monto mensual completo contra ventas de
  -- cualquier periodo, y fecha_inicio/fecha_fin se ignoraban.
  WITH vigentes AS (
    SELECT
      c.id, c.nombre, c.tipo_costo, c.categoria, c.monto, c.periodicidad,
      -- El tope en CURRENT_DATE es deliberado: un costo con fecha_fin NULL
      -- sigue vigente, pero NO se puede devengar hacia el futuro. Sin este
      -- tope, consultar un rango que termina en 2030 acumulaba anos de
      -- alquiler que todavia no han ocurrido (verificado: daba $48.499.980).
      GREATEST(0,
        (LEAST(COALESCE(c.fecha_fin, 'infinity'::date), p_hasta::date, CURRENT_DATE)
         - GREATEST(c.fecha_inicio, p_desde::date)) + 1
      )::numeric AS dias_vigentes
    FROM costos_configuracion c
    WHERE c.activo
      AND c.tipo_costo IN ('FIJO','VARIABLE')          -- excluye MULTIPLICADOR e IMPUESTO
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
        WHEN 'PERMANENTE' THEN 0               -- costo unico, no recurrente
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
  -- El sistema permite registrar el sueldo de un trabajador como costo
  -- FIJO/VARIABLE de categoria PERSONAL y ADEMAS pagarle por liquidaciones.
  -- En ese caso el mismo trabajo se resta dos veces del resultado.
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

  v_margen_contrib     := v_utilidad_bruta - v_variables;
  v_margen_contrib_pct := CASE WHEN v_ventas_neto > 0
                               THEN (v_margen_contrib / v_ventas_neto) * 100 ELSE 0 END;
  IF v_margen_contrib_pct > 0 THEN
    v_punto_equilibrio := v_fijos / (v_margen_contrib_pct / 100.0);
  END IF;

  IF v_ventas_neto = 0 THEN
    v_advertencias := v_advertencias || 'No hay ventas en el periodo seleccionado: los margenes y el punto de equilibrio no son calculables.'::text;
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
      'costos_fijos', round(v_fijos, 2),
      'costos_variables', round(v_variables, 2),
      'total', round(v_total_gastos_op, 2)
    ),
    'fuera_del_resultado', json_build_object(
      'retiros_socios', round(v_retiros_socios, 2),
      'compras_recibidas', round(v_compras_periodo, 2)
    ),
    'resultados', json_build_object(
      'utilidad_bruta', round(v_utilidad_bruta, 2),
      'margen_bruto_pct', CASE WHEN v_ventas_neto > 0 THEN round((v_utilidad_bruta / v_ventas_neto) * 100, 1) ELSE 0 END,
      'margen_contribucion', round(v_margen_contrib, 2),
      'margen_contribucion_pct', round(v_margen_contrib_pct, 1),
      'resultado_operativo', round(v_resultado, 2),
      'punto_equilibrio', round(v_punto_equilibrio, 2),
      -- Con costos fijos en 0 el punto de equilibrio es 0: se supera de forma
    -- trivial. La condicion anterior exigia PE>0 y devolvia false en ese caso.
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
