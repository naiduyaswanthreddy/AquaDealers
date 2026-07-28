import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
  const pin = '1234';
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const pinHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  console.log('PIN Hash:', pinHash);
  
  // We can't really create a dealer via anon key because of RLS.
  // Let's just try to call the login RPC with a random shop/branch to see what error it returns.
  const { data: result, error } = await supabase.rpc('staff_portal_login', {
    p_shop_slug: 'test-shop',
    p_branch_slug: 'main-branch',
    p_pin_hash: pinHash
  });
  
  console.log('Error:', error);
  console.log('Result:', result);
}

run().catch(console.error);
