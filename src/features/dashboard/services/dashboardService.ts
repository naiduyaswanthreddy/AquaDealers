import { supabase } from '@/lib/supabase';
import { differenceInDays, parseISO } from 'date-fns';

/**
 * Format a date object as a YYYY-MM-DD string in local time
 */
function getLocalDateString(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

function shiftLocalDate(days: number, baseDate: Date = new Date()): string {
  const shiftedDate = new Date(baseDate);
  shiftedDate.setDate(shiftedDate.getDate() + days);
  return getLocalDateString(shiftedDate);
}

function getLastLocalDateStrings(days: number, baseDate: Date = new Date()): string[] {
  return Array.from({ length: days }, (_, index) => shiftLocalDate(index - (days - 1), baseDate));
}

/**
 * Get Today's Sales: sum of bills.total where bill_date = today
 */
export async function getTodaySales(dealerId: string, branchId?: string | null): Promise<{ sales: number, credit: number, count: number }> {
  const todayStr = getLocalDateString();
  let query = supabase
    .from('bills')
    .select('total, balance_due')
    .eq('dealer_id', dealerId)
    .eq('bill_date', todayStr)
    .eq('status', 'active')
    .eq('is_estimate', false);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const sales = data?.reduce((sum, item) => sum + Number(item.total), 0) ?? 0;
  const credit = data?.reduce((sum, item) => sum + Number(item.balance_due), 0) ?? 0;
  const count = data?.length ?? 0;

  return { sales, credit, count };
}

export async function getPaymentSplitForDate(
  dealerId: string,
  dateStr: string,
  branchId?: string | null
): Promise<{ cash: number; upi: number; cheque: number; other: number }> {
  let query = supabase
    .from('payments')
    .select('amount, method')
    .eq('dealer_id', dealerId)
    .eq('payment_date', dateStr);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).reduce(
    (totals, payment) => {
      const method = (payment.method || 'cash').toLowerCase();
      const amount = Number(payment.amount || 0);

      if (method === 'cash') totals.cash += amount;
      else if (['upi', 'gpay', 'phonepe', 'paytm'].includes(method)) totals.upi += amount;
      else if (['cheque', 'check'].includes(method)) totals.cheque += amount;
      else totals.other += amount;

      return totals;
    },
    { cash: 0, upi: 0, cheque: 0, other: 0 }
  );
}

export async function getSalesSummaryForDate(
  dealerId: string,
  dateStr: string,
  branchId?: string | null
): Promise<{ sales: number; credit: number; count: number }> {
  let query = supabase
    .from('bills')
    .select('total, balance_due')
    .eq('dealer_id', dealerId)
    .eq('bill_date', dateStr)
    .eq('status', 'active')
    .eq('is_estimate', false);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    sales: data?.reduce((sum, item) => sum + Number(item.total), 0) ?? 0,
    credit: data?.reduce((sum, item) => sum + Number(item.balance_due), 0) ?? 0,
    count: data?.length ?? 0,
  };
}

export async function getSalesSeries(
  dealerId: string,
  branchId?: string | null,
  days: number = 7
): Promise<number[]> {
  const dateLabels = getLastLocalDateStrings(days);
  const startDate = dateLabels[0];

  let query = supabase
    .from('bills')
    .select('bill_date, total')
    .eq('dealer_id', dealerId)
    .eq('status', 'active')
    .eq('is_estimate', false)
    .gte('bill_date', startDate);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totalsByDate = new Map<string, number>();

  for (const item of data ?? []) {
    const billDate = item.bill_date;
    totalsByDate.set(billDate, (totalsByDate.get(billDate) ?? 0) + Number(item.total));
  }

  return dateLabels.map((dateLabel) => totalsByDate.get(dateLabel) ?? 0);
}

/**
 * Get Total Outstanding Dues — uses simple select to avoid PostgREST aggregate
 * function syntax which is version-dependent. Computes sum client-side from
 * the paginated result (limit 1000 to stay fast for most dealer sizes).
 */
export async function getTotalDues(dealerId: string, branchId?: string | null): Promise<number> {
  let query = supabase
    .from('farmers')
    .select('total_due')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .gt('total_due', 0)
    .limit(1000);

  // Farmers are dealer-scoped (shared across branches) — no branch filter.
  void branchId;

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).reduce((sum, f) => sum + Number(f.total_due ?? 0), 0);
}

export async function getDuesSummary(
  dealerId: string,
  branchId?: string | null
): Promise<{ total: number; dueFarmersCount: number; series: number[] }> {
  void branchId;

  const [
    { data: allDues, error },
    { count, error: countErr },
  ] = await Promise.all([
    // Fetch ALL farmers with dues for an accurate total sum
    supabase
      .from('farmers')
      .select('total_due')
      .eq('dealer_id', dealerId)
      .eq('is_active', true)
      .gt('total_due', 0)
      .order('total_due', { ascending: false })
      .limit(10000),
    supabase
      .from('farmers')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', dealerId)
      .eq('is_active', true)
      .gt('total_due', 0),
  ]);

  if (error) throw error;
  if (countErr) throw countErr;

  const values = (allDues ?? []).map(item => Number(item.total_due ?? 0));
  // Sum all for the accurate total
  const total = values.reduce((sum, v) => sum + v, 0);
  // Use only top 8 values (already sorted desc) for sparkline
  const series = values.slice(0, 8).reverse();

  return { total, dueFarmersCount: count ?? values.length, series };
}

/**
 * Get Low Stock Count — server-side filtered COUNT, no full inventory scan.
 */
export async function getLowStockCount(dealerId: string, branchId?: string | null): Promise<number> {
  const { data, error } = await supabase.rpc('get_low_stock_count', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function getLowStockSummary(
  dealerId: string,
  branchId?: string | null
): Promise<{ lowStockCount: number; criticalLowStockCount: number; series: number[] }> {
  const { data, error } = await supabase.rpc('get_low_stock_summary', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
    p_limit: 500,
  });
  if (error) throw error;

  const shortages = ((data as { quantity_in_stock: number; min_stock_alert: number }[]) ?? []).map((item) => {
    const quantity = Number(item.quantity_in_stock);
    const minAlert = Number(item.min_stock_alert);
    return {
      shortage: Math.max(minAlert - quantity, 0),
      isCritical: quantity <= 0 || (minAlert > 0 && quantity / minAlert <= 0.35),
    };
  });

  return {
    lowStockCount: shortages.length,
    criticalLowStockCount: shortages.filter((item) => item.isCritical).length,
    series: shortages.slice(0, 7).map((item) => item.shortage).reverse(),
  };
}

/**
 * Get Cash in Hand — uses the existing RPC for server-side aggregation.
 * Avoids fetching all cash_book rows just to SUM them client-side.
 */
export async function getCashBalance(dealerId: string, branchId?: string | null): Promise<number> {
  const today = getLocalDateString();
  const { data, error } = await supabase.rpc('get_cash_summary_rpc', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
    p_days: 1,
    p_end_date: today,
  });
  if (error) throw error;
  return Number((data as any)?.currentBalance ?? 0);
}

export async function getCashSummary(
  dealerId: string,
  branchId?: string | null,
  days: number = 7
): Promise<{ currentBalance: number; previousBalance: number; series: number[] }> {
  // ponytail: 90-day rolling window. Opening balance before cutoff comes from RPC;
  // only the window rows are fetched, so this stays O(window) not O(all-time).
  const cutoffDate = shiftLocalDate(-90);
  const dateLabels = getLastLocalDateStrings(days);
  const seriesStartDate = dateLabels[0];
  const yesterdayDate = shiftLocalDate(-1);

  let query = supabase
    .from('cash_book')
    .select('entry_type, amount, entry_date')
    .eq('dealer_id', dealerId)
    .gte('entry_date', cutoffDate)
    .order('entry_date', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const [{ data, error }, { data: obData, error: obErr }] = await Promise.all([
    query,
    supabase.rpc('get_cash_book_opening_balance_v1', {
      p_dealer_id: dealerId,
      p_branch_id: branchId ?? null,
      p_before_date: cutoffDate,
    }),
  ]);

  if (error) throw error;
  if (obErr) throw obErr;

  const openingAtCutoff = Number(obData ?? 0);
  const dailyNetMap = new Map<string, number>();

  let balanceSinceCutoff = 0;
  let balanceUpToYesterday = 0;
  let openingBalanceBeforeSeries = 0;

  for (const entry of data ?? []) {
    const amount = Number(entry.amount);
    const signedAmount = entry.entry_type === 'income' ? amount : -amount;
    const entryDate = entry.entry_date;

    balanceSinceCutoff += signedAmount;
    if (entryDate <= yesterdayDate) balanceUpToYesterday += signedAmount;
    if (entryDate < seriesStartDate) {
      openingBalanceBeforeSeries += signedAmount;
    } else {
      dailyNetMap.set(entryDate, (dailyNetMap.get(entryDate) ?? 0) + signedAmount);
    }
  }

  let runningBalance = openingAtCutoff + openingBalanceBeforeSeries;
  const series = dateLabels.map((dateLabel) => {
    runningBalance += dailyNetMap.get(dateLabel) ?? 0;
    return runningBalance;
  });

  return {
    currentBalance: openingAtCutoff + balanceSinceCutoff,
    previousBalance: openingAtCutoff + balanceUpToYesterday,
    series,
  };
}

/**
 * Get Collect Today Farmers:
 * Query farmers where crop_status = 'harvested' and total_due > 0,
 * or where dues/aging are overdue (calculated from stocking date > 60 days). Limit 5.
 */
export async function getCollectTodayFarmers(dealerId: string, branchId?: string | null) {
  void branchId; // Farmers are shared across branches — no branch filter.
  const { data, error } = await supabase
    .from('farmers')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .gt('total_due', 0)
    // ponytail: 200-row cap; client-side sorts then slices to 5. Raise if dealers
    // routinely have > 200 farmers due simultaneously and some harvesteds are missed.
    .limit(200);
  if (error) throw error;

  const today = new Date();

  const filtered = (data ?? [])
    .filter((f) => {
      if (f.crop_status === 'failed') return false;
      const overLimit = Number(f.credit_limit || 0) > 0 && Number(f.total_due || 0) > Number(f.credit_limit || 0);
      if (f.crop_status === 'harvested') return true;
      if (overLimit) return true;
      if (f.stocking_date) {
        try {
          const days = differenceInDays(today, parseISO(f.stocking_date));
          return days > 60;
        } catch (err) {
          console.warn('Invalid stocking_date for farmer:', f.id);
          return false;
        }
      }
      return false;
    })
    .sort((a, b) => {
      const aOverLimit = Number(a.credit_limit || 0) > 0 && Number(a.total_due || 0) > Number(a.credit_limit || 0);
      const bOverLimit = Number(b.credit_limit || 0) > 0 && Number(b.total_due || 0) > Number(b.credit_limit || 0);

      if (a.crop_status === 'harvested' && b.crop_status !== 'harvested') return -1;
      if (b.crop_status === 'harvested' && a.crop_status !== 'harvested') return 1;
      if (aOverLimit && !bOverLimit) return -1;
      if (bOverLimit && !aOverLimit) return 1;
      return Number(b.total_due || 0) - Number(a.total_due || 0);
    })
    .slice(0, 5);

  return filtered;
}

/**
 * Get Low Stock items: returns full list of inventory items with product info below min stock
 */
export async function getLowStockItems(dealerId: string, branchId?: string | null) {
  const { data, error } = await supabase.rpc('get_low_stock_inventory', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
    p_limit: 50,
  });
  if (error) throw error;

  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
  const { data: products } = await supabase.from('products').select('*').in('id', productIds);
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  return rows.map((item: any) => ({ ...item, product: productMap.get(item.product_id) ?? null }));
}


/**
 * Get Expiring Medicines: returns medicine inventory batches expiring within 30 days
 */
export async function getExpiringMedicines(dealerId: string, branchId?: string | null) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

  // Query inventory_lots instead of inventory to get per-lot expiries
  let query = supabase
    .from('inventory_lots')
    .select('*, inventory(*, products(*))')
    .eq('dealer_id', dealerId)
    .gt('remaining_quantity', 0)
    .eq('is_expired', false)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', thirtyDaysStr)
    .order('expiry_date', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter in memory to ensure they are medicines
  return (
    data
      ?.filter((lot: any) => lot.inventory?.products?.type === 'medicine')
      .map((lot: any) => ({
        ...lot.inventory,
        id: lot.id, // Use lot ID as the unique key to prevent React key conflicts if multiple lots expire for same product
        inventory_id: lot.inventory.id,
        product: lot.inventory.products,
        // Override legacy expiry_date with the specific lot's expiry
        expiry_date: lot.expiry_date,
        batch_number: lot.batch_number,
        remaining_quantity: lot.remaining_quantity,
      })) ?? []
  );
}

/**
 * Get Recent Transactions: Combined last N bills and payments
 */
export async function getRecentTransactions(
  dealerId: string,
  branchId?: string | null,
  limit: number = 8
) {
  // 1. Fetch recent bills
  let billsQuery = supabase
    .from('bills')
    .select('id, bill_number, bill_date, total, created_at, type, farmer_id, branch_name_snapshot, farmers(name)')
    .eq('dealer_id', dealerId)
    .eq('status', 'active')
    .eq('is_estimate', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (branchId) {
    billsQuery = billsQuery.eq('branch_id', branchId);
  }

  // 2. Fetch recent payments
  let paymentsQuery = supabase
    .from('payments')
    .select('id, amount, payment_date, created_at, farmer_id, branch_name_snapshot, farmers(name)')
    .eq('dealer_id', dealerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (branchId) {
    paymentsQuery = paymentsQuery.eq('branch_id', branchId);
  }

  const [{ data: bills, error: billsErr }, { data: payments, error: paymentsErr }] =
    await Promise.all([billsQuery, paymentsQuery]);

  if (billsErr) throw billsErr;
  if (paymentsErr) throw paymentsErr;

  // 3. Format and combine
  const formattedBills = (bills ?? []).map((b: any) => ({
    id: b.id,
    type: b.type === 'adjustment' ? 'adjustment' : 'bill',
    refNumber: b.bill_number,
    date: b.bill_date,
    createdAt: b.created_at,
    amount: Number(b.total),
    farmerName: b.farmers?.name || 'Walk-in Farmer',
    branchName: b.branch_name_snapshot ?? null,
  }));

  const formattedPayments = (payments ?? []).map((p: any) => ({
    id: p.id,
    type: 'payment',
    refNumber: 'PAYMENT',
    date: p.payment_date,
    createdAt: p.created_at,
    amount: Number(p.amount),
    farmerName: p.farmers?.name || 'Walk-in Farmer',
    branchName: p.branch_name_snapshot ?? null,
  }));

  // Combine, sort by created_at desc, and slice
  return [...formattedBills, ...formattedPayments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function getMonthlySalesTrend(
  dealerId: string,
  branchId?: string | null,
  startDate?: string,
  endDate?: string
) {
  const today = getLocalDateString();
  const endStr = endDate ?? today;
  // Build date labels for the requested range (up to 90 days max)
  const startStr = startDate ?? shiftLocalDate(-29, new Date(`${endStr}T12:00:00`));
  const start = new Date(`${startStr}T12:00:00`);
  const end = new Date(`${endStr}T12:00:00`);
  const dayCount = Math.min(Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1, 90);
  const dateLabels = Array.from({ length: dayCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return getLocalDateString(d);
  });

  let query = supabase
    .from('bills')
    .select('bill_date, total')
    .eq('dealer_id', dealerId)
    .eq('status', 'active')
    .eq('is_estimate', false)
    .gte('bill_date', startStr)
    .lte('bill_date', endStr);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totalsByDate = new Map<string, number>();
  const series = dateLabels.map((dStr) => {
    totalsByDate.set(dStr, 0);
    const d = new Date(`${dStr}T12:00:00`);
    return { date: dStr, displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amount: 0 };
  });

  for (const item of data ?? []) {
    if (totalsByDate.has(item.bill_date)) {
      totalsByDate.set(item.bill_date, totalsByDate.get(item.bill_date)! + Number(item.total));
    }
  }

  return series.map((item) => ({ ...item, amount: totalsByDate.get(item.date) || 0 }));
}

export async function getTopSoldProducts(dealerId: string, branchId?: string | null) {
  const startStr = shiftLocalDate(-30);
  const { data, error } = await supabase.rpc('get_top_sold_products_v1', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
    p_start_date: startStr,
    p_limit: 5,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.product_id,
    name: row.product_name,
    type: row.product_type,
    unit: row.unit || 'units',
    quantity: Number(row.total_qty),
  }));
}

export async function getTopCustomers(dealerId: string, branchId?: string | null) {
  let query = supabase
    .from('farmers')
    .select('id, name, total_due, village')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .gt('total_due', 0)
    .order('total_due', { ascending: false })
    .limit(5);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; total_due: number; village: string | null }[];
}

export async function getTodaySoldItems(dealerId: string, branchId?: string | null) {
  const todayStr = getLocalDateString();
  const { data, error } = await supabase.rpc('get_today_sold_items_v1', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
    p_date: todayStr,
  });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.product_id,
    name: row.product_name,
    type: row.product_type,
    unit: row.unit || 'units',
    quantity: Number(row.total_qty),
  }));
}
