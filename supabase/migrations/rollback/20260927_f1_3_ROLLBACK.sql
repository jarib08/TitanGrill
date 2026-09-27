-- Rollback de la PARTE B. ADVERTENCIA: reabre la fuga de datos de clientes.
-- Usar solo si el frontend nuevo falla y hay que volver al build anterior.
BEGIN;
DROP POLICY IF EXISTS "clientes_select_trabajadores" ON public.clientes;
CREATE POLICY "clientes_select_public" ON public.clientes FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_clientes_celular ON public.clientes (celular);
DROP INDEX IF EXISTS public.idx_clientes_celular_unico;
COMMIT;
