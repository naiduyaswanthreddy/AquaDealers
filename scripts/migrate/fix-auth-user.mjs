// Delete the broken direct-INSERTed auth user, then re-create it properly
// through the Auth Admin API, keeping the same UUID so all our imported
// dealer_id references still work.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(DIR, '.env.migration'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const DEALER_ID = 'c35c9011-dea5-414e-9b28-06ab2cd2afbb';
const AUTH = `${env.TARGET_URL}/auth/v1`;
const H = { apikey: env.TARGET_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.TARGET_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD) {
  console.error('Usage: node fix-auth-user.mjs <new-password>');
  process.exit(1);
}

// 1. Delete broken row (idempotent)
const del = await fetch(`${AUTH}/admin/users/${DEALER_ID}`, { method: 'DELETE', headers: H });
console.log('DELETE:', del.status, await del.text());

// 2. Also try DELETE by email in case UUID lookup fails but user is broken
// (skip - if delete failed we'll see it in create)

// 3. Create via admin API with the same UUID
const create = await fetch(`${AUTH}/admin/users`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({
    id: DEALER_ID,
    email: env.DEALER_EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true,
  }),
});
console.log('CREATE:', create.status);
const body = await create.json();
console.log(JSON.stringify(body, null, 2));
