# Quick Start Guide

## 1. Set Up Supabase Database

### Step 1: Run the SQL Setup
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New query**
5. Open `database/setup.sql` from this project
6. Copy and paste the entire SQL script
7. Click **Run** (green button or `Ctrl+Enter`)

### Step 2: Verify Tables Were Created
1. Click **Table Editor** (left sidebar)
2. You should see two tables:
   - ✅ `user_profiles`
   - ✅ `orders`

If you don't see them, refresh the page or check the SQL Editor for any errors.

### Step 3: View Table Structure
1. In **Table Editor**, click on a table name
2. You'll see:
   - All columns and their types
   - Any existing data (tables start empty)
   - Relationships between tables

## 2. Configure Environment Variables

Create a `.env` file in `dccakes-server/`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=3000
NODE_ENV=development
```

**Where to find these values:**
1. Go to Supabase Dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## 3. Install Dependencies

```bash
cd dccakes-server
pnpm install
```

## 4. Start the Server

```bash
pnpm dev
```

You should see:
```
🚀 DC Cakes Server running on http://localhost:3000
✅ Supabase connected successfully!
```

## 5. Test the API

### Test Connection
```bash
curl http://localhost:3000/health
```

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "test123456",
    "username": "admin",
    "role": "admin"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "test123456"
  }'
```

Save the `access_token` from the response for authenticated requests.

## 6. View Data in Supabase

After registering a user or creating orders:

1. Go to Supabase Dashboard → **Table Editor**
2. Click on `user_profiles` to see registered users
3. Click on `orders` to see orders (after creating some via API)

## Troubleshooting

### Tables not showing?
- Make sure you ran `setup.sql` successfully
- Check SQL Editor for error messages
- Refresh the Table Editor page

### Connection errors?
- Verify `.env` file has correct Supabase credentials
- Check that Supabase project is active (not paused)
- Ensure you copied the full URL and keys

### API errors?
- Make sure the server is running (`pnpm dev`)
- Check that database migrations ran successfully
- Verify your Supabase credentials in `.env`

## Next Steps

- Read [API.md](./API.md) for complete API documentation
- See [HOW_TO_VIEW_TABLES.md](./database/HOW_TO_VIEW_TABLES.md) for detailed table viewing guide
- Check [README.md](./README.md) for project overview

