# Supabase Connection Setup Guide

## Step 1: Get Your Supabase Credentials

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (this is your `SUPABASE_URL`)
   - **anon/public key** (this is your `SUPABASE_ANON_KEY`)
   - **service_role key** (this is your `SUPABASE_SERVICE_ROLE_KEY` - optional but recommended)

## Step 2: Create .env File

Create a `.env` file in the `dccakes-server` directory with the following content:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

**Important:** 
- Replace `your-project-id`, `your_anon_key_here`, and `your_service_role_key_here` with your actual values
- Never commit the `.env` file to git (it's already in `.gitignore`)

## Step 3: Install Dependencies

```bash
pnpm install
```

## Step 4: Test the Connection

Start the development server:

```bash
pnpm dev
```

The server will automatically test the Supabase connection on startup. You should see:
- ✅ `Supabase connected successfully!` if everything is working
- ⚠️ A warning if there's an issue

## Step 5: Verify Connection via API

Once the server is running, you can test the connection:

1. **Health Check:**
   ```
   GET http://localhost:3000/health
   ```

2. **Test Supabase Connection:**
   ```
   GET http://localhost:3000/api/test-supabase
   ```

3. **Get Supabase Status:**
   ```
   GET http://localhost:3000/api/supabase/status
   ```

## Troubleshooting

### Error: "Missing Supabase environment variables"
- Make sure your `.env` file exists in the `dccakes-server` directory
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Restart the server after creating/updating the `.env` file

### Error: "Failed to connect to Supabase"
- Verify your `SUPABASE_URL` is correct (should start with `https://`)
- Check that your `SUPABASE_ANON_KEY` is the correct anon/public key
- Ensure your Supabase project is active and not paused

### Connection works but getting errors
- Check your Supabase project dashboard for any issues
- Verify Row Level Security (RLS) policies if you're getting permission errors
- Make sure your database tables exist if you're querying specific tables

