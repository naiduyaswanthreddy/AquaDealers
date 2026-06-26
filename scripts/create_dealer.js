import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://fgrdcscbrtcewmoprnfr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncmRjc2NicnRjZXdtb3BybmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMDAxNTksImV4cCI6MjA5NDY3NjE1OX0.pA55rWJXvO6SqiN0KcxEgXMQZTuEWkwUzIyekGqkWAk';

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Creating Test Dealer...");
  
  const email = "testdealer@aquadealers.in";
  const password = "password123";
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
        console.log("Dealer already exists! You can log in with testdealer@aquadealers.in / password123");
        process.exit(0);
    }
    console.error("Auth Error:", authError);
    process.exit(1);
  }

  const userId = authData.user.id;

  const { error: dealerError } = await supabase.from('dealers').insert({
    id: userId,
    name: 'Ravi Kumar',
    shop_name: 'Aqua Pro Feeds',
    phone: '9876543210',
    email,
    district: 'West Godavari',
    state: 'Andhra Pradesh',
    language: 'te',
    plan: 'basic',
    is_active: true,
  });

  if (dealerError) {
    console.error("Failed to create dealer profile:", dealerError);
  } else {
    console.log("Dealer profile created!");
  }

  const { error: branchError } = await supabase.from('branches').insert({
    dealer_id: userId,
    name: 'Main Shop',
    is_main: true,
    is_active: true,
  });
  
  if (branchError) {
      console.error("Failed to create branch:", branchError);
  } else {
      console.log("Branch created!");
  }

  console.log("\n=================================");
  console.log("✅ TEST DEALER CREATED SUCCESSFULLY");
  console.log("Email: testdealer@aquadealers.in");
  console.log("Password: password123");
  console.log("=================================\n");
}

main();
