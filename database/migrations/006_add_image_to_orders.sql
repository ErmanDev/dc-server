-- Add image column to orders table
-- This column stores an optional image URL or path for order images

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS image TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.orders.image IS 'Optional image URL or path for the order';

