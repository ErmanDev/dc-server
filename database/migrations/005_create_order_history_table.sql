-- Create order_history table to track order events over time

CREATE TABLE IF NOT EXISTS public.order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('status_change', 'note', 'view', 'manual')),
  old_status TEXT,
  new_status TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON public.order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON public.order_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_event_type ON public.order_history(event_type);

-- RLS Policies

-- Authenticated users can view history entries (viewers & admins)
CREATE POLICY "Authenticated users can view order history"
  ON public.order_history
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can insert history entries
CREATE POLICY "Admins can insert order history"
  ON public.order_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete history entries
CREATE POLICY "Admins can delete order history"
  ON public.order_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access for server-side operations
CREATE POLICY "Service role full access to order history"
  ON public.order_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


