# Database Migrations

This directory contains SQL migration files for setting up the DC Cakes database schema in Supabase.

## Setup Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (in the left sidebar)
4. Click **New query**
5. Open `database/setup.sql` and copy the entire contents
6. Paste the SQL into the editor
7. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**To view your tables after setup:**
- Click **Table Editor** in the left sidebar
- You should see `user_profiles` and `orders` tables
- See `HOW_TO_VIEW_TABLES.md` for detailed instructions

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Migration Files

### 001_create_user_profiles.sql
Creates the `user_profiles` table that extends Supabase's built-in `auth.users` table.

**Features:**
- Stores username and role (viewer/admin)
- Automatically creates profile when user signs up
- Row Level Security (RLS) policies:
  - Users can view/update their own profile
  - Admins can view/update all profiles
  - Service role has full access

### 002_create_orders_table.sql
Creates the `orders` table for managing cake orders.

**Features:**
- Stores order details (customer, order info, location, dates, etc.)
- Tracks order status (incoming, accepted, declined, pending, completed)
- Automatically sets `completed_at` when status changes to 'completed'
- Row Level Security (RLS) policies:
  - Authenticated users (viewers and admins) can view all orders
  - Only admins can create, update, or delete orders
  - Service role has full access

### 003_add_password_to_user_profiles.sql
Adds `password_hash` column to the `user_profiles` table.

**Important Notes:**
- Supabase Auth already stores passwords (hashed with bcrypt) in `auth.users` table
- This column is optional and should only be used for custom authentication or migration purposes
- If you're using Supabase Auth (recommended), you don't need this column
- The column is nullable to support existing users

## Important Notes

1. **Run migrations in order**: Execute `001_create_user_profiles.sql` before `002_create_orders_table.sql`

2. **RLS Policies**: Row Level Security is enabled on all tables. Make sure your application uses proper authentication tokens when making requests.

3. **Service Role Key**: For server-side operations that need to bypass RLS, use the service role key (keep it secret, never expose it to the client).

4. **Testing**: After running migrations, test the connection using:
   ```bash
   GET http://localhost:3000/api/test-supabase
   ```

## Verifying Setup

After running the migrations, you can verify the setup:

1. Check tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('user_profiles', 'orders');
   ```

2. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename IN ('user_profiles', 'orders');
   ```

3. Test user profile creation (after creating a user via Supabase Auth):
   ```sql
   SELECT * FROM public.user_profiles;
   ```

