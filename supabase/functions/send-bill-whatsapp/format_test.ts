// Smallest thing that fails if the template-variable formatting breaks.
// WhatsApp rejects a send when ANY variable is empty or holds a newline/tab,
// so these are the cases that would silently kill delivery in production.
// Run: deno test supabase/functions/send-bill-whatsapp/format_test.ts
import { itemsSummary, paymentLabel, safeVar } from './index.ts';

Deno.test('safeVar never returns empty or multiline', () => {
  if (safeVar('') !== '-') throw new Error('empty must fall back');
  if (safeVar(null) !== '-') throw new Error('null must fall back');
  if (safeVar('   ') !== '-') throw new Error('whitespace-only must fall back');
  if (safeVar('Ramesh\nKumar') !== 'Ramesh Kumar') throw new Error('newline must collapse');
  if (safeVar('A\t\tB') !== 'A B') throw new Error('tabs must collapse');
  if (safeVar('', 'Customer') !== 'Customer') throw new Error('custom fallback ignored');
});

Deno.test('paymentLabel handles a full-credit bill (null type, nothing paid)', () => {
  if (paymentLabel(null, 0) !== '-') throw new Error('unpaid needs a non-empty placeholder');
  if (paymentLabel('upi', 500) !== 'UPI') throw new Error('UPI casing lost');
  if (paymentLabel('CASH', 500) !== 'Cash') throw new Error('case-insensitive lookup broken');
  if (paymentLabel(null, 500) !== 'Cash') throw new Error('paid-but-untyped should not be empty');
  if (paymentLabel('weird', 500) !== 'Cash') throw new Error('unknown type must still be non-empty');
});

Deno.test('itemsSummary stays a single non-empty line', () => {
  if (itemsSummary([]) !== '-') throw new Error('no items must fall back');
  if (itemsSummary(null) !== '-') throw new Error('null items must fall back');
  const out = itemsSummary([
    { product_name_snapshot: 'Fish Feed', quantity: 10 },
    { product_name_snapshot: 'Urea\n30kg', quantity: 2.5 },
  ]);
  if (out !== 'Fish Feed (10), Urea 30kg (2.5)') throw new Error(`unexpected: ${out}`);
  if (/[\n\t]/.test(out)) throw new Error('summary leaked a newline');
});
