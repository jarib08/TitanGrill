-- 🚨 SECURITY HARDENING SCRIPT FOR TITAN GRILL 🚨
-- Run this entire script in your Supabase SQL Editor.

-- 1. Enable RLS on the main table (if not already enabled)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 2. Drop insecure "allow all" policies if they exist
DROP POLICY IF EXISTS "Enable read access for all users" ON public.clientes;
DROP POLICY IF EXISTS "Enable update for all users" ON public.clientes;
DROP POLICY IF EXISTS "Enable insert for everyone" ON public.clientes;
DROP POLICY IF EXISTS "Allow public read" ON public.clientes;
DROP POLICY IF EXISTS "Allow public update" ON public.clientes;

-- 3. Create STRICT policies

-- A. PUBLIC INSERT: Allow anyone to create a lead (Landing Page Popup)
CREATE POLICY "Allow public insert" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);

-- B. ADMIN SELECT: Only authenticated users can view clients
CREATE POLICY "Allow authenticated read" 
ON public.clientes 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- C. ADMIN UPDATE: Only authenticated users can update clients DIRECTLY
CREATE POLICY "Allow authenticated update" 
ON public.clientes 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- 4. SECURE FUNCTION for Stamp Incrementing
-- This function runs with "SECURITY DEFINER" (Superuser privileges)
-- It allows the server to increment stamps without giving the frontend direct UPDATE access.

CREATE OR REPLACE FUNCTION increment_stamps(client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- 👈 CRITICAL: Bypasses RLS
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

  RETURN json_build_object(
    'success', true, 
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;

-- 5. Ensure admin_users permissions
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read own admin status" 
ON public.admin_users 
FOR SELECT 
USING (auth.uid() = id);

