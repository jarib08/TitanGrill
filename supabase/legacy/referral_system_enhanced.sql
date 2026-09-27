-- ============================================================
-- 🔥 TITAN GRILL - SISTEMA DE REFERIDOS MEJORADO 🔥
-- ============================================================
-- Script SQL completo para implementar el sistema de referidos
-- con bonus automático al primer sello del referido
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PARTE 1: Verificar y Crear Columnas en tabla clientes
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

-- Función que genera un código de 8 caracteres alfanuméricos
-- Excluye caracteres confusos: 0, O, 1, I, l
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Sin 0, O, 1, I
  result TEXT := '';
  i INTEGER;
  random_index INTEGER;
BEGIN
  -- Generar código de 8 caracteres aleatorios
  FOR i IN 1..8 LOOP
    random_index := floor(random() * length(chars) + 1)::int;
    result := result || substr(chars, random_index, 1);
  END LOOP;
  
  -- Verificar que sea único, si no, regenerar
  WHILE EXISTS (SELECT 1 FROM public.clientes WHERE referral_code = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      random_index := floor(random() * length(chars) + 1)::int;
      result := result || substr(chars, random_index, 1);
    END LOOP;
  END LOOP;
  
  NEW.referral_code := result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar código automáticamente al insertar
DROP TRIGGER IF EXISTS set_referral_code ON public.clientes;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code();

-- ============================================================
-- PARTE 3: Generar Códigos para Clientes Existentes
-- ============================================================

-- Actualizar clientes que no tienen código de referido
DO $$
DECLARE
  client_record RECORD;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code TEXT;
  i INTEGER;
  random_index INTEGER;
BEGIN
  FOR client_record IN 
    SELECT id FROM public.clientes WHERE referral_code IS NULL
  LOOP
    -- Generar código único
    LOOP
      new_code := '';
      FOR i IN 1..8 LOOP
        random_index := floor(random() * length(chars) + 1)::int;
        new_code := new_code || substr(chars, random_index, 1);
      END LOOP;
      
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clientes WHERE referral_code = new_code);
    END LOOP;
    
    UPDATE public.clientes SET referral_code = new_code WHERE id = client_record.id;
  END LOOP;
END $$;

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
-- PARTE 6: Función para Procesar Bonus de Referido
-- ============================================================

CREATE OR REPLACE FUNCTION process_referral_bonus(new_client_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_id UUID;
  referrer_name TEXT;
  referred_name TEXT;
  first_stamp_count INTEGER;
  bonus_awarded BOOLEAN := false;
BEGIN
  -- Obtener información del cliente referido
  SELECT referred_by, nombre
  INTO referrer_id, referred_name
  FROM public.clientes
  WHERE id = new_client_id;
  
  -- Si no fue referido por nadie, salir
  IF referrer_id IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'bonus_awarded', false,
      'message', 'Cliente no fue referido'
    );
  END IF;
  
  -- Validar que no sea auto-referencia
  IF referrer_id = new_client_id THEN
    RETURN json_build_object(
      'success', false,
      'bonus_awarded', false,
      'message', 'Auto-referencia no permitida'
    );
  END IF;
  
  -- Contar cuántos sellos tiene el referido en stamp_logs
  SELECT COUNT(*)
  INTO first_stamp_count
  FROM public.stamp_logs
  WHERE client_id = new_client_id;
  
  -- Solo otorgar bonus si es el PRIMER sello
  IF first_stamp_count = 1 THEN
    -- Otorgar +1 sello al referidor
    UPDATE public.clientes
    SET stamps_count = stamps_count + 1
    WHERE id = referrer_id
    RETURNING nombre INTO referrer_name;
    
    -- Registrar el bonus en stamp_logs
    INSERT INTO public.stamp_logs (client_id, notes)
    VALUES (
      referrer_id,
      'Bono por referido: ' || referred_name
    );
    
    bonus_awarded := true;
    
    RAISE NOTICE '🎁 Bonus de referido otorgado a % (ID: %)', referrer_name, referrer_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'bonus_awarded', bonus_awarded,
    'referrer_id', referrer_id,
    'referrer_name', referrer_name,
    'message', CASE 
      WHEN bonus_awarded THEN 'Bonus otorgado exitosamente'
      ELSE 'No es el primer sello, bonus no aplicable'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_referral_bonus(UUID) TO authenticated;

-- ============================================================
-- PARTE 7: Trigger para Ejecutar Bonus Automáticamente
-- ============================================================

-- Función trigger que se ejecuta después de insertar en stamp_logs
CREATE OR REPLACE FUNCTION trigger_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
  bonus_result json;
BEGIN
  -- Ejecutar la función de bonus
  SELECT process_referral_bonus(NEW.client_id) INTO bonus_result;
  
  RAISE NOTICE 'Resultado del bonus: %', bonus_result;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS auto_referral_bonus ON public.stamp_logs;
CREATE TRIGGER auto_referral_bonus
  AFTER INSERT ON public.stamp_logs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_referral_bonus();

-- ============================================================
-- PARTE 8: Agregar Columna de Notas a stamp_logs
-- ============================================================

ALTER TABLE public.stamp_logs
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- PARTE 9: Función de Utilidad para Validar Código
-- ============================================================

CREATE OR REPLACE FUNCTION validate_referral_code(code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validar formato: 8 caracteres alfanuméricos
  IF code IS NULL OR length(code) != 8 THEN
    RETURN false;
  END IF;
  
  -- Validar que solo contenga caracteres permitidos
  IF code !~ '^[A-Z2-9]+$' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================================
-- PARTE 10: ACTUALIZACIÓN CRÍTICA - Función increment_stamps
-- ============================================================
-- Esta actualización es necesaria para que el trigger funcione.
-- Modificamos la función para que registre el evento en stamp_logs.

CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
BEGIN
  -- Verificar existencia del cliente
  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  -- 1. Actualizar contador de sellos
  UPDATE clientes 
  SET stamps_count = stamps_count + 1 
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  -- 2. Registrar en stamp_logs (ESTO DISPARA EL TRIGGER DE REFERIDOS)
  INSERT INTO public.stamp_logs (client_id, notes)
  VALUES (client_id, 'Sello escaneado por admin');

  RETURN json_build_object(
    'success', true,
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;

-- ============================================================
-- Script Completado ✅
-- ============================================================
-- Resumen de Cambios:
-- 1. ✅ Columnas referral_code y referred_by verificadas/creadas
-- 2. ✅ Generador de códigos únicos (8 chars, sin caracteres confusos)
-- 3. ✅ Códigos asignados a clientes existentes
-- 4. ✅ Constraint de auto-referencia
-- 5. ✅ RPC get_client_by_referral_code para validación
-- 6. ✅ RPC process_referral_bonus para otorgar bonus
-- 7. ✅ Trigger automático al insertar sello
-- 8. ✅ Columna notes en stamp_logs
-- 9. ✅ Función de validación de formato
-- 10. ✅ Función increment_stamps actualizada para logging
-- ============================================================
