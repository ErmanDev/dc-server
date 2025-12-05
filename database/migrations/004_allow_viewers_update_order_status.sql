-- Allow viewers to update order status
-- This policy allows viewers to update only the status field of orders

-- Policy: Viewers can update order status
CREATE POLICY "Viewers can update order status"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'viewer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'viewer'
    )
  );

