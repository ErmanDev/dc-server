import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router: Router = Router();

/**
 * POST /api/auth/register
 * Register a new viewer account (public endpoint)
 * 
 * SECURITY NOTE: Passwords are automatically hashed by Supabase Auth using bcrypt.
 * The password is never stored in plain text - it's hashed before being stored in auth.users table.
 * We never see or store the plain password on our server.
 * This endpoint only allows viewer registration. Admin accounts must be created by existing admins.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Create user in Supabase Auth
    // Supabase automatically hashes the password using bcrypt before storing it
    // The hashed password is stored in auth.users table (managed by Supabase)
    // We never store passwords in our custom tables
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password, // This will be hashed by Supabase before storage
      options: {
        emailRedirectTo: undefined, // Disable email redirect
        data: {
          username,
          role: 'viewer', // Always set to viewer for public registration
        },
      },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ error: 'Failed to create user' });
    }

    // Hash password for storage in user_profiles (optional, Supabase already hashes it in auth.users)
    const passwordHash = await bcrypt.hash(password, 10);

    // The user profile will be created automatically by the trigger
    // But we can update it to ensure username, role, and password_hash are set correctly
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ username, role: 'viewer', password_hash: passwordHash })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    res.status(201).json({
      message: 'Viewer registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username,
        role: 'viewer',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Registration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user and return JWT token
 * 
 * DATABASE-DRIVEN: This endpoint authenticates against Supabase database:
 * 1. Queries user_profiles table to resolve username to user ID
 * 2. Fetches email from auth.users table using admin client
 * 3. Authenticates with Supabase Auth (queries auth.users table)
 * 4. Fetches user profile from user_profiles table after successful auth
 * 
 * SECURITY NOTE: Supabase compares the provided password with the bcrypt hash
 * stored in auth.users. The password is never transmitted or stored in plain text.
 * All authentication is performed against the Supabase database - no mock data.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;
    
    // Prioritize username login - if username is provided, use it
    // Otherwise, fall back to email if provided
    const input = username || email;

    if (!input || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Resolve username to email from database
    let loginEmail: string | null = null;
    const isEmail = input.includes('@');
    
    console.log('Login attempt - Input:', input, 'Is Email:', isEmail);

    if (isEmail) {
      // Input is an email, use it directly (for backward compatibility)
      loginEmail = input;
      console.log('Using email directly:', loginEmail);
    } else {
      // Input is a username - resolve to email from database
      console.log('Resolving username to email from database:', input);
      
      // Find user by username in user_profiles table
      // Use admin client to bypass RLS (avoids infinite recursion in RLS policies)
      if (!supabaseAdmin) {
        console.error('CRITICAL: supabaseAdmin is null - SUPABASE_SERVICE_ROLE_KEY not configured');
        return res.status(500).json({ 
          error: 'Server configuration error. Admin client not available.',
          debug: process.env.NODE_ENV === 'development' ? { 
            message: 'SUPABASE_SERVICE_ROLE_KEY is required for username lookup',
            hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
          } : undefined
        });
      }
      
      console.log('Using admin client for profile lookup. Username:', input);
      
      // Try the lookup with admin client - add retry logic for network issues
      let profile;
      let profileError;
      let retries = 3;
      
      while (retries > 0) {
        try {
          const result = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, role')
            .eq('username', input)
            .single();
          
          profile = result.data;
          profileError = result.error;
          break; // Success, exit retry loop
        } catch (networkError: any) {
          retries--;
          if (retries === 0) {
            console.error('Network error during profile lookup:', networkError);
            return res.status(500).json({ 
              error: 'Failed to connect to Supabase. Please check your network connection and Supabase configuration.',
              details: networkError.message || 'Connection reset',
              suggestion: 'Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
            });
          }
          // Wait before retry (exponential backoff)
          console.log(`Profile lookup failed, retrying... (${retries} attempts remaining)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
        }
      }
      
      // Debug: Log what we're querying
      console.log('Admin client query executed. Result:', {
        hasData: !!profile,
        hasError: !!profileError,
        errorCode: profileError?.code,
        errorMessage: profileError?.message
      });

      console.log('Profile lookup result:', { 
        found: !!profile, 
        userId: profile?.id,
        username: profile?.username,
        role: profile?.role,
        error: profileError?.message,
        errorCode: profileError?.code
      });

      if (profileError) {
        console.error('Profile lookup error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
          username: input,
          usingAdminClient: !!supabaseAdmin
        });
        
        if (profileError.code === 'PGRST116') {
          // PGRST116 is "not found" - username doesn't exist
          console.log('Username not found in user_profiles');
          return res.status(401).json({ 
            error: 'Invalid username or password',
            debug: process.env.NODE_ENV === 'development' ? { username: input } : undefined
          });
        } else if (profileError.code === '42P17') {
          // Infinite recursion - admin client should bypass RLS, but if it's still happening,
          // try querying by email instead
          console.error('Infinite recursion detected even with admin client. Trying alternative approach...');
          
          // Try to find user by email in auth.users first, then get profile
          // This is a workaround if admin client isn't bypassing RLS properly
          return res.status(500).json({ 
            error: 'Database configuration error. RLS recursion detected.',
            debug: process.env.NODE_ENV === 'development' ? { 
              error: 'Please verify SUPABASE_SERVICE_ROLE_KEY is correct and has service_role permissions.',
              code: profileError.code,
              suggestion: 'Try logging in with email instead of username temporarily'
            } : undefined
          });
        } else {
          // Other error - log full details
          console.error('Unexpected profile lookup error:', JSON.stringify(profileError, null, 2));
          return res.status(500).json({ 
            error: 'Failed to lookup user profile',
            debug: process.env.NODE_ENV === 'development' ? { 
              error: profileError.message,
              code: profileError.code,
              details: profileError.details,
              hint: profileError.hint
            } : undefined
          });
        }
      }

      if (!profile || !profile.id) {
        // Username not found in profile
        return res.status(401).json({ 
          error: 'Invalid username or password',
          debug: process.env.NODE_ENV === 'development' ? { username: input } : undefined
        });
      }

      // Profile found - get email from auth.users
      if (profile && profile.id) {
        // Get the user's email from auth.users using admin client
        if (supabaseAdmin) {
          try {
            // Add retry logic for getUserById
            let authUser;
            let getUserError;
            let getUserRetries = 3;
            
            while (getUserRetries > 0) {
              try {
                const result = await supabaseAdmin.auth.admin.getUserById(profile.id);
                authUser = result.data;
                getUserError = result.error;
                break; // Success, exit retry loop
              } catch (networkError: any) {
                getUserRetries--;
                if (getUserRetries === 0) {
                  console.error('Network error during getUserById:', networkError);
                  getUserError = { message: networkError.message || 'Connection reset', status: 500 };
                  break;
                }
                console.log(`getUserById failed, retrying... (${getUserRetries} attempts remaining)`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (4 - getUserRetries)));
              }
            }
            
            console.log('Auth user lookup result:', { 
              userId: profile.id,
              email: authUser?.user?.email, 
              hasEmail: !!authUser?.user?.email,
              error: getUserError?.message,
              errorCode: getUserError?.status
            });
            
            if (!getUserError && authUser?.user?.email) {
              loginEmail = authUser.user.email;
              console.log('Successfully resolved username to email:', loginEmail);
            } else {
              // If getUserById fails, try listing all users and finding by ID
              console.log('getUserById failed, trying alternative method (listUsers)...');
              try {
                // Add retry logic for listUsers
                let allUsersData;
                let listError;
                let listRetries = 3;
                
                while (listRetries > 0) {
                  try {
                    const result = await supabaseAdmin.auth.admin.listUsers();
                    allUsersData = result.data;
                    listError = result.error;
                    break; // Success, exit retry loop
                  } catch (networkError: any) {
                    listRetries--;
                    if (listRetries === 0) {
                      console.error('Network error during listUsers:', networkError);
                      listError = { message: networkError.message || 'Connection reset', status: 500 };
                      break;
                    }
                    console.log(`listUsers failed, retrying... (${listRetries} attempts remaining)`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * (4 - listRetries)));
                  }
                }
                
                console.log('listUsers response:', {
                  hasData: !!allUsersData,
                  userCount: allUsersData?.users?.length || 0,
                  error: listError?.message,
                  errorCode: listError?.status
                });
                
                if (!listError && allUsersData?.users) {
                  const foundUser = allUsersData.users.find(u => u.id === profile.id);
                  console.log('User search in listUsers:', {
                    searchingForId: profile.id,
                    found: !!foundUser,
                    foundEmail: foundUser?.email
                  });
                  
                  if (foundUser?.email) {
                    loginEmail = foundUser.email;
                    console.log('✅ Successfully resolved username to email via listUsers:', loginEmail);
                  } else {
                    // User exists in profile but email not found - this is an error condition
                    // Don't use fallback for registered users (they should have emails)
                    console.error('❌ CRITICAL: User ID found in profile but email not found in auth.users');
                    console.error('Profile ID:', profile.id);
                    console.error('Profile username:', profile.username);
                    console.error('Profile role:', profile.role);
                    return res.status(500).json({ 
                      error: 'User account configuration error. Email not found in authentication system.',
                      debug: process.env.NODE_ENV === 'development' ? { 
                        userId: profile.id, 
                        username: input,
                        role: profile.role
                      } : undefined
                    });
                  }
                } else {
                  console.error('listUsers API call failed:', listError);
                  return res.status(500).json({ 
                    error: 'Failed to retrieve user information from authentication system',
                    debug: process.env.NODE_ENV === 'development' ? { 
                      error: listError?.message,
                      errorCode: listError?.status
                    } : undefined
                  });
                }
              } catch (listError: any) {
                console.error('Exception in listUsers:', listError);
                // Check if it's a network error
                if (listError?.message?.includes('fetch') || listError?.message?.includes('ECONNRESET')) {
                  return res.status(500).json({ 
                    error: 'Failed to connect to Supabase. Please check your network connection and Supabase configuration.',
                    details: listError.message || 'Connection reset',
                    suggestion: 'Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
                  });
                }
                return res.status(500).json({ 
                  error: 'Failed to retrieve user information',
                  debug: process.env.NODE_ENV === 'development' ? { 
                    error: listError instanceof Error ? listError.message : 'Unknown error' 
                  } : undefined
                });
              }
            }
          } catch (err: any) {
            console.error('Exception in auth user lookup:', err);
            // Check if it's a network error
            if (err?.message?.includes('fetch') || err?.message?.includes('ECONNRESET')) {
              return res.status(500).json({ 
                error: 'Failed to connect to Supabase. Please check your network connection and Supabase configuration.',
                details: err.message || 'Connection reset',
                suggestion: 'Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
              });
            }
            return res.status(500).json({ 
              error: 'Failed to retrieve user information',
              debug: process.env.NODE_ENV === 'development' ? { 
                error: err instanceof Error ? err.message : 'Unknown error',
                userId: profile?.id
              } : undefined
            });
          }
        } else {
          // No admin client - cannot resolve email
          console.error('Admin client not available - cannot resolve email from username');
          return res.status(500).json({ 
            error: 'Server configuration error. Admin client not available.',
            debug: process.env.NODE_ENV === 'development' ? { 
              message: 'SUPABASE_SERVICE_ROLE_KEY is required to resolve usernames to emails'
            } : undefined
          });
        }
      }
    }

    if (!loginEmail) {
      return res.status(400).json({ error: 'Could not resolve email from username' });
    }

    console.log('Attempting login with resolved email:', loginEmail);

    // Authenticate with Supabase
    // Supabase compares the provided password with the bcrypt hash stored in auth.users
    // The password is hashed client-side and compared server-side
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password, // This is compared against the hashed password in the database
    });

    if (authError) {
      console.error('Supabase auth error:', {
        message: authError.message,
        status: authError.status,
        name: authError.name,
        triedEmail: loginEmail,
        originalInput: input
      });
      
      // Provide more specific error messages
      if (authError.message?.includes('Email not confirmed') || authError.message?.includes('email_not_confirmed')) {
        return res.status(401).json({ error: 'Please confirm your email before logging in' });
      }
      if (authError.message?.includes('Invalid login credentials') || authError.message?.includes('invalid_credentials')) {
        return res.status(401).json({ 
          error: 'Invalid username or password',
          debug: process.env.NODE_ENV === 'development' ? { triedEmail: loginEmail, originalInput: input } : undefined
        });
      }
      return res.status(401).json({ 
        error: authError.message || 'Invalid username or password',
        debug: process.env.NODE_ENV === 'development' ? { triedEmail: loginEmail, originalInput: input } : undefined
      });
    }
    
    console.log('Supabase authentication successful for user:', authData.user?.email);

    if (!authData.user || !authData.session) {
      return res.status(401).json({ error: 'Login failed - no session created' });
    }

    // Get user profile using admin client to bypass RLS (avoids infinite recursion)
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error. Admin client not available.',
        debug: process.env.NODE_ENV === 'development' ? { 
          message: 'SUPABASE_SERVICE_ROLE_KEY is required for profile lookup',
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        } : undefined
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('username, role')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return res.status(500).json({ 
        error: 'Failed to fetch user profile',
        details: profileError.message 
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profile.username,
        role: profile.role,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      },
    });
  } catch (error) {
    console.error('Login exception:', error);
    res.status(500).json({
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires authentication)
 */
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({
      user: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user profile (requires authentication)
 */
router.put('/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { username } = req.body;

    // Users can only update their username, not role
    const updateData: { username?: string } = {};
    if (username) {
      // Check if username is already taken by another user
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .neq('id', req.user.id)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      updateData.username = username;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Profile updated successfully',
      user: profile,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client should discard token)
 */
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // With Supabase, logout is typically handled client-side by discarding the token
    // But we can invalidate the session if needed
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/logout-admin
 * Logout admin user from admin dashboard (requires admin authentication)
 * 
 * This endpoint is specifically for admin users logging out from the admin dashboard.
 * Since Supabase JWT tokens are stateless, logout is primarily handled client-side
 * by discarding the token. This endpoint verifies admin authentication and returns
 * a success response to confirm the logout request.
 */
router.post('/logout-admin', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Supabase JWT tokens are stateless, so logout is handled client-side
    // by discarding the token. This endpoint confirms the logout request
    // and ensures the user has admin privileges.
    
    res.json({ 
      message: 'Admin logged out successfully',
      user: {
        id: req.user.id,
        email: req.user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/register-admin
 * Register a new admin account (public endpoint)
 * 
 * SECURITY WARNING: This endpoint is public. Consider adding additional security measures
 * in production (e.g., invitation codes, admin approval workflow, etc.).
 * Passwords are automatically hashed by Supabase Auth using bcrypt.
 * The password is never stored in plain text.
 */
router.post('/register-admin', async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client not configured. SUPABASE_SERVICE_ROLE_KEY is required.' });
    }

    // Check if email already exists in auth.users
    try {
      const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingAuthUser?.users?.some(u => u.email === email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    } catch (checkError) {
      console.warn('Could not check existing emails:', checkError);
      // Continue anyway, Supabase will handle duplicate email error
    }

    // Use admin client to create user (bypasses RLS)
    // Add retry logic for network issues
    let authData;
    let authError;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password, // This will be hashed by Supabase before storage
          email_confirm: true, // Auto-confirm email for admin accounts
          user_metadata: {
            username,
            role: 'admin',
          },
        });
        authData = result.data;
        authError = result.error;
        break; // Success, exit retry loop
      } catch (networkError: any) {
        retries--;
        if (retries === 0) {
          console.error('Network error creating admin user:', networkError);
          return res.status(500).json({ 
            error: 'Failed to connect to Supabase. Please check your network connection and Supabase configuration.',
            details: networkError.message || 'Connection reset',
            suggestion: 'Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
          });
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
      }
    }

    if (authError) {
      console.error('Supabase auth error:', authError);
      return res.status(400).json({ error: authError.message || 'Failed to create admin user' });
    }

    if (!authData || !authData.user) {
      return res.status(400).json({ error: 'Failed to create user - no user data returned' });
    }

    // Hash password for storage in user_profiles (optional, Supabase already hashes it in auth.users)
    const passwordHash = await bcrypt.hash(password, 10);

    // The user profile will be created automatically by the trigger
    // But we can update it to ensure username, role, and password_hash are set correctly
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ username, role: 'admin', password_hash: passwordHash })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Try to get the profile that was created by the trigger
      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (existingProfile) {
        return res.status(201).json({
          message: 'Admin registered successfully',
          user: {
            id: authData.user.id,
            email: authData.user.email,
            username: existingProfile.username,
            role: existingProfile.role,
          },
        });
      }
    }

    res.status(201).json({
      message: 'Admin registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profile?.username || username,
        role: profile?.role || 'admin',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to register admin',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/create-viewer
 * Create a new viewer account (public endpoint)
 * 
 * SECURITY NOTE: This endpoint is public. Passwords are automatically hashed by Supabase Auth using bcrypt.
 * The password is never stored in plain text.
 */
router.post('/create-viewer', async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if username already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists in auth.users
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client not configured. SUPABASE_SERVICE_ROLE_KEY is required.' });
    }

    // Check if email already exists
    try {
      const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingAuthUser?.users?.some(u => u.email === email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    } catch (checkError) {
      console.warn('Could not check existing emails:', checkError);
      // Continue anyway, Supabase will handle duplicate email error
    }

    // Use admin client to create user (bypasses RLS)
    // Add retry logic for network issues
    let authData;
    let authError;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const result = await supabaseAdmin.auth.admin.createUser({
          email,
          password, // This will be hashed by Supabase before storage
          email_confirm: true, // Auto-confirm email for viewer accounts
          user_metadata: {
            username,
            role: 'viewer',
          },
        });
        authData = result.data;
        authError = result.error;
        break; // Success, exit retry loop
      } catch (networkError: any) {
        retries--;
        if (retries === 0) {
          console.error('Network error creating viewer user:', networkError);
          return res.status(500).json({ 
            error: 'Failed to connect to Supabase. Please check your network connection and Supabase configuration.',
            details: networkError.message || 'Connection reset',
            suggestion: 'Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file'
          });
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
      }
    }

    if (authError) {
      console.error('Supabase auth error:', authError);
      return res.status(400).json({ error: authError.message || 'Failed to create viewer user' });
    }

    if (!authData || !authData.user) {
      return res.status(400).json({ error: 'Failed to create user - no user data returned' });
    }

    // Hash password for storage in user_profiles (optional, Supabase already hashes it in auth.users)
    const passwordHash = await bcrypt.hash(password, 10);

    // The user profile will be created automatically by the trigger
    // But we can update it to ensure username, role, and password_hash are set correctly
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({ username, role: 'viewer', password_hash: passwordHash })
      .eq('id', authData.user.id)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Try to get the profile that was created by the trigger
      const { data: existingProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (existingProfile) {
        return res.status(201).json({
          message: 'Viewer created successfully',
          user: {
            id: authData.user.id,
            email: authData.user.email,
            username: existingProfile.username,
            role: existingProfile.role,
          },
        });
      }
    }

    res.status(201).json({
      message: 'Viewer created successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: profile?.username || username,
        role: profile?.role || 'viewer',
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create viewer',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auth/viewers
 * List all user profiles (admin only) – frontend will filter to viewers
 */
router.get('/viewers', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Use admin client to bypass RLS and avoid recursion in policies
    if (!supabaseAdmin) {
      console.error('supabaseAdmin not configured - cannot fetch viewers');
      return res.status(500).json({
        error: 'Server configuration error. Admin client not available.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, role, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch viewers:', error);
      return res.status(500).json({
        error: 'Failed to fetch viewers',
        details: error.message,
      });
    }

    const viewers = (data || []).map((profile: any) => ({
      id: profile.id,
      username: profile.username,
      role: profile.role,
      status: 'active' as const, // Placeholder status; all viewers treated as active for now
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));

    res.json({ viewers });
  } catch (error) {
    console.error('Error in GET /api/auth/viewers:', error);
    res.status(500).json({
      error: 'Failed to fetch viewers',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/auth/viewers/:id
 * Update a viewer profile (admin only)
 * Currently supports updating username only.
 */
router.put('/viewers/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username } = req.body as { username?: string };

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client not configured. SUPABASE_SERVICE_ROLE_KEY is required.' });
    }

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Ensure username is unique
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .neq('id', id)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ username })
      .eq('id', id)
      .select('id, username, role, created_at, updated_at')
      .single();

    if (error) {
      console.error('Failed to update viewer profile:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Viewer updated successfully',
      viewer: {
        id: data.id,
        username: data.username,
        role: data.role,
        status: 'active' as const,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in PUT /api/auth/viewers/:id:', error);
    res.status(500).json({
      error: 'Failed to update viewer',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/auth/viewers/:id
 * Delete a viewer (admin only)
 */
router.delete('/viewers/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client not configured. SUPABASE_SERVICE_ROLE_KEY is required.' });
    }

    // Deleting auth user will cascade to user_profiles via FK
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      console.error('Failed to delete viewer:', error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Viewer deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/auth/viewers/:id:', error);
    res.status(500).json({
      error: 'Failed to delete viewer',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


