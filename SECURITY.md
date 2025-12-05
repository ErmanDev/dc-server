# Security & Password Hashing

## Password Storage

**Important:** Passwords are automatically hashed by Supabase Auth. We never store passwords in plain text.

### How It Works

1. **Registration (`POST /api/auth/register`)**:
   - User provides email and password
   - Password is sent to Supabase Auth
   - Supabase hashes the password using **bcrypt** (industry-standard hashing algorithm)
   - Only the **hashed password** is stored in the `auth.users` table
   - The plain password is never stored anywhere

2. **Login (`POST /api/auth/login`)**:
   - User provides email and password
   - Supabase hashes the provided password
   - Compares it with the stored hash in `auth.users`
   - If they match, authentication succeeds

### Database Structure

- **`auth.users`** (Supabase managed):
  - Contains the hashed password (bcrypt hash)
  - Never accessible directly - managed by Supabase
  - Password field is encrypted/hashed

- **`public.user_profiles`** (Our custom table):
  - Contains username, role, timestamps
  - **NO password field** - passwords are never stored here
  - Links to `auth.users` via UUID

### Security Features

✅ **Automatic Password Hashing**: Supabase uses bcrypt with salt  
✅ **No Plain Text Storage**: Passwords are never stored in readable format  
✅ **Secure Comparison**: Password verification happens server-side  
✅ **JWT Tokens**: Authentication uses secure JWT tokens, not passwords  
✅ **Password Validation**: Minimum 6 characters required  

### Password Requirements

- Minimum length: 6 characters
- No maximum length (Supabase handles this)
- Can contain letters, numbers, and special characters

### Best Practices

1. **Never log passwords**: Passwords are never logged or stored in logs
2. **Use HTTPS**: Always use HTTPS in production to encrypt data in transit
3. **Token-based auth**: After login, use JWT tokens, not passwords
4. **Password reset**: Use Supabase's built-in password reset functionality
5. **Rate limiting**: Consider adding rate limiting to prevent brute force attacks

### Viewing Users in Supabase

When you view users in Supabase Dashboard:
- Go to **Authentication** → **Users**
- You'll see user emails and metadata
- **Passwords are NOT visible** (they're hashed)
- The password field shows as encrypted/hashed

### Verification

To verify passwords are hashed:

1. Register a user via API
2. Go to Supabase Dashboard → **Authentication** → **Users**
3. Find the user you just created
4. Notice the password is not visible (it's stored as a hash)

### Technical Details

- **Hashing Algorithm**: bcrypt
- **Salt Rounds**: Managed by Supabase (typically 10-12 rounds)
- **Storage Location**: `auth.users.encrypted_password` (Supabase internal)
- **Access**: Only Supabase Auth service can access/verify passwords

### API Security

All authentication endpoints:
- Accept passwords in request body (over HTTPS)
- Immediately pass to Supabase Auth (never store)
- Return JWT tokens for subsequent requests
- Never return passwords in responses

---

**Summary**: Your passwords are secure! Supabase handles all password hashing automatically. You don't need to implement any hashing logic - it's all done for you.

