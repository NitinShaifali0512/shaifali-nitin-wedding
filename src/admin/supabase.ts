import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, backendConfigured } from '../lib/config';

let client: SupabaseClient | null = null;

/**
 * The Supabase client used by the dashboard. It is created with the public
 * key only; what a signed-in administrator may do is decided by the Row Level
 * Security rules in supabase/schema.sql, never by anything in the browser.
 */
export function getSupabase(): SupabaseClient {
  if (!backendConfigured) throw new Error('The website is not connected to Supabase yet.');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'wedding-admin-session',
      },
    });
  }
  return client;
}
