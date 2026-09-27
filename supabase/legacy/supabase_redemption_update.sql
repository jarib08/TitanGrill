-- 🚨 TITAN GRILL ADVANCED FEATURES SCRIPT 🚨
-- Run this in Supabase SQL Editor to enable Charts & Redemptions

-- 1. Create table for tracking stamp history (Charts)
CREATE TABLE IF NOT EXISTS public.stamp_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 2. Create table for tracking redemptions
CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  stamps_exchanged int NOT NULL,
  redeemed_at timestamptz DEFAULT now()
);

-- Enable RLS for security
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to view all logs/redemptions
CREATE POLICY "Admins can view stamp_logs" ON public.stamp_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can view redemptions" ON public.redemptions FOR SELECT USING (auth.role() = 'authenticated');


-- 3. UPDATE 'increment_stamps' to log history
CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stamps int;
  updated_row public.clientes%rowtype;
BEGIN
  -- Check if client exists
  SELECT stamps_count INTO current_stamps FROM public.clientes WHERE id = client_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  -- Increment Stamp
  UPDATE public.clientes 
  SET stamps_count = stamps_count + 1 
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  -- 🆕 LOGGING THE STAMP
  INSERT INTO public.stamp_logs (client_id) VALUES (client_id);

  RETURN json_build_object(
    'success', true, 
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;


-- 4. NEW FUNCTION: Redeem Reward
-- Resets stamps but keeps surplus (e.g., 11 -> 1)
CREATE OR REPLACE FUNCTION redeem_reward(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stamps int;
  new_stamps int;
  surplus int;
BEGIN
  -- Get current stamps
  SELECT stamps_count INTO current_stamps FROM public.clientes WHERE id = client_id;
  
  IF current_stamps < 10 THEN
     RETURN json_build_object('success', false, 'message', 'No tiene suficientes sellos (Mínimo 10)');
  END IF;

  -- Calculate surplus (Ex: 12 stamps. new = 12 - 10 = 2)
  surplus := current_stamps - 10;
  new_stamps := surplus;

  -- Update Client
  UPDATE public.clientes
  SET stamps_count = new_stamps
  WHERE id = client_id;

  -- Log Redemption
  INSERT INTO public.redemptions (client_id, stamps_exchanged) 
  VALUES (client_id, 10);

  RETURN json_build_object(
    'success', true, 
    'message', 'Premio canjeado con éxito',
    'new_count', new_stamps
  );
END;
$$;
