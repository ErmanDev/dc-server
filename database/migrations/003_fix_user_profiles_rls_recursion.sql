-- Fix infinite recursion in user_profiles RLS policies
-- This migration creates a helper function that bypasses RLS to safely get user roles

-- Function to safely get user role without RLS recursion
-- Uses SECURITY DEFINER to bypass RLS policies
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'viewer');
END;
$$;

-- Update the RLS policies to use the helper function instead of direct queries
-- This prevents infinite recursion

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.user_profiles;

-- Recreate admin policies using the helper function
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    public.get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles
  FOR UPDATE
  USING (
    public.get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'admin'
  );

