// Export all dealer data from a source project by logging in as the dealer
// (RLS grants access to all their own rows). Historical use: one-time migration
// from the old xttuxtyjtqegjvirtpbr project to fvcafioxkgbljcjomixs in July 2026.
//
// Usage:
//   1. Fill scripts/migrate/.env.migration (see .env.migration.example)
//   2. node scripts/migrate/export.mjs
//
// Output: scripts/migrate/data/<table>.json + data/storage/<bucket>/<path>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(DIR, 'data');

const env = Object.fromEntries(
  fs.readFileSync(path.join(DIR, '.env.migration'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const SOURCE_URL = env.SOURCE_URL;
const SOURCE_REF = new URL(SOURCE_URL).hostname.split('.')[0];

// Dealer-scoped tables, in rough FK dependency order (also used by import.mjs)
export const TABLES = [
  'dealers',
  'branches',
  'products',
  'suppliers',
  'farmers',
  'inventory',
  'stock_purchases',
  'inventory_lots',
  'inventory_movements',
  'bills',
  'bill_items',
  'bill_item_lot_allocations',
  'payments',
  'payment_allocations',
  'bill_signatures',
  'expenses',
  'cash_book',
  'supplier_payments',
  'gst_ledger',
  'cash_closings',
  'farmer_product_discounts',
  'onboarding_progress',
];

const PAGE = 1000;

async function main() {
  const supabase = createClient(SOURCE_URL, env.SOURCE_ANON_KEY, {
    realtime: { transport: () => ({ close() {}, addEventListener() {}, removeEventListener() {}, send() {} }) },
  });

  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.DEALER_EMAIL,
    password: env.DEALER_PASSWORD,
  });
  if (authErr) throw new Error(`Login failed: ${authErr.message}`);
  const dealerId = auth.user.id;
  console.log(`Logged in as ${env.DEALER_EMAIL} (dealer ${dealerId})`);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const counts = {};

  for (const table of TABLES) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + PAGE - 1);
      if (error) {
        console.warn(`  SKIP ${table}: ${error.message}`);
        break;
      }
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    if (rows.length || !counts[table]) {
      fs.writeFileSync(path.join(DATA_DIR, `${table}.json`), JSON.stringify(rows, null, 1));
      counts[table] = rows.length;
      console.log(`  ${table}: ${rows.length} rows`);
    }
  }

  // Collect every storage URL referenced anywhere in the data and download it
  const urlRe = new RegExp(
    `https://${SOURCE_REF}\\.supabase\\.co/storage/v1/object/public/([\\w.-]+)/([^"?\\s]+)`,
    'g'
  );
  const files = new Set();
  for (const table of TABLES) {
    const f = path.join(DATA_DIR, `${table}.json`);
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, 'utf8').matchAll(urlRe)) {
      files.add(`${m[1]}/${m[2]}`);
    }
  }
  console.log(`\nDownloading ${files.size} storage files...`);
  let ok = 0;
  for (const key of files) {
    const dest = path.join(DATA_DIR, 'storage', key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      const res = await fetch(`${SOURCE_URL}/storage/v1/object/public/${key}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      ok++;
    } catch (e) {
      console.warn(`  FAILED ${key}: ${e.message}`);
    }
  }
  console.log(`Downloaded ${ok}/${files.size} files`);

  fs.writeFileSync(
    path.join(DATA_DIR, '_meta.json'),
    JSON.stringify({ dealerId, email: env.DEALER_EMAIL, sourceRef: SOURCE_REF, counts, exportedAt: new Date().toISOString() }, null, 2)
  );
  console.log('\nExport complete. Row counts saved to data/_meta.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
