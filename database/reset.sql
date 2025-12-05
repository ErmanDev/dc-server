-- Reset script for DC Cakes database
-- This will clear all user data and reset the database to a clean state
-- WARNING: This will delete ALL users and orders!

-- ============================================================================
-- STEP 1: Disable triggers temporarily to avoid issues
-- ============================================================================

-- Disable the trigger that creates profiles automatically
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- ============================================================================
-- STEP 2: Delete all data from tables (in correct order due to foreign keys)
-- ============================================================================

-- Delete all orders first (they reference users)
DELETE FROM public.orders;

-- Delete all user profiles (they reference auth.users)
DELETE FROM public.user_profiles;

-- ============================================================================
-- STEP 3: Delete all auth users
-- ============================================================================

-- Note: In Supabase, you need to delete users through the Admin API or Dashboard
-- This SQL will delete from auth.users directly (requires service role)
-- If you get permission errors, use Supabase Dashboard > Authentication > Users > Delete

-- Delete all auth users (this will cascade delete profiles due to ON DELETE CASCADE)
-- WARNING: This requires service role permissions
DELETE FROM auth.users;

-- ============================================================================
-- STEP 4: Re-enable triggers
-- ============================================================================

ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- ============================================================================
-- STEP 5: Verify reset
-- ============================================================================

-- Check that tables are empty
SELECT 'user_profiles count:' as info, COUNT(*) as count FROM public.user_profiles
UNION ALL
SELECT 'orders count:', COUNT(*) FROM public.orders
UNION ALL
SELECT 'auth.users count:', COUNT(*) FROM auth.users;

-- ============================================================================
-- DONE! Database is now reset
-- ============================================================================
-- Next steps:
-- 1. Register a new admin using POST /api/auth/register-admin
-- 2. Login using POST /api/auth/login with username and password

