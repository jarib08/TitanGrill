-- ============================================================
-- 🔥 TITAN GRILL - SISTEMA DE REFERIDOS 🔥
-- ============================================================
-- Este script agrega funcionalidad completa de referidos
-- Ejecutar en Supabase SQL Editor

-- ============================================================
-- PARTE 1: Agregar Columnas a la Tabla clientes
-- ============================================================

-- Columna para el código de referido único (8 caracteres)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Columna para rastrear quién refirió a este cliente
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ============================================================
-- PARTE 2: Función para Generar Códigos de Referido
-- ============================================================

-- Función que genera un código de 8 caracteres basado en el UUID
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Usa los primeros 8 caracteres del UUID (sin guiones)
  NEW.referral_code := UPPER(SUBSTRING(REPLACE(NEW.id::TEXT, '-', ''), 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar código automáticamente al insertar
DROP TRIGGER IF EXISTS set_referral_code ON public.clientes;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- ============================================================
-- PARTE 3: Generar Códigos para Clientes Existentes
-- ============================================================

-- Actualizar clientes que no tienen código de referido
UPDATE public.clientes
SET referral_code = UPPER(SUBSTRING(REPLACE(id::TEXT, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- ============================================================
-- PARTE 4: Constraint para Prevenir Auto-Referencia
-- ============================================================

ALTER TABLE public.clientes
DROP CONSTRAINT IF EXISTS check_no_self_referral;

ALTER TABLE public.clientes
ADD CONSTRAINT check_no_self_referral 
CHECK (referred_by IS NULL OR referred_by != id);

-- ============================================================
-- PARTE 5: Función RPC para Obtener Cliente por Código
-- ============================================================

CREATE OR REPLACE FUNCTION get_client_by_referral_code(ref_code TEXT)
RETURNS TABLE(client_id UUID, client_name TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT id, nombre
  FROM public.clientes
  WHERE UPPER(referral_code) = UPPER(ref_code)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_client_by_referral_code(TEXT) TO anon, authenticated;

-- ============================================================
-- PARTE 6: Mejorar increment_stamps para Bonos de Referido
-- ============================================================

CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stamps int;
  last_stamp timestamptz;
  updated_row public.clientes%rowtype;
  referrer_id uuid;
  referrer_name text;
  was_first_stamp boolean := false;
BEGIN
  -- Verificar si el cliente existe y obtener datos actuales
  SELECT stamps_count, last_stamp_at, referred_by
  INTO current_stamps, last_stamp, referrer_id
  FROM public.clientes 
  WHERE id = client_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  -- Rate limiting: Prevenir más de un sello por minuto
  IF last_stamp IS NOT NULL AND (now() - last_stamp) < INTERVAL '1 minute' THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Debes esperar antes de registrar otro sello',
      'retry_in_seconds', EXTRACT(EPOCH FROM (last_stamp + INTERVAL '1 minute' - now()))::int
    );
  END IF;

  -- Detectar si es el primer sello (0 -> 1)
  IF current_stamps = 0 THEN
    was_first_stamp := true;
  END IF;

  -- Incrementar sello y actualizar timestamp
  UPDATE public.clientes 
  SET stamps_count = stamps_count + 1,
      last_stamp_at = now()
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  -- Registrar el sello en stamp_logs
  INSERT INTO public.stamp_logs (client_id) VALUES (client_id);

  -- 🎁 BONUS DE REFERIDO: Si es el primer sello Y tiene referrer
  IF was_first_stamp AND referrer_id IS NOT NULL THEN
    -- Otorgar 1 sello bonus al referidor
    UPDATE public.clientes
    SET stamps_count = stamps_count + 1
    WHERE id = referrer_id
    RETURNING nombre INTO referrer_name;

    -- Registrar el bonus en stamp_logs con metadatos
    INSERT INTO public.stamp_logs (client_id, created_at, notes)
    VALUES (
      referrer_id, 
      now(),
      json_build_object(
        'type', 'referral_bonus',
        'from_client_id', client_id,
        'from_client_name', updated_row.nombre
      )::text
    );

    RAISE NOTICE 'Bonus de referido otorgado a % (ID: %)', referrer_name, referrer_id;
  END IF;

  RETURN json_build_object(
    'success', true, 
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10),
    'referral_bonus_awarded', (was_first_stamp AND referrer_id IS NOT NULL)
  );
END;
$$;

-- Asegurar permisos
GRANT EXECUTE ON FUNCTION increment_stamps(uuid) TO authenticated;

-- ============================================================
-- PARTE 7: Agregar Columna de Notas a stamp_logs (Opcional)
-- ============================================================

-- Para poder rastrear los bonos de referido
ALTER TABLE public.stamp_logs
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- Script Completado ✅
-- ============================================================
-- Resumen de Cambios:
-- 1. ✅ Agregadas columnas referral_code y referred_by a clientes
-- 2. ✅ Trigger para generar códigos automáticamente
-- 3. ✅ Códigos asignados a clientes existentes
-- 4. ✅ Constraint para prevenir auto-referencia
-- 5. ✅ Función RPC para validar códigos desde frontend
-- 6. ✅ increment_stamps mejorada con lógica de bonus
-- 7. ✅ Columna notes en stamp_logs para rastrear bonos
