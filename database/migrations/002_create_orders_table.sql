-- Create orders table for DC Cakes orders

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

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON public.orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders(created_by);

-- RLS Policies

-- Policy: Viewers and Admins can view all orders
CREATE POLICY "Authenticated users can view orders"
  ON public.orders
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Admins can insert orders
CREATE POLICY "Admins can insert orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can update orders
CREATE POLICY "Admins can update orders"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON public.orders
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access to orders"
  ON public.orders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to set completed_at when status changes to 'completed'
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

-- Trigger to handle order completion
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.handle_order_completion();

