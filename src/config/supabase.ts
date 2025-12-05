import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required: SUPABASE_URL, SUPABASE_ANON_KEY'
  );
}

// Client for user operations (uses anon key)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// Admin client for server-side operations (uses service role key)
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: async (url, options = {}) => {
          // Add timeout, retry logic, and better error handling
          const maxRetries = 3;
          let lastError: Error | null = null;
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout per attempt
              
              const response = await fetch(url, {
                ...options,
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              return response;
            } catch (error: any) {
              lastError = error;
              
              // If it's the last attempt or not a network error, throw
              if (attempt === maxRetries - 1) {
                throw error;
              }
              
              // Only retry on network errors
              if (error?.name === 'AbortError' || error?.message?.includes('fetch') || error?.code === 'ECONNRESET') {
                // Wait before retry (exponential backoff)
                const delay = 1000 * Math.pow(2, attempt);
                console.log(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
              
              // For non-network errors, throw immediately
              throw error;
            }
          }
          
          throw lastError || new Error('Failed to fetch after retries');
        },
      },
    })
  : null;

/**
 * Test the Supabase connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Try to get the current user or make a simple query
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      // If auth fails, try a simple query to check if connection works
      const { error: queryError } = await supabase.from('_test_connection').select('*').limit(0);
      
      if (queryError && queryError.code !== 'PGRST116') {
        return {
          success: false,
          message: 'Failed to connect to Supabase',
          error: queryError.message,
        };
      }
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Connection error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default supabase;

