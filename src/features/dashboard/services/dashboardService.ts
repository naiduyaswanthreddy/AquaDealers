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
    .eq('status', 'active');

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
    .eq('status', 'active');

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
 * Get Total Outstanding Dues: sum of farmers.total_due
 */
export async function getTotalDues(dealerId: string, branchId?: string | null): Promise<number> {
  let query = supabase
    .from('farmers')
    .select('total_due')
    .eq('dealer_id', dealerId)
    .eq('is_active', true);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.reduce((sum, item) => sum + Number(item.total_due), 0) ?? 0;
}

export async function getDuesSummary(
  dealerId: string,
  branchId?: string | null
): Promise<{ total: number; dueFarmersCount: number; series: number[] }> {
  let query = supabase
    .from('farmers')
    .select('total_due')
    .eq('dealer_id', dealerId)
    .eq('is_active', true);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const dueValues = (data ?? [])
    .map((item) => Number(item.total_due))
    .filter((value) => value > 0)
    .sort((a, b) => b - a);

  return {
    total: dueValues.reduce((sum, value) => sum + value, 0),
    dueFarmersCount: dueValues.length,
    series: dueValues.slice(0, 7).reverse(),
  };
}

/**
 * Get Low Stock Count: count of inventory where qty < min_stock_alert
 */
export async function getLowStockCount(dealerId: string, branchId?: string | null): Promise<number> {
  let query = supabase
    .from('inventory')
    .select('id, quantity_in_stock, min_stock_alert')
    .eq('dealer_id', dealerId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const lowStockItems = data?.filter(
    (item) => Number(item.quantity_in_stock) < Number(item.min_stock_alert)
  ) ?? [];

  return lowStockItems.length;
}

export async function getLowStockSummary(
  dealerId: string,
  branchId?: string | null
): Promise<{ lowStockCount: number; criticalLowStockCount: number; series: number[] }> {
  let query = supabase
    .from('inventory')
    .select('quantity_in_stock, min_stock_alert')
    .eq('dealer_id', dealerId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const shortages = (data ?? [])
    .map((item) => {
      const quantity = Number(item.quantity_in_stock);
      const minAlert = Number(item.min_stock_alert);

      if (quantity >= minAlert) return null;

      return {
        shortage: Math.max(minAlert - quantity, 0),
        isCritical: quantity <= 0 || (minAlert > 0 && quantity / minAlert <= 0.35),
      };
    })
    .filter((item): item is { shortage: number; isCritical: boolean } => item !== null)
    .sort((a, b) => b.shortage - a.shortage);

  return {
    lowStockCount: shortages.length,
    criticalLowStockCount: shortages.filter((item) => item.isCritical).length,
    series: shortages.slice(0, 7).map((item) => item.shortage).reverse(),
  };
}

/**
 * Get Cash in Hand: calculated from cash_book entries
 */
export async function getCashBalance(dealerId: string, branchId?: string | null): Promise<number> {
  let query = supabase
    .from('cash_book')
    .select('entry_type, amount')
    .eq('dealer_id', dealerId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (
    data?.reduce((balance, entry) => {
      const amt = Number(entry.amount);
      return entry.entry_type === 'income' ? balance + amt : balance - amt;
    }, 0) ?? 0
  );
}

export async function getCashSummary(
  dealerId: string,
  branchId?: string | null,
  days: number = 7
): Promise<{ currentBalance: number; previousBalance: number; series: number[] }> {
  let query = supabase
    .from('cash_book')
    .select('entry_type, amount, entry_date')
    .eq('dealer_id', dealerId)
    .order('entry_date', { ascending: true });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const dateLabels = getLastLocalDateStrings(days);
  const seriesStartDate = dateLabels[0];
  const yesterdayDate = shiftLocalDate(-1);
  const dailyNetMap = new Map<string, number>();

  let currentBalance = 0;
  let previousBalance = 0;
  let openingBalanceBeforeSeries = 0;

  for (const entry of data ?? []) {
    const amount = Number(entry.amount);
    const signedAmount = entry.entry_type === 'income' ? amount : -amount;
    const entryDate = entry.entry_date;

    currentBalance += signedAmount;

    if (entryDate <= yesterdayDate) {
      previousBalance += signedAmount;
    }

    if (entryDate < seriesStartDate) {
      openingBalanceBeforeSeries += signedAmount;
    } else if (entryDate >= seriesStartDate) {
      dailyNetMap.set(entryDate, (dailyNetMap.get(entryDate) ?? 0) + signedAmount);
    }
  }

  let runningBalance = openingBalanceBeforeSeries;
  const series = dateLabels.map((dateLabel) => {
    runningBalance += dailyNetMap.get(dateLabel) ?? 0;
    return runningBalance;
  });

  return {
    currentBalance,
    previousBalance,
    series,
  };
}

/**
 * Get Collect Today Farmers:
 * Query farmers where crop_status = 'harvested' and total_due > 0,
 * or where dues/aging are overdue (calculated from stocking date > 60 days). Limit 5.
 */
export async function getCollectTodayFarmers(dealerId: string, branchId?: string | null) {
  let query = supabase
    .from('farmers')
    .select('*')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .gt('total_due', 0);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
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
  let query = supabase
    .from('inventory')
    .select('*, products(*)')
    .eq('dealer_id', dealerId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (
    data
      ?.filter((item) => Number(item.quantity_in_stock) < Number(item.min_stock_alert))
      .map((item) => ({
        ...item,
        product: item.products,
      })) ?? []
  );
}

/**
 * Get Expiring Medicines: returns medicine inventory batches expiring within 30 days
 */
export async function getExpiringMedicines(dealerId: string, branchId?: string | null) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

  let query = supabase
    .from('inventory')
    .select('*, products(*)')
    .eq('dealer_id', dealerId)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', thirtyDaysStr);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter in memory to ensure they are medicines
  return (
    data
      ?.filter((item: any) => item.products?.type === 'medicine')
      .map((item) => ({
        ...item,
        product: item.products,
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
    .select('id, bill_number, bill_date, total, created_at, type, farmer_id, farmers(name)')
    .eq('dealer_id', dealerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (branchId) {
    billsQuery = billsQuery.eq('branch_id', branchId);
  }

  // 2. Fetch recent payments
  let paymentsQuery = supabase
    .from('payments')
    .select('id, amount, payment_date, created_at, farmer_id, farmers(name)')
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
  }));

  const formattedPayments = (payments ?? []).map((p: any) => ({
    id: p.id,
    type: 'payment',
    refNumber: 'PAYMENT',
    date: p.payment_date,
    createdAt: p.created_at,
    amount: Number(p.amount),
    farmerName: p.farmers?.name || 'Walk-in Farmer',
  }));

  // Combine, sort by created_at desc, and slice
  return [...formattedBills, ...formattedPayments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function getMonthlySalesTrend(dealerId: string, branchId?: string | null) {
  // Get date 30 days ago
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 29); // 30 days including today
  
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  let query = supabase
    .from('bills')
    .select('bill_date, total')
    .eq('dealer_id', dealerId)
    .eq('status', 'active')
    .gte('bill_date', startStr)
    .lte('bill_date', endStr);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totalsByDate = new Map<string, number>();
  
  // Initialize last 30 days with 0
  const series = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    totalsByDate.set(dStr, 0);
    series.push({ date: dStr, displayDate, amount: 0 });
  }

  for (const item of data ?? []) {
    const billDate = item.bill_date;
    if (totalsByDate.has(billDate)) {
      totalsByDate.set(billDate, totalsByDate.get(billDate)! + Number(item.total));
    }
  }

  return series.map(item => ({
    ...item,
    amount: totalsByDate.get(item.date) || 0
  }));
}

export async function getTopSoldProducts(dealerId: string, branchId?: string | null) {
  // Fetch top sold products from bill_items for the last 30 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startStr = startDate.toISOString().split('T')[0];

  let query = supabase
    .from('bill_items')
    .select(`
      quantity,
      product_id,
      products(name, type, unit),
      bills!inner(bill_date, status, dealer_id, branch_id)
    `)
    .eq('bills.dealer_id', dealerId)
    .eq('bills.status', 'active')
    .gte('bills.bill_date', startStr);

  if (branchId) {
    query = query.eq('bills.branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const productMap = new Map<string, any>();

  for (const item of data ?? []) {
    const pId = item.product_id;
    if (!pId || !item.products) continue;

    if (!productMap.has(pId)) {
      const prod = Array.isArray(item.products) ? item.products[0] : item.products;
      if (!prod) continue;
      productMap.set(pId, {
        id: pId,
        name: prod.name,
        type: prod.type,
        unit: prod.unit || 'units',
        quantity: 0
      });
    }
    const p = productMap.get(pId);
    p.quantity += Number(item.quantity || 0);
  }

  return Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // top 5
}
