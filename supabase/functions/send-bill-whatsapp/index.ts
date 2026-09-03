// Fires the bill-notification WhatsApp template via authkey.io after a bill
// is created. Best-effort: never throws back to the caller, no retry queue
// (add one if delivery failures become a real problem).
//
// Template shape this expects (8 body vars + 1 button var). AUTHKEY_BILL_WID
// MUST point at a template with exactly this shape — WhatsApp rejects the
// send if the parameter set doesn't match the approved template:
//   1 farmer name   2 shop name    3 bill number   4 items
//   5 total         6 amount paid  7 pay method    8 balance due
//   button {{1}}    farmer share_token -> https://aquadealers.in/f/<token>
//
// A header-variable version (template 47325: "Namaste {{1}}") was tried and
// reverted — authkey.io's requestjson.php never delivered it (queue-accepted
// with "Submitted Successfully" but nothing arrived on the test phone, both
// with a separate headerValues object and with the name folded into a flat
// bodyValues sequence). Their docs only document headerValues for a MEDIA
// header (headerFileName/headerData), never for a text header's {{1}} — so
// stick to a template whose header has no variable until that's resolved
// with authkey support.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AUTHKEY_TOKEN = Deno.env.get('AUTHKEY_TOKEN')!;
const AUTHKEY_BILL_WID = Deno.env.get('AUTHKEY_BILL_WID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Supabase doesn't inject CORS headers for you — every response (including
// the browser's preflight OPTIONS) needs these or the browser blocks it as a
// CORS failure, even when the actual request would have succeeded.
// A hardcoded header allowlist is whack-a-mole (supabase-js already sent an
// x-client-info header we hadn't listed) — wildcard is the actual fix, and
// safe here since we never use cookie-based credentials, only a bearer token.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};
const respond = (body: string, status = 200) => new Response(body, { status, headers: CORS_HEADERS });

// Bulk-imported farmers can have 11-15 digit phones (country code or a
// leading 0 baked in — see ImportFarmersExcelModal's loose 10-15 digit
// check). Strip those before sending country_code=91 separately, or the
// number authkey.io dials is wrong. Returns null (treated as "no valid
// phone", not a retryable failure) if it can't be normalized to a real
// 10-digit Indian mobile.
function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 10 && /^[6-9]/.test(digits) ? digits : null;
}

function formatInr(value: unknown): string {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// WhatsApp rejects a template send outright if any variable is empty or
// contains a newline/tab. Farmer names, shop names and product names are all
// user-entered, so collapse whitespace and never return an empty string.
export function safeVar(value: unknown, fallback = '-'): string {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank',
  credit: 'Credit',
  cheque: 'Cheque',
  other: 'Other',
};

// payment_type is nullable — a full-credit bill has nothing paid and no
// method, so there is no method to name.
export function paymentLabel(paymentType: unknown, amountPaid: unknown): string {
  const key = String(paymentType ?? '').toLowerCase();
  if (PAYMENT_LABELS[key]) return PAYMENT_LABELS[key];
  return Number(amountPaid) > 0 ? 'Cash' : '-';
}

export function itemsSummary(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return '-';
  return safeVar(
    items
      .map((i) => `${safeVar(i?.product_name_snapshot, 'Item')} (${Number(i?.quantity)})`)
      .join(', '),
  );
}

async function sendTemplate(
  mobile: string,
  wid: string,
  bodyValues: Record<string, string>,
  buttonParamValue?: string,
): Promise<boolean> {
  const res = await fetch('https://console.authkey.io/restapi/requestjson.php', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${AUTHKEY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      country_code: '91',
      mobile,
      wid,
      type: 'text',
      bodyValues,
      // Fills the template's dynamic CTA button URL suffix
      // (https://aquadealers.in/f/<share_token>). Only send this when the
      // configured template actually has a button component — the parameter
      // set must match the approved template exactly.
      ...(buttonParamValue ? { button_param_value: buttonParamValue } : {}),
    }),
  });
  // Confirmed against real responses (not guessed): authkey.io's `Message`
  // field is the actual signal — HTTP status alone is wrong two ways:
  //   1. It's "accepted into their queue", not "delivered" — a garbage
  //      mobile number or bogus template id still returns 200 + "Submitted
  //      Successfully". No synchronous way to know true delivery; would need
  //      a delivery-status webhook from authkey if they offer one.
  //   2. A bad authkey / insufficient balance returns HTTP 203 (still counts
  //      as `res.ok`, since 203 falls in the 200-299 range) with
  //      {"Message":"Invalid authkey or insufficient balance"} — res.ok
  //      alone would have silently marked a real failure as "sent".
  const text = await res.text();
  console.log(`authkey.io response (wid=${wid}, status=${res.status}):`, text.slice(0, 500));
  try {
    return JSON.parse(text).Message === 'Submitted Successfully';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const { billId } = await req.json();

    // Forward only the caller's auth headers (not the whole request — headers
    // like content-length/host describe THIS request, not the downstream
    // PostgREST calls this client makes) so existing RLS on bills/farmers
    // enforces that a dealer/staff session can only notify for their own bill.
    const forwardedHeaders: Record<string, string> = {};
    for (const name of ['authorization', 'apikey', 'x-staff-token', 'x-admin-token']) {
      const value = req.headers.get(name);
      if (value) forwardedHeaders[name] = value;
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: forwardedHeaders },
    });

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .select('bill_number, total, balance_due, amount_paid, payment_type, farmer_id, is_estimate, bill_items(product_name_snapshot, quantity)')
      .eq('id', billId)
      .single();
    if (billError || !bill?.farmer_id || bill.is_estimate) return respond('skipped');

    const { data: farmer, error: farmerError } = await supabase
      .from('farmers')
      .select('name, phone, share_token')
      .eq('id', bill.farmer_id)
      .single();
    // No phone at all isn't a retryable failure to report — nothing to show
    // "Failed" for until the farmer profile has a number.
    if (farmerError || !farmer?.phone) return respond('skipped');

    const mobile = normalizeIndianMobile(farmer.phone);
    if (!mobile) return respond('skipped');

    // Quota gate: dealer must have WhatsApp enabled + a plan with room left
    // this month. Same statement atomically increments the counter, so two
    // bills created at once can't both slip through under the limit.
    const { data: allowed } = await supabase.rpc('check_and_increment_whatsapp_usage', { p_bill_id: billId });
    if (!allowed) {
      await supabase.rpc('set_bill_whatsapp_status', { p_bill_id: billId, p_status: 'failed', p_reason: 'quota_exceeded' });
      return respond('quota_exhausted');
    }

    // Staff sessions can't read `dealers` under RLS, so the shop name comes
    // from a SECURITY DEFINER helper (see 20260901000000 migration).
    const { data: shopName } = await supabase.rpc('get_bill_shop_name', { p_bill_id: billId });

    const sent = await sendTemplate(
      mobile,
      AUTHKEY_BILL_WID,
      {
        '1': safeVar(farmer.name, 'Customer'),
        '2': safeVar(shopName, 'Your Dealer'),
        '3': safeVar(bill.bill_number),
        '4': itemsSummary(bill.bill_items),
        '5': formatInr(bill.total),
        '6': formatInr(bill.amount_paid),
        '7': paymentLabel(bill.payment_type, bill.amount_paid),
        '8': formatInr(bill.balance_due),
      },
      farmer.share_token ?? undefined,
    );

    await supabase.rpc('set_bill_whatsapp_status', {
      p_bill_id: billId,
      p_status: sent ? 'sent' : 'failed',
      p_reason: sent ? null : 'send_failed',
    });

    return respond(sent ? 'sent' : 'failed');
  } catch (err) {
    console.error('send-bill-whatsapp error:', err);
    return respond('error');
  }
});
