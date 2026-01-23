-- ============================================================
-- 🛠️ TITAN GRILL - FIX SISTEMA DE REFERIDOS 🛠️
-- ============================================================
-- Este script soluciona el problema donde el referidor no recibe su premio.
-- Ejecutar TODO este script en el Supabase SQL Editor.
-- ============================================================

-- 1. Asegurar que la tabla stamp_logs tenga la columna 'notes'
ALTER TABLE public.stamp_logs 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 2. Función RPC Estándar (Solo incrementa y registra)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_stamps int;
  updated_row clientes%rowtype;
BEGIN
  -- Verificar existencia del cliente
  SELECT stamps_count INTO current_stamps FROM clientes WHERE id = client_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  -- Actualizar contador de sellos
  UPDATE clientes 
  SET stamps_count = stamps_count + 1 
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  -- Registrar en stamp_logs
  -- IMPORTANTE: Este INSERT es lo que disparará el Trigger de abajo
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
-- 3. Lógica del Bono: Trigger Automático
-- ============================================================

-- Función que se ejecuta CADA VEZ que se inserta un log de sello
CREATE OR REPLACE FUNCTION trigger_check_referral_bonus()
RETURNS TRIGGER AS $$
DECLARE
    v_stamps_count INTEGER;
    v_referred_by UUID;
    v_client_name TEXT;
    v_referrer_name TEXT;
    v_logs_count INTEGER;
BEGIN
    -- Obtener datos del cliente que acaba de recibir el sello
    SELECT stamps_count, referred_by, nombre 
    INTO v_stamps_count, v_referred_by, v_client_name
    FROM public.clientes
    WHERE id = NEW.client_id;

    -- Validar:
    -- 1. Que tenga un referidor (referred_by no sea NULL)
    -- 2. Que no se refiera a sí mismo (por seguridad)
    IF v_referred_by IS NOT NULL AND v_referred_by != NEW.client_id THEN
        
        -- Verificar si es REALMENTE el primer sello.
        -- Opción A: stamps_count es 1 (asumiendo que increment_stamps corrió antes)
        -- Opción B: Es el primer registro en stamp_logs para este usuario
        
        SELECT COUNT(*) INTO v_logs_count 
        FROM public.stamp_logs 
        WHERE client_id = NEW.client_id;

        -- Lógica: Si tiene 1 sello (el que acabamos de poner) Y es su primer registro en logs
        -- (El count será 1 porque este trigger es AFTER INSERT)
        IF v_stamps_count = 1 AND v_logs_count = 1 THEN
            
            -- ¡Es el primer sello! -> Premiar al Referidor
            UPDATE public.clientes
            SET stamps_count = stamps_count + 1
            WHERE id = v_referred_by
            RETURNING nombre INTO v_referrer_name;

            -- Dejar constancia del premio en stamp_logs para el Referidor
            IF FOUND THEN
                INSERT INTO public.stamp_logs (client_id, notes, created_at)
                VALUES (
                    v_referred_by, 
                    'Bono por referido: ' || COALESCE(v_client_name, 'Usuario'), 
                    NOW()
                );
                
                RAISE NOTICE '✅ Bono entregado a % por referir a %', v_referrer_name, v_client_name;
            END IF;
            
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear el Trigger (Eliminando cualquier versión anterior para evitar duplicados)
DROP TRIGGER IF EXISTS trg_check_referral_bonus ON public.stamp_logs;
DROP TRIGGER IF EXISTS auto_referral_bonus ON public.stamp_logs; -- Nombre anterior si existía

CREATE TRIGGER trg_check_referral_bonus
    AFTER INSERT ON public.stamp_logs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_check_referral_bonus();

-- ============================================================
-- ✅ FIN DEL SCRIPT
-- ============================================================
