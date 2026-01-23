-- 🔐 ENHANCED SECURITY SCRIPT FOR TITAN GRILL 🔐
-- Run this script in Supabase SQL Editor to apply enhanced security measures
-- This script addresses vulnerabilities found in the security audit

-- ============================================================
-- PART 1: Strengthen RLS on stamp_logs and redemptions tables
-- ============================================================

-- Ensure RLS is enabled (redundant but safe)
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- Drop potentially insecure INSERT policies
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.stamp_logs;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.redemptions;

-- Prevent direct INSERT - force use of RPC functions only
-- Only SELECT is allowed for admins
CREATE POLICY "Admins read-only stamp_logs" 
ON public.stamp_logs 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins read-only redemptions" 
ON public.redemptions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Note: INSERT/UPDATE/DELETE are blocked for everyone except via SECURITY DEFINER functions

-- ============================================================
-- PART 2: Add rate limiting metadata to prevent abuse
-- ============================================================

-- Add column to track last stamp time (prevents rapid-fire stamping)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS last_stamp_at timestamptz;

-- ============================================================
-- PART 3: Enhanced increment_stamps with rate limiting
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
BEGIN
  -- Check if client exists and get current data
  SELECT stamps_count, last_stamp_at 
  INTO current_stamps, last_stamp 
  FROM public.clientes 
  WHERE id = client_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

  -- Rate limiting: Prevent stamping more than once per minute
  IF last_stamp IS NOT NULL AND (now() - last_stamp) < INTERVAL '1 minute' THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Debes esperar antes de registrar otro sello',
      'retry_in_seconds', EXTRACT(EPOCH FROM (last_stamp + INTERVAL '1 minute' - now()))::int
    );
  END IF;

  -- Increment Stamp and update last stamp time
  UPDATE public.clientes 
  SET stamps_count = stamps_count + 1,
      last_stamp_at = now()
  WHERE id = client_id 
  RETURNING * INTO updated_row;

  -- Log the stamp
  INSERT INTO public.stamp_logs (client_id) VALUES (client_id);

  RETURN json_build_object(
    'success', true, 
    'new_count', updated_row.stamps_count,
    'is_reward_ready', (updated_row.stamps_count >= 10)
  );
END;
$$;

-- ============================================================
-- PART 4: Enhanced redeem_reward with validation
-- ============================================================

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
  -- Get current stamps with row lock to prevent race conditions
  SELECT stamps_count INTO current_stamps 
  FROM public.clientes 
  WHERE id = client_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Cliente no encontrado');
  END IF;

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

-- ============================================================
-- PART 5: Grant execute permissions on functions
-- ============================================================

GRANT EXECUTE ON FUNCTION increment_stamps(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid) TO authenticated;

-- ============================================================
-- PART 6: Create audit log for admin actions (optional but recommended)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_client_id uuid REFERENCES public.clientes(id),
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log" 
ON public.admin_audit_log 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- ============================================================
-- Script Complete
-- ============================================================
-- Summary of Changes:
-- 1. ✅ Locked down stamp_logs and redemptions to read-only via RLS
-- 2. ✅ Added rate limiting to increment_stamps (1 minute cooldown)
-- 3. ✅ Added row locking to redeem_reward to prevent race conditions
-- 4. ✅ Created admin audit log table for compliance
-- 5. ✅ Granted proper permissions to authenticated users
