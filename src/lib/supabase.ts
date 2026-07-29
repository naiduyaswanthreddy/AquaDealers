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

// Set by authStore whenever admin impersonation starts/ends. Kept as a plain
// module flag (not a zustand import) to avoid a supabase.ts <-> authStore.ts
// circular import.
let impersonating = false;
export const setImpersonating = (active: boolean) => {
  impersonating = active;
};

// RPC function names are assumed read-only (never blocked) when they start
// with one of these prefixes — the codebase's existing naming convention for
// query-shaped RPCs (get_dashboard_aggregates, get_sales_register_data, etc.).
// Anything else routed through rpc() is treated as a mutation during
// impersonation. This is a heuristic, not a full allowlist audit — it only
// activates during the rare, admin-only impersonation path, so a missed
// write-style RPC name is a residual risk to track, not a regression for
// normal dealer usage (which never sets `impersonating`).
const READ_ONLY_RPC_PREFIXES = ['get_', 'search_', 'verify_', 'check_'];

export const isBlockedByImpersonation = (url: string, method: string): boolean => {
  if (!impersonating) return false;
  const upperMethod = (method || 'GET').toUpperCase();
  if (upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS') return false;

  let path: string;
  try {
    path = new URL(url, 'https://placeholder.invalid').pathname;
  } catch {
    return false;
  }

  const rpcMatch = path.match(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)/);
  if (rpcMatch) {
    const fnName = rpcMatch[1];
    return !READ_ONLY_RPC_PREFIXES.some((prefix) => fnName.startsWith(prefix));
  }

  return path.startsWith('/rest/v1/');
};

// Attaches the staff/admin session tokens (when present) so the database can
// enforce staff RLS policies and admin RPC access server-side.
const fetchWithSessionHeaders: typeof fetch = (input, init) => {
  const method = init?.method || 'GET';
  const url = typeof input === 'string' ? input : (input as Request).url;

  if (isBlockedByImpersonation(url, method)) {
    return Promise.reject(new Error('Action blocked: admin impersonation is read-only.'));
  }

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
