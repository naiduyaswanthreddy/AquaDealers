// Fires the bill-notification WhatsApp template via authkey.io after a bill
// is created. Best-effort: never throws back to the caller, no retry queue
// (add one if delivery failures become a real problem).
// ponytail: statement-link template dropped for now, add back as a second
// sendTemplate call (AUTHKEY_STATEMENT_WID) once that template is approved.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const AUTHKEY_TOKEN = Deno.env.get('AUTHKEY_TOKEN')!;
const AUTHKEY_BILL_WID = Deno.env.get('AUTHKEY_BILL_WID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Supabase doesn't inject CORS headers for you — every response (including
// the browser's preflight OPTIONS) needs these or the browser blocks it as a
// CORS failure, even when the actual request would have succeeded.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-staff-token, x-admin-token',
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

async function sendTemplate(mobile: string, wid: string, bodyValues: Record<string, string>): Promise<boolean> {
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
      .select('bill_number, total, balance_due, farmer_id, is_estimate')
      .eq('id', billId)
      .single();
    if (billError || !bill?.farmer_id || bill.is_estimate) return respond('skipped');

    const { data: farmer, error: farmerError } = await supabase
      .from('farmers')
      .select('name, phone')
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

    const sent = await sendTemplate(mobile, AUTHKEY_BILL_WID, {
      '1': farmer.name,
      '2': bill.bill_number,
      '3': formatInr(bill.total),
      '4': formatInr(bill.balance_due),
    });

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
