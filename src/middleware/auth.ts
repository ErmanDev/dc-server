import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: 'viewer' | 'admin';
  };
}

/**
 * Middleware to authenticate requests using Supabase JWT token
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user profile to include role using admin client to bypass RLS
    // The admin client uses service_role which should bypass RLS completely
    if (!supabaseAdmin) {
      return res.status(500).json({ 
        error: 'Server configuration error. Admin client not available.',
      });
    }

    // Query using admin client - this should bypass RLS
    // If recursion still occurs, the SQL migration needs to be run
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Check if it's a recursion error
      if (profileError.code === '42P17' || profileError.message?.includes('infinite recursion')) {
        console.error('RLS recursion detected. Please run the SQL migration: database/migrations/003_fix_user_profiles_rls_recursion.sql');
        return res.status(500).json({ 
          error: 'Database configuration error. RLS recursion detected.',
          details: 'Please run the SQL migration file: database/migrations/003_fix_user_profiles_rls_recursion.sql in your Supabase SQL Editor',
        });
      }
      console.error('Error fetching user profile:', profileError);
      // If profile not found, default to viewer
      req.user = {
        id: user.id,
        email: user.email,
        role: 'viewer',
      };
    } else {
      req.user = {
        id: user.id,
        email: user.email,
        role: profile?.role || 'viewer',
      };
    }

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Middleware to check if user is admin
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

/**
 * Middleware to check if user is authenticated (viewer or admin)
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

