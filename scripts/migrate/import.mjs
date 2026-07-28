// Import exported data into a target project using the service_role /
// sb_secret_* key (bypasses RLS).
//
// Usage:
//   node scripts/migrate/import.mjs --auth-sql   -> prints SQL to create the
//                                                   dealer auth user (paste in
//                                                   SQL editor FIRST)
//   node scripts/migrate/import.mjs --trigger-sql -> prints SQL to disable/enable
//                                                   triggers (paste before/after)
//   node scripts/migrate/import.mjs              -> imports all data + storage

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { TABLES } from './export.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(DIR, 'data');

const env = Object.fromEntries(
  fs.readFileSync(path.join(DIR, '.env.migration'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const meta = JSON.parse(fs.readFileSync(path.join(DATA_DIR, '_meta.json'), 'utf8'));
const TARGET_REF = new URL(env.TARGET_URL).hostname.split('.')[0];

if (process.argv.includes('--auth-sql')) {
  // Same UUID as production so no dealer_id rewriting is needed anywhere.
  console.log(`
-- Run this in the TARGET project's SQL editor (${TARGET_REF}).
-- Replace YOUR_NEW_PASSWORD with the password you want for the dealer login.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000000', '${meta.dealerId}',
  'authenticated', 'authenticated', '${meta.email}',
  crypt('YOUR_NEW_PASSWORD', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at)
VALUES (gen_random_uuid(), '${meta.dealerId}', '${meta.dealerId}',
  jsonb_build_object('sub','${meta.dealerId}','email','${meta.email}','email_verified',true),
  'email', now(), now(), now())
ON CONFLICT DO NOTHING;
`);
  process.exit(0);
}

if (process.argv.includes('--trigger-sql')) {
  // Imported data is already consistent — totals, stock, cash are final values.
  // Triggers that recompute totals on insert would double-count, so disable
  // user triggers during import and re-enable after.
  console.log('-- BEFORE import: paste in SQL editor');
  for (const t of TABLES) console.log(`ALTER TABLE ${t} DISABLE TRIGGER USER;`);
  console.log('\n-- AFTER import: paste in SQL editor');
  for (const t of TABLES) console.log(`ALTER TABLE ${t} ENABLE TRIGGER USER;`);
  process.exit(0);
}

const supabase = createClient(env.TARGET_URL, env.TARGET_SERVICE_ROLE_KEY, {
  realtime: { transport: () => ({ close() {}, addEventListener() {}, removeEventListener() {}, send() {} }) },
});
const CHUNK = 500;

async function main() {
  // 1. Storage buckets + files
  const storageDir = path.join(DATA_DIR, 'storage');
  if (fs.existsSync(storageDir)) {
    const buckets = fs.readdirSync(storageDir);
    for (const bucket of buckets) {
      await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
      const walk = (dir) =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
        );
      const files = walk(path.join(storageDir, bucket));
      console.log(`Uploading ${files.length} files to bucket ${bucket}...`);
      for (const file of files) {
        const key = path.relative(path.join(storageDir, bucket), file).replaceAll('\\', '/');
        const ext = path.extname(key).slice(1);
        const { error } = await supabase.storage.from(bucket).upload(key, fs.readFileSync(file), {
          upsert: true,
          contentType: ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : 'application/octet-stream',
        });
        if (error) console.warn(`  FAILED ${bucket}/${key}: ${error.message}`);
      }
    }
  }

  // 2. Table data, in FK order, with old project URLs rewritten to the new one
  for (const table of TABLES) {
    const f = path.join(DATA_DIR, `${table}.json`);
    if (!fs.existsSync(f)) { console.log(`  ${table}: no export file, skipped`); continue; }
    const raw = fs.readFileSync(f, 'utf8').replaceAll(meta.sourceRef, TARGET_REF);
    const rows = JSON.parse(raw);
    if (!rows.length) { console.log(`  ${table}: 0 rows`); continue; }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).upsert(chunk);
      if (error) {
        console.error(`  ERROR ${table} rows ${i}-${i + chunk.length}: ${error.message}`);
        break;
      }
      inserted += chunk.length;
    }
    console.log(`  ${table}: ${inserted}/${rows.length} imported`);
  }

  console.log('\nImport done. Re-enable triggers (--trigger-sql), then verify counts.');
}

main().catch((e) => { console.error(e); process.exit(1); });
