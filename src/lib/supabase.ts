import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getStaffSessionToken, getAdminSessionToken } from './sessionTokens';

// External Supabase project (user-provided AquaDealers backend).
// Anon/publishable keys are safe to ship in client code.

// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY let tests and local stacks
// (e.g. `supabase start`) point the app elsewhere without a code change.
// NOTE: Supabase anon keys are PUBLIC keys by design (all security via RLS).
// They are safe to ship in client bundles. See: https://supabase.com/docs/guides/api/api-keys
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://fvcafioxkgbljcjomixs.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_4xT4NDR8E-Zj5wqTrh-WsA_DLqEcVvn';

// Warn in development if env vars are missing (production builds always have them via CI)
if (import.meta.env.DEV && !import.meta.env.VITE_SUPABASE_URL) {
  console.warn(
    '[AquaDealers] VITE_SUPABASE_URL not set — falling back to hardcoded project URL.\n' +
    'Create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for local dev.'
  );
}

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
