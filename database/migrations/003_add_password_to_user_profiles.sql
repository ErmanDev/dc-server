-- Migration: Add password_hash column to user_profiles table
-- 
-- IMPORTANT SECURITY NOTE:
-- Supabase Auth already stores passwords (hashed with bcrypt) in auth.users table.
-- This column is optional and should only be used if you need to store an additional
-- password hash for custom authentication or migration purposes.
-- 
-- If you're using Supabase Auth (recommended), you don't need this column.
-- Passwords are automatically hashed and stored securely in auth.users.

-- Add password_hash column (nullable, since existing users won't have it)
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.user_profiles.password_hash IS 
  'Optional password hash. Supabase Auth already stores passwords (hashed with bcrypt) in auth.users. This column is for custom authentication or migration purposes only.';

-- Note: We don't add an index on password_hash since it's not used for lookups
-- (passwords are verified, not searched)

