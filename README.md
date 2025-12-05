# DC Cakes Server

Server application for DC Cakes with Supabase integration.

## Quick Start

**New to this project?** Start with [QUICK_START.md](./QUICK_START.md) for step-by-step setup instructions.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up Supabase database:
   - Go to your Supabase project dashboard
   - Navigate to **SQL Editor**
   - Open `database/setup.sql` and run it (or run the individual migration files in order)
   - **To view tables**: Click **Table Editor** in Supabase dashboard after running setup
   - See `database/HOW_TO_VIEW_TABLES.md` for detailed instructions
   - See `database/migrations/README.md` for migration details

3. Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PORT=3000
NODE_ENV=development
```

4. Run the development server:
```bash
pnpm dev
```

5. Build for production:
```bash
pnpm build
pnpm start
```

## Database Schema

The database includes the following tables:

- **user_profiles** - Extends Supabase auth.users with username and role (viewer/admin)
- **orders** - Stores cake orders with customer details, status, and pickup information

See `database/migrations/` for the complete schema and RLS policies.

## API Documentation

See [API.md](./API.md) for complete API documentation with all endpoints, request/response examples, and usage instructions.

### Quick Reference

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (auth required)
- `PUT /api/auth/profile` - Update profile (auth required)

**Orders:**
- `GET /api/orders` - Get all orders (auth required)
- `GET /api/orders/:id` - Get order by ID (auth required)
- `POST /api/orders` - Create order (admin required)
- `PUT /api/orders/:id` - Update order (admin required)
- `DELETE /api/orders/:id` - Delete order (admin required)
- `GET /api/orders/stats/summary` - Get order statistics (auth required)

**System:**
- `GET /health` - Health check
- `GET /api/test-supabase` - Test Supabase connection
- `GET /api/supabase/status` - Get Supabase status

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (optional, for admin operations)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Security

Passwords are automatically hashed by Supabase Auth using bcrypt. See [SECURITY.md](./SECURITY.md) for detailed information about password security and authentication.

## Project Structure

```
dccakes-server/
├── src/
│   ├── config/
│   │   └── supabase.ts      # Supabase client configuration
│   ├── types/
│   │   └── database.ts      # Database type definitions
│   ├── routes/              # API route handlers
│   └── index.ts             # Main server file
├── database/
│   ├── migrations/          # Individual migration files
│   ├── setup.sql            # Complete setup script
│   └── README.md            # Database setup instructions
└── package.json
```

