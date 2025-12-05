# How to View Tables in Supabase

After running the database migrations, you can view your tables in the Supabase dashboard.

## Step 1: Run the Database Setup

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy the entire contents of `database/setup.sql` and paste it into the editor
6. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

You should see a success message: `✅ Database setup complete!`

## Step 2: View Tables in Table Editor

1. In the Supabase dashboard, click on **Table Editor** in the left sidebar
2. You should now see two tables:
   - **`user_profiles`** - User profiles with username and role
   - **`orders`** - Cake orders table

## Step 3: View Table Structure

### Option A: Using Table Editor
1. Click on a table name (e.g., `user_profiles`)
2. You'll see:
   - **Columns** - All the fields in the table
   - **Data** - The actual data (empty initially)
   - **Relations** - Foreign key relationships

### Option B: Using SQL Editor
Run this query to see all tables:

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'orders')
ORDER BY table_name, ordinal_position;
```

## Step 4: Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('user_profiles', 'orders');
```

You should see both tables listed.

## Step 5: Check RLS Policies

To see the Row Level Security policies:

1. Go to **Authentication** → **Policies** in the left sidebar
2. Or run this SQL query:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('user_profiles', 'orders')
ORDER BY tablename, policyname;
```

## Step 6: View Table Data

### View user_profiles:
```sql
SELECT * FROM public.user_profiles;
```

### View orders:
```sql
SELECT * FROM public.orders;
```

## Quick Navigation in Supabase Dashboard

- **Table Editor** - View and edit table data
- **SQL Editor** - Run SQL queries
- **Database** → **Tables** - See all tables and their structure
- **Authentication** → **Policies** - View RLS policies
- **Database** → **Functions** - View database functions

## Troubleshooting

### Tables not showing up?
1. Make sure you ran the `setup.sql` script successfully
2. Check for any error messages in the SQL Editor
3. Refresh the Table Editor page
4. Verify you're looking at the correct project

### Can't see data?
- Tables will be empty until you:
  - Register users (which creates entries in `user_profiles`)
  - Create orders via the API

### Permission errors?
- Make sure RLS policies are set up correctly
- Check that you're using the correct authentication token

## Next Steps

1. **Test user registration** - Create a user via the API to see data in `user_profiles`
2. **Create test orders** - Use the API to create orders and see them in the `orders` table
3. **Explore relationships** - Check how `orders.created_by` links to `user_profiles.id`

