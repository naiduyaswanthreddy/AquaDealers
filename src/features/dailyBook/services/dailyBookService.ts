import { supabase } from '@/lib/supabase';
import type { CashBookEntry, Expense } from '@/types/database';
import type {
  BookBill,
  BookCashLine,
  BookFarmerSummary,
  BookPayment,
  BookProductSummary,
  BookStockPositionRow,
  BookStockReceipt,
  DailyBook,
  FarmerDayView,
} from '../types';

const UPI_METHODS = new Set(['upi', 'gpay', 'phonepe', 'paytm']);
const CHEQUE_METHODS = new Set(['cheque', 'check']);

const normalizeMethod = (value?: string | null) => (value || '').trim().toLowerCase();

export const classifyMethod = (value?: string | null): 'cash' | 'upi' | 'cheque' | 'other' => {
  const method = normalizeMethod(value);
  if (!method || method === 'cash') return 'cash';
  if (UPI_METHODS.has(method)) return 'upi';
  if (CHEQUE_METHODS.has(method)) return 'cheque';
  return 'other';
};

const shiftDate = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const BILL_SELECT =
  '*, bill_items(*, products:product_id(name, type, unit)), farmers:farmer_id(name, village)';

function summarizeProducts(bills: BookBill[]): BookProductSummary[] {
  const map = new Map<string, BookProductSummary & { farmerKeys: Set<string>; unpaidBills: Set<string> }>();

  for (const bill of bills) {
    const farmerKey = bill.farmer_id || `walkin:${bill.id}`;
    for (const item of bill.bill_items || []) {
      const productId = item.product_id || `snapshot:${item.product_name_snapshot || 'unknown'}`;
      let entry = map.get(productId);
      if (!entry) {
        entry = {
          productId,
          name: item.products?.name || item.product_name_snapshot || 'Unknown product',
          type: (item.products?.type || 'other').toLowerCase(),
          unit: item.products?.unit || 'units',
          quantity: 0,
          farmerCount: 0,
          revenue: 0,
          billCount: 0,
          unpaidBillCount: 0,
          unpaidAmount: 0,
          farmerKeys: new Set<string>(),
          unpaidBills: new Set<string>(),
        };
        map.set(productId, entry);
      }
      entry.quantity += Number(item.quantity || 0);
      entry.revenue += Number(item.total_price || 0);
      entry.billCount += 1;
      entry.farmerKeys.add(farmerKey);
      if (Number(bill.balance_due || 0) > 0) {
        entry.unpaidBills.add(bill.id);
        entry.unpaidAmount += Number(bill.balance_due || 0);
      }
    }
  }

  return [...map.values()]
    .map(({ farmerKeys, unpaidBills, ...rest }) => ({
      ...rest,
      farmerCount: farmerKeys.size,
      unpaidBillCount: unpaidBills.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function summarizeFarmers(bills: BookBill[], farmerDues: Map<string, number>): BookFarmerSummary[] {
  const map = new Map<string, BookFarmerSummary>();

  for (const bill of bills) {
    const key = bill.farmer_id || `walkin:${bill.id}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        farmerId: bill.farmer_id,
        name: bill.farmers?.name || bill.farmer_name_snapshot || 'Walk-in customer',
        village: bill.farmers?.village || null,
        total: 0,
        billCount: 0,
        firstBillAt: bill.created_at,
        unpaidToday: 0,
        outstanding: bill.farmer_id ? farmerDues.get(bill.farmer_id) || 0 : 0,
      };
      map.set(key, entry);
    }
    entry.total += Number(bill.total || 0);
    entry.billCount += 1;
    entry.unpaidToday += Number(bill.balance_due || 0);
    if (bill.created_at < entry.firstBillAt) entry.firstBillAt = bill.created_at;
  }

  return [...map.values()].sort((a, b) => a.firstBillAt.localeCompare(b.firstBillAt));
}

function buildCashLines(
  entries: CashBookEntry[],
  paymentMethods: Map<string, string>,
  supplierPaymentMethods: Map<string, string>
): BookCashLine[] {
  return entries.map((entry) => {
    const rawMethod =
      (entry.reference_id ? paymentMethods.get(entry.reference_id) : null) ||
      (entry.reference_id ? supplierPaymentMethods.get(entry.reference_id) : null) ||
      'cash';
    return {
      id: entry.id,
      time: entry.created_at,
      label: entry.notes || entry.source || (entry.entry_type === 'income' ? 'Money in' : 'Money out'),
      amount: Number(entry.amount || 0),
      direction: entry.entry_type === 'income' ? 'in' : 'out',
      method: classifyMethod(rawMethod),
      source: entry.source,
      referenceId: entry.reference_id,
    };
  });
}

export const dailyBookService = {
  async getDailyBook(dealerId: string, branchId: string | null, date: string): Promise<DailyBook> {
    const branchFilter = <T extends { eq: (col: string, val: string) => T }>(query: T): T =>
      branchId ? query.eq('branch_id', branchId) : query;

    const yesterday = shiftDate(date, -1);

    const [
      billsRes,
      paymentsRes,
      expensesRes,
      purchasesRes,
      cashRes,
      supplierPaymentsRes,
      yesterdayRes,
      openingRes,
    ] = await Promise.all([
      branchFilter(
        supabase
          .from('bills')
          .select(BILL_SELECT)
          .eq('dealer_id', dealerId)
          .eq('bill_date', date)
          .neq('status', 'cancelled')
          .is('deleted_at', null)
          .order('created_at', { ascending: true }) as any
      ),
      branchFilter(
        supabase
          .from('payments')
          .select('id, farmer_id, bill_id, amount, method, payment_date, created_at, farmers:farmer_id(name)')
          .eq('dealer_id', dealerId)
          .eq('payment_date', date)
          .order('created_at', { ascending: true }) as any
      ),
      branchFilter(
        supabase
          .from('expenses')
          .select('*')
          .eq('dealer_id', dealerId)
          .eq('expense_date', date)
          .is('deleted_at', null)
          .order('created_at', { ascending: true }) as any
      ),
      branchFilter(
        supabase
          .from('stock_purchases')
          .select('id, product_id, quantity, total_amount, invoice_number, created_at, products:product_id(name, unit), suppliers:supplier_id(name)')
          .eq('dealer_id', dealerId)
          .eq('purchase_date', date)
          .order('created_at', { ascending: true }) as any
      ),
      branchFilter(
        supabase
          .from('cash_book')
          .select('*')
          .eq('dealer_id', dealerId)
          .eq('entry_date', date)
          .order('created_at', { ascending: true }) as any
      ),
      supabase
        .from('supplier_payments')
        .select('id, amount, method, payment_date')
        .eq('dealer_id', dealerId)
        .eq('payment_date', date),
      branchFilter(
        supabase
          .from('bills')
          .select('total')
          .eq('dealer_id', dealerId)
          .eq('bill_date', yesterday)
          .neq('status', 'cancelled')
          .is('deleted_at', null) as any
      ),
      branchFilter(
        supabase
          .from('cash_book')
          .select('amount, entry_type')
          .eq('dealer_id', dealerId)
          .lt('entry_date', date) as any
      ),
    ]);

    for (const res of [billsRes, paymentsRes, expensesRes, purchasesRes, cashRes, supplierPaymentsRes, yesterdayRes, openingRes]) {
      if ((res as any).error) throw (res as any).error;
    }

    const bills = ((billsRes as any).data || []) as BookBill[];
    const rawPayments = ((paymentsRes as any).data || []) as Omit<BookPayment, 'isSameDaySale'>[];
    const expenses = ((expensesRes as any).data || []) as Expense[];
    const stockReceipts = ((purchasesRes as any).data || []) as BookStockReceipt[];
    const cashEntries = ((cashRes as any).data || []) as CashBookEntry[];
    const supplierPayments = ((supplierPaymentsRes as any).data || []) as { id: string; amount: number; method: string | null }[];

    const todaysBillIds = new Set(bills.map((b) => b.id));
    const payments: BookPayment[] = rawPayments.map((p) => ({
      ...p,
      isSameDaySale: !!p.bill_id && todaysBillIds.has(p.bill_id),
    }));

    // Outstanding balances for the farmers who visited today.
    const farmerIds = [...new Set(bills.map((b) => b.farmer_id).filter(Boolean))] as string[];
    const farmerDues = new Map<string, number>();
    if (farmerIds.length) {
      const { data: farmerRows, error: farmerErr } = await supabase
        .from('farmers')
        .select('id, total_due')
        .eq('dealer_id', dealerId)
        .in('id', farmerIds);
      if (farmerErr) throw farmerErr;
      (farmerRows || []).forEach((f: any) => farmerDues.set(f.id, Number(f.total_due || 0)));
    }

    const paymentMethods = new Map(payments.map((p) => [p.id, p.method || 'cash']));
    const supplierPaymentMethods = new Map(supplierPayments.map((p) => [p.id, p.method || 'cash']));
    const cashLines = buildCashLines(cashEntries, paymentMethods, supplierPaymentMethods);

    const openingRows = ((openingRes as any).data || []) as { amount: number; entry_type: string }[];
    const openingCash = openingRows.reduce(
      (sum, row) => sum + (row.entry_type === 'income' ? Number(row.amount || 0) : -Number(row.amount || 0)),
      0
    );
    const dayCashMove = cashLines
      .filter((line) => line.method === 'cash')
      .reduce((sum, line) => sum + (line.direction === 'in' ? line.amount : -line.amount), 0);

    const salesTotal = bills.reduce((sum, b) => sum + Number(b.total || 0), 0);
    const creditBills = bills.filter((b) => Number(b.balance_due || 0) > 0);
    const cashSales = bills
      .filter((b) => classifyMethod(b.payment_type) === 'cash')
      .reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
    const upiSales = bills
      .filter((b) => classifyMethod(b.payment_type) === 'upi')
      .reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);
    const oldCollections = payments
      .filter((p) => !p.isSameDaySale)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      date,
      bills,
      payments,
      expenses,
      stockReceipts,
      cashEntries,
      cashLines,
      openingCash,
      closingCash: openingCash + dayCashMove,
      products: summarizeProducts(bills),
      farmers: summarizeFarmers(bills, farmerDues),
      totals: {
        billCount: bills.length,
        salesTotal,
        cashSales,
        upiSales,
        creditGiven: creditBills.reduce((sum, b) => sum + Number(b.balance_due || 0), 0),
        creditFarmers: new Set(creditBills.map((b) => b.farmer_id || b.id)).size,
        receivedTotal: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        oldCollections,
        expensesTotal: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        supplierPaid: supplierPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
        yesterdaySales: (((yesterdayRes as any).data || []) as { total: number }[]).reduce(
          (sum, b) => sum + Number(b.total || 0),
          0
        ),
      },
    };
  },

  async getFarmerDayView(dealerId: string, farmerId: string, date: string): Promise<FarmerDayView> {
    const [farmerRes, todayRes, recentRes] = await Promise.all([
      supabase
        .from('farmers')
        .select('id, name, village, pond_acres, risk_status, total_due, phone')
        .eq('dealer_id', dealerId)
        .eq('id', farmerId)
        .single(),
      supabase
        .from('bills')
        .select(BILL_SELECT)
        .eq('dealer_id', dealerId)
        .eq('farmer_id', farmerId)
        .eq('bill_date', date)
        .neq('status', 'cancelled')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('bills')
        .select(BILL_SELECT)
        .eq('dealer_id', dealerId)
        .eq('farmer_id', farmerId)
        .lt('bill_date', date)
        .neq('status', 'cancelled')
        .is('deleted_at', null)
        .order('bill_date', { ascending: false })
        .limit(5),
    ]);

    if (farmerRes.error) throw farmerRes.error;
    if (todayRes.error) throw todayRes.error;
    if (recentRes.error) throw recentRes.error;

    return {
      farmer: farmerRes.data as FarmerDayView['farmer'],
      todayBills: (todayRes.data || []) as BookBill[],
      recentBills: (recentRes.data || []) as BookBill[],
    };
  },

  /**
   * Opening / sold / received / closing per product for one day, on BUSINESS
   * dates (bill_date / purchase_date) so it always agrees with the rest of the
   * book — a historical bill entered later still lands on the day it belongs to.
   *   sold(D)     = bill_items on bills with bill_date = D
   *   received(D) = stock_purchases with purchase_date = D
   *   closing(D)  = current stock + sold after D − received after D
   *                 − manual adjustments recorded after D
   *   opening(D)  = closing(D) − received(D) + sold(D)
   */
  async getStockPosition(
    dealerId: string,
    branchId: string | null,
    date: string
  ): Promise<BookStockPositionRow[]> {
    const nextMidnight = new Date(`${date}T00:00:00`);
    nextMidnight.setDate(nextMidnight.getDate() + 1);

    // PostgREST caps a single response at 1000 rows; truncation would silently
    // corrupt counts, so every list below is paged to completion.
    const PAGE = 1000;
    const fetchAll = async <T>(
      build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
    ): Promise<T[]> => {
      const out: T[] = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await build(offset, offset + PAGE - 1);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < PAGE) return out;
      }
    };

    let inventoryQuery = supabase
      .from('inventory')
      .select('id, product_id, quantity_in_stock, products:product_id(name, unit)')
      .eq('dealer_id', dealerId);
    if (branchId) inventoryQuery = inventoryQuery.eq('branch_id', branchId);
    const inventoryRes = await inventoryQuery;
    if (inventoryRes.error) throw inventoryRes.error;
    const inventoryRows = (inventoryRes.data || []) as any[];

    // One accumulator per product; "all branches" view merges branch rows.
    const acc = new Map<
      string,
      {
        inventoryId: string;
        name: string;
        unit: string;
        current: number;
        soldToday: number;
        receivedToday: number;
        soldAfter: number;
        receivedAfter: number;
        adjustedAfter: number;
      }
    >();
    const productByInventoryId = new Map<string, string>();
    for (const item of inventoryRows) {
      productByInventoryId.set(item.id, item.product_id);
      const existing = acc.get(item.product_id);
      if (existing) {
        existing.current += Number(item.quantity_in_stock || 0);
      } else {
        acc.set(item.product_id, {
          inventoryId: item.id,
          name: item.products?.name || 'Product',
          unit: item.products?.unit || 'units',
          current: Number(item.quantity_in_stock || 0),
          soldToday: 0,
          receivedToday: 0,
          soldAfter: 0,
          receivedAfter: 0,
          adjustedAfter: 0,
        });
      }
    }

    const [bills, purchases, adjustments] = await Promise.all([
      fetchAll<{ bill_date: string; bill_items: { product_id: string | null; quantity: number }[] | null }>(
        (from, to) => {
          let q = supabase
            .from('bills')
            .select('bill_date, bill_items(product_id, quantity)')
            .eq('dealer_id', dealerId)
            .gte('bill_date', date)
            .neq('status', 'cancelled')
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .range(from, to);
          if (branchId) q = q.eq('branch_id', branchId);
          return q as any;
        }
      ),
      fetchAll<{ purchase_date: string; product_id: string; quantity: number }>((from, to) => {
        let q = supabase
          .from('stock_purchases')
          .select('purchase_date, product_id, quantity')
          .eq('dealer_id', dealerId)
          .gte('purchase_date', date)
          .order('created_at', { ascending: true })
          .range(from, to);
        if (branchId) q = q.eq('branch_id', branchId);
        return q as any;
      }),
      // Manual adjustments / expiry / initial stock have no business date, so
      // they are classified by when they were recorded. Bill and purchase
      // movements are excluded — those are already counted by business date.
      fetchAll<{ inventory_id: string; quantity_change: number }>(
        (from, to) =>
          supabase
            .from('inventory_movements')
            .select('inventory_id, quantity_change')
            .eq('dealer_id', dealerId)
            .gte('created_at', nextMidnight.toISOString())
            .not('reference_type', 'in', '("bill","bill_cancellation","purchase")')
            .order('created_at', { ascending: true })
            .range(from, to) as any
      ),
    ]);

    for (const bill of bills) {
      for (const item of bill.bill_items || []) {
        if (!item.product_id) continue;
        const entry = acc.get(item.product_id);
        if (!entry) continue;
        const qty = Number(item.quantity || 0);
        if (bill.bill_date === date) entry.soldToday += qty;
        else entry.soldAfter += qty;
      }
    }

    for (const purchase of purchases) {
      const entry = acc.get(purchase.product_id);
      if (!entry) continue;
      const qty = Number(purchase.quantity || 0);
      if (purchase.purchase_date === date) entry.receivedToday += qty;
      else entry.receivedAfter += qty;
    }

    for (const move of adjustments) {
      // Attribute through the inventory row so branch scoping is respected even
      // when the movement's own branch_id is missing.
      const productId = productByInventoryId.get(move.inventory_id);
      if (!productId) continue;
      const entry = acc.get(productId);
      if (!entry) continue;
      entry.adjustedAfter += Number(move.quantity_change || 0);
    }

    const round2 = (value: number) => Math.round(value * 100) / 100;
    return [...acc.entries()]
      .map(([productId, e]) => {
        const closing = e.current + e.soldAfter - e.receivedAfter - e.adjustedAfter;
        return {
          inventoryId: e.inventoryId,
          productId,
          name: e.name,
          unit: e.unit,
          opening: round2(closing - e.receivedToday + e.soldToday),
          sold: round2(e.soldToday),
          received: round2(e.receivedToday),
          closing: round2(closing),
        };
      })
      .sort((a, b) => {
        // Products that moved on this day (sold or received) come first.
        const aMoved = a.sold + a.received > 0 ? 1 : 0;
        const bMoved = b.sold + b.received > 0 ? 1 : 0;
        if (aMoved !== bMoved) return bMoved - aMoved;
        if (a.sold !== b.sold) return b.sold - a.sold;
        if (a.received !== b.received) return b.received - a.received;
        return a.name.localeCompare(b.name);
      });
  },

  async getBill(dealerId: string, billId: string): Promise<BookBill> {
    const { data, error } = await supabase
      .from('bills')
      .select(BILL_SELECT)
      .eq('dealer_id', dealerId)
      .eq('id', billId)
      .single();

    if (error) throw error;
    return data as BookBill;
  },
};
