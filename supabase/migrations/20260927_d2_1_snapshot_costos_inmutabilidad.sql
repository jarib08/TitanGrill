-- =================================================================
-- MIGRACIÓN D2.1 — TITAN GRILL — SNAPSHOT HISTÓRICO DE COSTOS
-- Versión: 20260927
-- Fase: D2.1 — Schema / Migraciones
-- Autor: Auditoría Forense Titan Grill
-- Fecha: 2026-09-27
--
-- HALLAZGOS QUE PREPARA:
--   FC-004 — Ausencia de snapshot histórico de costos
--
-- ALCANCE:
--   - ADD COLUMN costo_unitario_historico NUMERIC(14,4) NULL
--   - ADD COLUMN costo_total_historico    NUMERIC(14,2) NULL
--   - Trigger de inmutabilidad sobre ambas columnas
--   - Índice parcial para consultas COGS futuras
--
-- NO INCLUYE:
--   - Backfill de costos históricos (prohibido por protocolo D2.1)
--   - Constraint motivo='compra'→compra_id (dato inválido pendiente D2.3)
--   - Modificación de registrar_venta / recibir_compra (D2.2)
--   - Corrección de datos de tomate (C2-NEW-001, D2.3)
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_immutable_cost_snapshot ON public.movimientos_inventario;
--   DROP FUNCTION IF EXISTS public.fn_immutable_cost_snapshot();
--   DROP INDEX IF EXISTS idx_movinv_insumo_costo_snap;
--   ALTER TABLE public.movimientos_inventario
--     DROP COLUMN IF EXISTS costo_unitario_historico,
--     DROP COLUMN IF EXISTS costo_total_historico;
--
-- PRECONDICIONES VERIFICADAS PRE-EJECUCIÓN:
--   - movimientos_inventario: 969 registros (ninguno alterado)
--   - ventas: 99 registros, idempotency_key presente en todos
--   - Registro huérfano FC1-NEW-003: id=7c402a48-089b-47ff-9745-ab6f74517332
--     (motivo='compra', compra_id=NULL) → documentado, pendiente D2.3
--   - No existen UPDATE sobre movimientos_inventario en ninguna RPC activa
--   - RLS habilitado: insumos=true, movimientos_inventario=true, ventas=true
-- =================================================================

-- ---------------------------------------------------------------
-- FORWARD MIGRATION
-- ---------------------------------------------------------------

-- PASO 1: Columnas de snapshot (nullable, sin backfill intencional)
ALTER TABLE public.movimientos_inventario
  ADD COLUMN IF NOT EXISTS costo_unitario_historico NUMERIC(14,4) NULL,
  ADD COLUMN IF NOT EXISTS costo_total_historico    NUMERIC(14,2) NULL;

COMMENT ON COLUMN public.movimientos_inventario.costo_unitario_historico
  IS 'FC-004: Costo unitario en el momento exacto del movimiento. NULL para registros históricos anteriores a D2.1. Inmutable tras inserción.';

COMMENT ON COLUMN public.movimientos_inventario.costo_total_historico
  IS 'FC-004: Costo total (cantidad * costo_unitario_historico) en el momento del movimiento. NULL para registros históricos anteriores a D2.1. Inmutable tras inserción.';

-- PASO 2: Función de trigger de inmutabilidad
-- Solo bloquea sobreescritura si el campo YA tenía un valor (no-NULL).
-- Permite: NULL→NULL, NULL→valor (escritura inicial)
-- Bloquea: valor→otro_valor (sobreescritura)
CREATE OR REPLACE FUNCTION public.fn_immutable_cost_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

-- PASO 3: Trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_immutable_cost_snapshot ON public.movimientos_inventario;
CREATE TRIGGER trg_immutable_cost_snapshot
  BEFORE UPDATE ON public.movimientos_inventario
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_immutable_cost_snapshot();

-- PASO 4: Índice parcial para queries COGS por insumo/fecha (solo filas con snapshot)
CREATE INDEX IF NOT EXISTS idx_movinv_insumo_costo_snap
  ON public.movimientos_inventario(insumo_id, created_at)
  WHERE costo_unitario_historico IS NOT NULL;

-- ---------------------------------------------------------------
-- ROLLBACK (documentado — NO ejecutar automáticamente)
-- ---------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_immutable_cost_snapshot ON public.movimientos_inventario;
-- DROP FUNCTION IF EXISTS public.fn_immutable_cost_snapshot();
-- DROP INDEX IF EXISTS idx_movinv_insumo_costo_snap;
-- ALTER TABLE public.movimientos_inventario
--   DROP COLUMN IF EXISTS costo_unitario_historico,
--   DROP COLUMN IF EXISTS costo_total_historico;

-- ---------------------------------------------------------------
-- ESTADO POST-MIGRACIÓN ESPERADO
-- ---------------------------------------------------------------
-- movimientos_inventario.costo_unitario_historico: NUMERIC(14,4) NULL → EXISTS
-- movimientos_inventario.costo_total_historico:    NUMERIC(14,2) NULL → EXISTS
-- trigger trg_immutable_cost_snapshot:             BEFORE UPDATE   → ACTIVO
-- función fn_immutable_cost_snapshot:              plpgsql          → ACTIVA
-- índice idx_movinv_insumo_costo_snap:             btree parcial    → ACTIVO
-- registros históricos (969): costo_*=NULL        → SIN ALTERACIÓN
-- RLS: insumos, movimientos_inventario, ventas     → HABILITADO
-- =================================================================
