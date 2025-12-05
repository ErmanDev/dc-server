# Database Reset Guide

This guide will help you reset the DC Cakes database to start fresh.

## ⚠️ WARNING
**This will delete ALL users, orders, and data from the database!**

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Delete All Users
1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Select all users and click **Delete**
4. Confirm deletion

### Step 2: Delete All Orders
1. Go to **Table Editor** → **orders**
2. Select all rows and delete them
3. Or run this SQL in the SQL Editor:
   ```sql
   DELETE FROM public.orders;
   ```

### Step 3: Delete All User Profiles
1. Go to **Table Editor** → **user_profiles**
2. Select all rows and delete them
3. Or run this SQL in the SQL Editor:
   ```sql
   DELETE FROM public.user_profiles;
   ```

## Method 2: Using SQL Script

### Step 1: Run Reset Script
1. Open Supabase Dashboard → **SQL Editor**
2. Copy and paste the contents of `database/reset.sql`
3. Click **Run**
4. If you get permission errors, delete users through the Dashboard first

## Method 3: Manual SQL Commands

Run these commands in Supabase SQL Editor (in order):

```sql
-- 1. Delete orders
DELETE FROM public.orders;

-- 2. Delete user profiles
DELETE FROM public.user_profiles;

-- 3. Delete auth users (if you have service role access)
-- Otherwise, delete through Dashboard > Authentication > Users
DELETE FROM auth.users;
```

## After Reset

### 1. Register a New Admin

**Endpoint:** `POST http://127.0.0.1:3000/api/auth/register-admin`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123",
  "username": "admin"
}
```

**Expected Response:**
```json
{
  "message": "Admin registered successfully",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "admin",
    "role": "admin"
  }
}
```

### 2. Login as Admin

**Endpoint:** `POST http://127.0.0.1:3000/api/auth/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "username": "admin",
    "role": "admin"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": 1234567890
  }
}
```

## Troubleshooting

### Issue: Can't delete users via SQL
**Solution:** Use Supabase Dashboard → Authentication → Users to delete users manually.

### Issue: Foreign key constraint errors
**Solution:** Delete in this order:
1. Orders
2. User profiles
3. Auth users

### Issue: RLS policy errors
**Solution:** The reset script uses service role, but if you're using anon key, delete through Dashboard instead.

## Verification

After reset, verify the database is empty:

```sql
SELECT 
  (SELECT COUNT(*) FROM public.user_profiles) as profiles,
  (SELECT COUNT(*) FROM public.orders) as orders,
  (SELECT COUNT(*) FROM auth.users) as auth_users;
```

All counts should be 0.

