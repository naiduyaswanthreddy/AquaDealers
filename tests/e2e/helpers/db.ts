import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

// Env is loaded by playwright.config.ts (dotenv on .env.e2e) before workers
// spawn; the same defaults as the app apply when nothing is set.
export const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || 'https://xttuxtyjtqegjvirtpbr.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dHV4dHlqdHFlZ2p2aXJ0cGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDkyNDksImV4cCI6MjA5NTc4NTI0OX0.Wj5dvvzMX5VXNBo2DY2j_5jhsEPzHCC_OUmsZvjrU3A';
export const DEALER_EMAIL = process.env.E2E_DEALER_EMAIL || 'e2e.dealer@aquadealers.in';
export const DEALER_PASSWORD = process.env.E2E_DEALER_PASSWORD || 'change-me-please';

export interface TestDb {
  client: SupabaseClient<any, any, any>;
  dealerId: string;
  branchId: string | null;
}

let cached: Promise<TestDb> | null = null;

/** Signs in as the dedicated test dealer and caches the session per worker. */
export function getTestDb(): Promise<TestDb> {
  if (!cached) cached = connect();
  return cached;
}

async function connect(): Promise<TestDb> {
  if (!/e2e/i.test(DEALER_EMAIL)) {
    throw new Error(
      `E2E_DEALER_EMAIL "${DEALER_EMAIL}" must contain "e2e" — the suite seeds and ` +
        'deletes data for this account and refuses to run against anything else.'
    );
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
    // Node < 22 has no native WebSocket; supabase-js insists on one.
    realtime: { transport: ws as any },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: DEALER_EMAIL,
    password: DEALER_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(
      `Could not sign in as the E2E dealer (${DEALER_EMAIL}): ${error?.message}. ` +
        'Seed it first with: node scripts/seed-test-dealer.mjs'
    );
  }
  const dealerId = data.user.id;
  const { data: branch } = await client
    .from('branches')
    .select('id')
    .eq('dealer_id', dealerId)
    .eq('is_main', true)
    .maybeSingle();
  return { client, dealerId, branchId: branch?.id ?? null };
}

/** ms until the next wall-clock minute (the rate-limit window boundary). */
const msUntilNextMinute = () => 60_000 - (Date.now() % 60_000);

/**
 * The backend limits writes to 30/min per user (enforce_rate_limit trigger on
 * bills/payments/farmers/inventory/cash_book/expenses). Sleep into a fresh
 * minute window so the next UI-driven mutation has full write budget.
 */
export async function waitForFreshRateLimitWindow() {
  await new Promise((resolve) => setTimeout(resolve, msUntilNextMinute() + 2_000));
}

/**
 * Retry rate-limited writes once the minute window rolls over. Note: until
 * migration 20260710000010 lands, the trigger's invalid
 * `ERRCODE = 'too_many_requests'` makes Postgres raise
 * `unrecognized exception condition "too_many_requests"` instead of the
 * intended message — match both.
 */
async function unwrap<T>(
  op: () => PromiseLike<{ data: T; error: any }>,
  what: string
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await op();
    if (!error) return data;
    const message = error.message ?? JSON.stringify(error);
    if (attempt >= 3 || !/rate limit exceeded|too_many_requests/i.test(message)) {
      throw new Error(`${what} failed: ${message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, msUntilNextMinute() + 2_000));
  }
}

const randomPhone = () =>
  `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;

/**
 * Creates uniquely-named entities for one test and deletes everything it
 * caused (bills, payments, lots, movements, cash book, ...) afterwards.
 * All entity names start with "E2E " so crashed runs can be swept later.
 */
export class TestData {
  farmerIds: string[] = [];
  productIds: string[] = [];
  supplierIds: string[] = [];

  constructor(public db: TestDb, public tag: string) {}

  async createFarmer(overrides: Record<string, unknown> = {}) {
    const row = await unwrap(
      () =>
        this.db.client
          .from('farmers')
          .insert({
            dealer_id: this.db.dealerId,
            branch_id: this.db.branchId,
            name: `E2E Farmer ${this.tag}`,
            phone: randomPhone(),
            village: 'E2E Village',
            crop_status: 'growing',
            risk_status: 'reliable',
            credit_limit: 1_000_000,
            total_due: 0,
            is_active: true,
            ...overrides,
          })
          .select()
          .single(),
      'farmers insert'
    );
    this.farmerIds.push(row.id);
    return row;
  }

  async createProduct(overrides: Record<string, unknown> = {}) {
    const row = await unwrap(
      () =>
        this.db.client
          .from('products')
          .insert({
            dealer_id: this.db.dealerId,
            name: `E2E Feed ${this.tag}`,
            type: 'feed',
            unit: 'bag',
            gst_rate: 0,
            is_active: true,
            ...overrides,
          })
          .select()
          .single(),
      'products insert'
    );
    this.productIds.push(row.id);
    return row;
  }

  async createSupplier(overrides: Record<string, unknown> = {}) {
    const row = await unwrap(
      () =>
        this.db.client
          .from('suppliers')
          .insert({
            dealer_id: this.db.dealerId,
            name: `E2E Supplier ${this.tag}`,
            company: 'E2E Feeds Pvt Ltd',
            phone: randomPhone(),
            ...overrides,
          })
          .select()
          .single(),
      'suppliers insert'
    );
    this.supplierIds.push(row.id);
    return row;
  }

  /** Seeds stock through the same RPC the app uses (paid in cash). */
  async seedStock(args: {
    productId: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    mrp?: number;
  }) {
    return unwrap<any>(
      () =>
        this.db.client.rpc('record_stock_purchase_v2', {
          p_payload: {
            dealer_id: this.db.dealerId,
            branch_id: this.db.branchId,
            product_id: args.productId,
            quantity: args.quantity,
            cost_price_per_unit: args.costPrice,
            selling_price: args.sellingPrice,
            mrp: args.mrp ?? args.sellingPrice,
            gst_amount: 0,
            total_amount: args.quantity * args.costPrice,
            is_paid: true,
            payment_method: 'cash',
          },
        }),
      'record_stock_purchase_v2'
    );
  }

  /** Seeds a fully-credit bill through create_bill_v2 (for payment tests). */
  async createCreditBill(args: {
    farmerId: string;
    inventoryId: string;
    productId: string;
    productName: string;
    quantity: number;
    billDate: string; // YYYY-MM-DD
  }) {
    return unwrap<any>(
      () =>
        this.db.client.rpc('create_bill_v2', {
          p_payload: {
            dealer_id: this.db.dealerId,
            branch_id: this.db.branchId,
            farmer_id: args.farmerId,
            bill_date: args.billDate,
            amount_paid: 0,
            payment_type: null,
            items: [
              {
                inventory_id: args.inventoryId,
                product_id: args.productId,
                product_name: args.productName,
                quantity: args.quantity,
                unit_price: 0, // FIFO pricing uses the lot's final price
                discount_percentage: 0,
                gst_rate: 0,
              },
            ],
          },
        }),
      'create_bill_v2'
    );
  }

  // ---- read helpers -------------------------------------------------------

  async getFarmer(id: string) {
    return unwrap(
      () => this.db.client.from('farmers').select('*').eq('id', id).single(),
      'farmers select'
    );
  }

  async getSupplier(id: string) {
    return unwrap(
      () => this.db.client.from('suppliers').select('*').eq('id', id).single(),
      'suppliers select'
    );
  }

  async getInventoryByProduct(productId: string) {
    return unwrap(
      () =>
        this.db.client
          .from('inventory')
          .select('*')
          .eq('dealer_id', this.db.dealerId)
          .eq('product_id', productId)
          .maybeSingle(),
      'inventory select'
    );
  }

  async getBills(farmerId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('bills')
          .select('*, bill_items(*)')
          .eq('dealer_id', this.db.dealerId)
          .eq('farmer_id', farmerId)
          .order('bill_date', { ascending: true })
          .order('created_at', { ascending: true }),
      'bills select'
    );
  }

  async getPayments(farmerId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('payments')
          .select('*')
          .eq('dealer_id', this.db.dealerId)
          .eq('farmer_id', farmerId)
          .order('created_at', { ascending: true }),
      'payments select'
    );
  }

  async getAllocations(paymentId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('payment_allocations')
          .select('*')
          .eq('payment_id', paymentId)
          .order('allocation_order', { ascending: true }),
      'payment_allocations select'
    );
  }

  async getCashBookByReference(referenceId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('cash_book')
          .select('*')
          .eq('dealer_id', this.db.dealerId)
          .eq('reference_id', referenceId),
      'cash_book select'
    );
  }

  async getStockPurchases(productId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('stock_purchases')
          .select('*')
          .eq('dealer_id', this.db.dealerId)
          .eq('product_id', productId),
      'stock_purchases select'
    );
  }

  async getLots(inventoryId: string) {
    return unwrap<any[]>(
      () =>
        this.db.client
          .from('inventory_lots')
          .select('*')
          .eq('inventory_id', inventoryId)
          .order('received_at', { ascending: true }),
      'inventory_lots select'
    );
  }

  // ---- cleanup ------------------------------------------------------------

  /** Deletes everything reachable from the tracked farmers/products/suppliers,
   *  in FK-safe order. Safe to call multiple times.
   *
   *  NOTE: until migration 20260710000010_fix_rate_limit_delete_noop.sql is
   *  applied, the enforce_rate_limit trigger silently cancels every hard
   *  delete on bills/payments/farmers/inventory/cash_book (BEFORE DELETE
   *  trigger returning NEW = NULL). Rows that survive their delete are
   *  soft-neutralised instead so reruns stay clean and assertions (all keyed
   *  on per-run farmer/product ids) are unaffected. */
  async cleanup() {
    const c = this.db.client;

    const ids = async (table: string, column: string, values: string[]) => {
      if (!values.length) return [] as string[];
      const rows = await unwrap<any[]>(
        () => c.from(table).select('id').in(column, values),
        `${table} select for cleanup`
      );
      return rows.map((r) => r.id as string);
    };

    const del = async (table: string, column: string, values: string[]) => {
      if (!values.length) return;
      await unwrap(
        () => c.from(table).delete().in(column, values).select('id'),
        `${table} delete`
      );
    };

    const softUpdate = async (
      table: string,
      values: string[],
      patch: Record<string, unknown>
    ) => {
      if (!values.length) return;
      await unwrap(
        () => c.from(table).update(patch).in('id', values).select('id'),
        `${table} soft-neutralise`
      );
    };

    const billIds = await ids('bills', 'farmer_id', this.farmerIds);
    const paymentIds = await ids('payments', 'farmer_id', this.farmerIds);
    const inventoryIds = await ids('inventory', 'product_id', this.productIds);
    const purchaseIds = await ids('stock_purchases', 'product_id', this.productIds);

    await del('payment_allocations', 'payment_id', paymentIds);
    await del('payments', 'id', paymentIds);
    await del('cash_book', 'reference_id', [...paymentIds, ...purchaseIds]);
    await del('bill_item_lot_allocations', 'bill_id', billIds);
    await del('inventory_movements', 'inventory_id', inventoryIds);
    await del('bill_signatures', 'bill_id', billIds);
    await del('bill_items', 'bill_id', billIds);
    await del('bills', 'id', billIds);
    await del('inventory_lots', 'inventory_id', inventoryIds);
    await del('stock_purchases', 'id', purchaseIds);
    await del('inventory', 'id', inventoryIds);
    await del('farmers', 'id', this.farmerIds);
    await del('suppliers', 'id', this.supplierIds);

    // Soft-neutralise rows the trigger refused to delete (see NOTE above).
    // UPDATEs pass through the trigger fine.
    await softUpdate('bills', await ids('bills', 'id', billIds), {
      deleted_at: new Date().toISOString(),
    });
    await softUpdate('farmers', await ids('farmers', 'id', this.farmerIds), {
      is_active: false,
      total_due: 0,
    });
    const stuckInventory = await ids('inventory', 'id', inventoryIds);
    await softUpdate('inventory', stuckInventory, { quantity_in_stock: 0 });

    if (stuckInventory.length) {
      // inventory rows survive → products are still referenced; disable them.
      await softUpdate('products', this.productIds, { is_active: false });
    } else {
      await del('products', 'id', this.productIds);
    }

    this.farmerIds = [];
    this.productIds = [];
    this.supplierIds = [];
  }
}

/**
 * Removes leftovers from crashed runs (anything named "E2E ...").
 * Rows already soft-neutralised (is_active=false) are skipped so the sweep
 * doesn't burn rate-limit budget on deletes the trigger bug blocks anyway;
 * once migration 20260710000010 is applied they can be purged manually.
 */
export async function sweepStaleE2EData(db: TestDb) {
  const like = async (table: string, activeColumn?: string) => {
    let query = db.client
      .from(table)
      .select('id')
      .eq('dealer_id', db.dealerId)
      .like('name', 'E2E %');
    if (activeColumn) query = query.eq(activeColumn, true);
    const { data } = await query;
    return (data ?? []).map((r: any) => r.id as string);
  };

  const sweep = new TestData(db, 'sweep');
  sweep.farmerIds = await like('farmers', 'is_active');
  sweep.productIds = await like('products', 'is_active');
  sweep.supplierIds = await like('suppliers');
  if (sweep.farmerIds.length || sweep.productIds.length || sweep.supplierIds.length) {
    await sweep.cleanup();
  }
}
