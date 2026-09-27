-- =====================================================================
-- FASE 1.3 (PARTE B) — CIERRE DE LA FUGA DE DATOS DE CLIENTES
-- Fecha: 2026-09-27
--
-- ############################################################
-- ##  NO APLICAR ANTES DE DESPLEGAR EL FRONTEND NUEVO       ##
-- ############################################################
--
-- Esta migracion QUITA el permiso de lectura publica sobre la tabla clientes.
-- El build actualmente en produccion todavia lee la tabla directamente desde
-- LeadPopup, JoinClubSection y LoyaltyCard. Si se aplica antes del despliegue,
-- la tarjeta de fidelizacion y el registro en la landing dejan de funcionar
-- para clientes reales.
--
-- ORDEN CORRECTO:
--   1. (ya hecho) aplicar 20260927_f1_2_rpcs_clientes_publicos.sql  <- aditivo
--   2. desplegar el frontend que usa las RPCs
--   3. verificar en el sitio real: registro en la landing y tarjeta con sellos
--   4. recien entonces aplicar ESTA migracion
--   5. verificar que un anonimo ya no pueda listar clientes
--
-- HALLAZGO QUE CIERRA (verificado por HTTPS con la anon key real)
--   clientes_select_public: cmd=SELECT roles={public} USING=true
--   Cualquiera con la anon key publicada en el bundle JS descargaba los 27
--   clientes con nombre, celular, email y referral_code.
--   Evidencia: GET /rest/v1/clientes?select=* -> content-range: 0-26/27
--
-- QUE SIGUE FUNCIONANDO DESPUES
--   - Landing publica: via fn_registrar_cliente_publico, fn_cliente_por_celular
--     y fn_cliente_por_id (SECURITY DEFINER, devuelven solo 4 campos).
--   - POS y Admin: la nueva politica exige fn_is_worker(), que cubre a
--     TRABAJADOR y ADMINISTRADOR activos. Verificado: POS.jsx, AdminDashboard
--     y AdminClientView solo leen clientes desde rutas protegidas.
--   - INSERT publico: se conserva. La landing necesita crear leads. Ahora pasa
--     por la RPC, pero la politica de INSERT se deja por compatibilidad.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------
-- 1. Cerrar el SELECT publico
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "clientes_select_public" ON public.clientes;

CREATE POLICY "clientes_select_trabajadores"
  ON public.clientes
  FOR SELECT
  TO authenticated
  USING (public.fn_is_worker());

-- ---------------------------------------------------------------
-- 2. Indice unico sobre celular
-- ---------------------------------------------------------------
-- El indice existente idx_clientes_celular NO es unico, asi que nada impedia
-- dos tarjetas de fidelizacion para el mismo numero. Peor: el manejo de
-- "race condition por unique_violation" del frontend era codigo muerto,
-- porque esa violacion nunca podia ocurrir.
--
-- Verificado antes de aplicar: 0 duplicados, los 27 celulares con exactamente
-- 10 digitos numericos. Por eso el indice se puede crear sin conflicto.
--
-- CONCURRENTLY no se usa a proposito: requiere estar fuera de transaccion y
-- la tabla tiene 27 filas, el lock es instantaneo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_celular_unico
  ON public.clientes (celular);

DROP INDEX IF EXISTS public.idx_clientes_celular;  -- redundante con el unico

COMMIT;
