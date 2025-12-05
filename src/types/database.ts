/**
 * Database types matching Supabase schema
 */

export interface UserProfile {
  id: string; // UUID
  username: string;
  role: 'viewer' | 'admin';
  password_hash?: string | null; // Optional password hash (Supabase Auth handles passwords in auth.users)
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface Order {
  id: string; // UUID
  customer_name: string;
  order_details: string;
  location: string | null;
  phone_number: string | null;
  pickup_date: string | null; // ISO date
  meta_business_link: string | null;
  image: string | null;
  status: 'incoming' | 'accepted' | 'declined' | 'pending' | 'completed';
  created_at: string; // ISO timestamp
  completed_at: string | null; // ISO timestamp
  created_by: string | null; // UUID (user id)
  updated_at: string; // ISO timestamp
}

export interface OrderInsert {
  customer_name: string;
  order_details: string;
  location?: string | null;
  phone_number?: string | null;
  pickup_date?: string | null;
  meta_business_link?: string | null;
  image?: string | null;
  status?: 'incoming' | 'accepted' | 'declined' | 'pending' | 'completed';
  created_by?: string | null;
}

export interface OrderUpdate {
  customer_name?: string;
  order_details?: string;
  location?: string | null;
  phone_number?: string | null;
  pickup_date?: string | null;
  meta_business_link?: string | null;
  image?: string | null;
  status?: 'incoming' | 'accepted' | 'declined' | 'pending' | 'completed';
  completed_at?: string | null; // ISO timestamp
}

