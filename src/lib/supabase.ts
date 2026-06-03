import { createClient, SupabaseClient } from '@supabase/supabase-js';

// External Supabase project (user-provided AquaDealer backend).
// Anon/publishable keys are safe to ship in client code.
const SUPABASE_URL = 'https://xttuxtyjtqegjvirtpbr.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dHV4dHlqdHFlZ2p2aXJ0cGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDkyNDksImV4cCI6MjA5NTc4NTI0OX0.Wj5dvvzMX5VXNBo2DY2j_5jhsEPzHCC_OUmsZvjrU3A';

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
  }
);

export default supabase;
