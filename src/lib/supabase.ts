import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getStaffSessionToken, getAdminSessionToken } from './sessionTokens';

// External Supabase project (user-provided AquaDealers backend).
// Anon/publishable keys are safe to ship in client code.

// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY let tests and local stacks
// (e.g. `supabase start`) point the app elsewhere without a code change.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://xttuxtyjtqegjvirtpbr.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dHV4dHlqdHFlZ2p2aXJ0cGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDkyNDksImV4cCI6MjA5NTc4NTI0OX0.Wj5dvvzMX5VXNBo2DY2j_5jhsEPzHCC_OUmsZvjrU3A';

// Attaches the staff/admin session tokens (when present) so the database can
// enforce staff RLS policies and admin RPC access server-side.
const fetchWithSessionHeaders: typeof fetch = (input, init) => {
  const staffToken = getStaffSessionToken();
  const adminToken = getAdminSessionToken();
  if (!staffToken && !adminToken) {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers);
  if (staffToken) headers.set('x-staff-token', staffToken);
  if (adminToken) headers.set('x-admin-token', adminToken);
  return fetch(input, { ...init, headers });
};

export const supabase: SupabaseClient<any, any, any> = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      fetch: fetchWithSessionHeaders,
    },
  }
);

export default supabase;
