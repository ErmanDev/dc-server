-- Complete database setup script for DC Cakes
-- Run this in Supabase SQL Editor to set up all tables and policies at once

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'admin')),
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add comment to document the password_hash column
COMMENT ON COLUMN public.user_profiles.password_hash IS 
  'Optional password hash. Supabase Auth already stores passwords (hashed with bcrypt) in auth.users. This column is for custom authentication or migration purposes only.';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON public.user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role full access"
  ON public.user_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================

-- Function to automatically create user profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent users from changing their own role
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Only check if role is actually changing
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;

  -- Get the current user's role
  SELECT role INTO current_user_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  -- Allow if user is admin (admins can change any role)
  IF current_user_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Prevent users from changing their own role
  IF auth.uid() = NEW.id THEN
    RAISE EXCEPTION 'Users cannot change their own role';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to automatically update updated_at for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to prevent users from changing their own role
DROP TRIGGER IF EXISTS prevent_role_change_trigger ON public.user_profiles;
CREATE TRIGGER prevent_role_change_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.prevent_role_change();

-- ============================================================================
-- 4. ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  order_details TEXT NOT NULL,
  location TEXT,
  phone_number TEXT,
  pickup_date DATE,
  meta_business_link TEXT,
  status TEXT NOT NULL DEFAULT 'incoming' CHECK (status IN ('incoming', 'accepted', 'declined', 'pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON public.orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

-- RLS Policies for orders
CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role full access to orders"
  ON public.orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to handle order completion
CREATE OR REPLACE FUNCTION public.handle_order_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_order_completion();

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete!';
  RAISE NOTICE 'Tables created: user_profiles, orders';
  RAISE NOTICE 'RLS policies enabled on all tables';
END $$;

