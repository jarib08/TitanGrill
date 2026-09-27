-- Rollback de la PARTE A: solo elimina funciones nuevas. Sin efecto en datos.
DROP FUNCTION IF EXISTS public.fn_cliente_por_celular(text);
DROP FUNCTION IF EXISTS public.fn_cliente_por_id(uuid);
DROP FUNCTION IF EXISTS public.fn_registrar_cliente_publico(text, text, text, uuid);
