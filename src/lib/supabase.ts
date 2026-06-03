import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Legacy/untyped client used throughout the imported AquaDealer codebase.
// The Lovable Cloud generated client lives at @/integrations/supabase/client and is strictly typed
// against the current public schema (which is empty for now). To keep the imported code compiling
// while we incrementally bring up tables and RPCs, we expose an untyped client here.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error('Lovable Cloud env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase: SupabaseClient<any, any, any> = createClient(
  supabaseUrl ?? '',
  supabaseKey ?? '',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

export default supabase;
