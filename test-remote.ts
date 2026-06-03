import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Connecting to:", supabaseUrl);
  
  // 1. Check total dealers directly (bypassing RPC, though RLS might block it)
  const { data: rawDealers, error: rawError, count } = await supabase
    .from('dealers')
    .select('*', { count: 'exact', head: true });
    
  console.log("Direct dealers count (if RLS allows):", count, rawError?.message || "No Error");

  // 2. Fetch admin user (if any)
  const { data: admins } = await supabase.from('admin_users').select('id, email').limit(1);
  if (!admins || admins.length === 0) {
    console.log("No admin users found.");
    return;
  }
  const adminId = admins[0].id;
  console.log("Using Admin ID:", adminId, "Email:", admins[0].email);

  // 3. Call admin_get_dealers
  const { data: rpcData, error: rpcError } = await supabase.rpc('admin_get_dealers', {
    p_admin_id: adminId,
    p_filters: {}
  });

  console.log("RPC admin_get_dealers error:", rpcError);
  console.log("RPC admin_get_dealers data:", JSON.stringify(rpcData, null, 2));
}

run();
