// Creates (or repairs) the dedicated E2E test dealer account used by the
// Playwright suite in tests/e2e. Safe to re-run — every step is an upsert.
//
//   node scripts/seed-test-dealer.mjs
//
// Configuration comes from .env.e2e (see .env.e2e.example). By default it
// targets the live Supabase project baked into src/lib/supabase.ts; set
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY there to use a local stack.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ws from 'ws';

// Node < 22 has no native WebSocket; supabase-js needs one even when
// realtime is unused.
const clientOptions = {
  auth: { persistSession: false },
  realtime: { transport: ws },
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env.e2e') });

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://xttuxtyjtqegjvirtpbr.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dHV4dHlqdHFlZ2p2aXJ0cGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDkyNDksImV4cCI6MjA5NTc4NTI0OX0.Wj5dvvzMX5VXNBo2DY2j_5jhsEPzHCC_OUmsZvjrU3A';
const EMAIL = process.env.E2E_DEALER_EMAIL || 'e2e.dealer@aquadealers.in';
const PASSWORD = process.env.E2E_DEALER_PASSWORD || 'change-me-please';
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

if (!/e2e/i.test(EMAIL)) {
  console.error(
    `Refusing to seed "${EMAIL}": the test dealer email must contain "e2e" ` +
      'so the suite can never touch a real account.'
  );
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);

async function ensureAuthUser() {
  // Try signing in first — the account may already exist.
  const signIn = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (!signIn.error && signIn.data.session) return signIn.data;

  if (SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, clientOptions);
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error && !/already/i.test(created.error.message)) {
      throw new Error(`admin.createUser failed: ${created.error.message}`);
    }
  } else {
    const signUp = await anon.auth.signUp({ email: EMAIL, password: PASSWORD });
    if (signUp.error && !/already registered/i.test(signUp.error.message)) {
      throw new Error(`signUp failed: ${signUp.error.message}`);
    }
    if (!signUp.error && signUp.data.user && !signUp.data.session) {
      console.error(
        'Sign-up succeeded but no session was returned — the project likely ' +
          'requires email confirmation. Either confirm the email manually, ' +
          'disable confirmations for this project, or set ' +
          'E2E_SUPABASE_SERVICE_ROLE_KEY in .env.e2e and re-run.'
      );
      process.exit(1);
    }
  }

  const retry = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (retry.error || !retry.data.session) {
    throw new Error(
      `Could not sign in as ${EMAIL}: ${retry.error?.message ?? 'no session'}. ` +
        'If the account exists with a different password, update .env.e2e.'
    );
  }
  return retry.data;
}

async function main() {
  console.log(`Seeding E2E dealer ${EMAIL} on ${SUPABASE_URL} ...`);
  const { user } = await ensureAuthUser();
  const dealerId = user.id;
  const now = new Date().toISOString();

  // Dealer profile. plan_expires_at stays NULL (never expires) and the bill
  // signature requirement is off so credit bills don't demand a signature pad.
  const { error: dealerError } = await anon.from('dealers').upsert(
    {
      id: dealerId,
      name: 'E2E Test Dealer',
      shop_name: 'E2E Aqua Feeds',
      phone: '9990000001',
      email: EMAIL,
      district: 'West Godavari',
      state: 'Andhra Pradesh',
      language: 'en',
      plan: 'trial',
      plan_expires_at: null,
      is_active: true,
      gst_billing_enabled: false,
      bill_signature_enabled: false,
    },
    { onConflict: 'id' }
  );
  if (dealerError) throw new Error(`dealers upsert failed: ${dealerError.message}`);

  // Main branch (created once).
  const { data: branch } = await anon
    .from('branches')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('is_main', true)
    .maybeSingle();
  if (!branch) {
    const { error } = await anon
      .from('branches')
      .insert({ dealer_id: dealerId, name: 'Main Shop', is_main: true, is_active: true });
    if (error) throw new Error(`branches insert failed: ${error.message}`);
  }

  // Stamp every onboarding step, otherwise the app bounces to /onboarding.
  const { error: onboardingError } = await anon.from('onboarding_progress').upsert(
    {
      dealer_id: dealerId,
      step_1_shop_details_at: now,
      step_2_language_at: now,
      step_3_first_product_at: now,
      step_4_first_farmer_at: now,
      step_5_first_bill_at: now,
      step_5_set_pin_at: now,
      completed_at: now,
    },
    { onConflict: 'dealer_id' }
  );
  if (onboardingError) {
    throw new Error(`onboarding_progress upsert failed: ${onboardingError.message}`);
  }

  console.log('=================================');
  console.log('E2E dealer ready');
  console.log(`  id:    ${dealerId}`);
  console.log(`  email: ${EMAIL}`);
  console.log('Run the suite with: npx playwright test --project=setup --project=e2e');
  console.log('=================================');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
