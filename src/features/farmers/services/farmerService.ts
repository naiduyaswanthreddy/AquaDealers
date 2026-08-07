import { supabase } from '@/lib/supabase';
import type { Farmer, FarmerInsert, FarmerProductDiscount } from '@/types/database';
import { differenceInDays, parseISO } from 'date-fns';
import { getAgeingBucket, sanitizeSearchTerm } from '@/lib/utils';

export async function getFarmers(params: {
  dealerId: string;
  branchId?: string | null;
  search?: string;
  sortBy?: 'total_due' | 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
  cropStatus?: string;
  riskStatus?: string;
  village?: string;
  isWalkIn?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ data: Farmer[]; total: number }> {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('farmers')
    .select('*', { count: 'exact' })
    .eq('dealer_id', params.dealerId)
    .eq('is_active', true);

  // Farmers are shared across all branches (2026-07-17): the `branch_id` column
  // stays as "originally added at" info but no longer gates visibility. The
  // `params.branchId` is accepted but intentionally ignored so cached callers
  // don't need to change.
  if (params.cropStatus) {
    query = query.eq('crop_status', params.cropStatus);
  }
  if (params.riskStatus) {
    query = query.eq('risk_status', params.riskStatus);
  }
  if (params.village) {
    query = query.eq('village', params.village);
  }
  if (params.search) {
    const term = sanitizeSearchTerm(params.search.trim());
    if (term) query = query.or(
      `name.ilike.%${term}%,phone.ilike.${term}%,village.ilike.%${term}%`
    );
  }
  if (params.isWalkIn !== undefined) {
    query = query.eq('is_walk_in', params.isWalkIn);
  }

  const sortBy = params.sortBy || 'total_due';
  const sortDir = params.sortDir || (sortBy === 'name' ? 'asc' : 'desc');
  query = query.order(sortBy, { ascending: sortDir === 'asc' });
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  
  return {
    data: (data ?? []) as unknown as Farmer[],
    total: count || 0,
  };
}

export async function getFarmerById(farmerId: string): Promise<Farmer> {
  const { data, error } = await supabase
    .from('farmers')
    .select('*')
    .eq('id', farmerId)
    .single();

  if (error) throw error;
  return data as Farmer;
}

export async function createFarmer(data: FarmerInsert): Promise<Farmer> {
  const previousDue = Math.max(0, Number(data.opening_balance) || 0);
  const { data: farmer, error } = await supabase
    .from('farmers')
    .insert({
      ...data,
      opening_balance: previousDue,
      total_due: previousDue,
    })
    .select()
    .single();

  if (error) throw error;
  return farmer as Farmer;
}

export async function setFarmerPreviousDue(farmerId: string, previousDue: number): Promise<Farmer> {
  const { data, error } = await supabase.rpc('set_farmer_previous_due', {
    p_farmer_id: farmerId,
    p_previous_due: previousDue,
  });

  if (error) throw error;
  return data as Farmer;
}

export async function bulkCreateFarmers(rows: FarmerInsert[]): Promise<void> {
  if (!rows.length) return;
  // Route via SECURITY DEFINER RPC that bypasses the 30/min rate-limit trigger
  // for legitimate Excel imports (server forces dealer_id = auth.uid()).
  const payload = rows.map((r) => ({
    branch_id: r.branch_id ?? null,
    name: r.name,
    phone: r.phone ?? null,
    village: r.village ?? null,
    mandal: r.mandal ?? null,
    district: r.district ?? null,
    pond_acres: r.pond_acres ?? null,
    stocking_date: r.stocking_date ?? null,
    crop_status: r.crop_status ?? null,
    risk_status: r.risk_status ?? null,
    credit_limit: r.credit_limit ?? null,
    default_medicine_discount_percentage: r.default_medicine_discount_percentage ?? null,
    opening_balance: r.opening_balance ?? null,
    notes: r.notes ?? null,
  }));
  const { error } = await supabase.rpc('bulk_create_farmers', { p_rows: payload });
  if (error) throw error;
}

export async function updateFarmer(
  farmerId: string,
  data: Partial<FarmerInsert>
): Promise<Farmer> {
  const { data: farmer, error } = await supabase
    .from('farmers')
    .update(data)
    .eq('id', farmerId)
    .select()
    .single();

  if (error) throw error;
  return farmer as Farmer;
}

export async function getFarmerProductDiscounts(
  dealerId: string,
  farmerId: string
): Promise<FarmerProductDiscount[]> {
  const { data, error } = await supabase
    .from('farmer_product_discounts')
    .select('*, product:products(*)')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FarmerProductDiscount[];
}

export async function upsertFarmerProductDiscount(params: {
  dealerId: string;
  farmerId: string;
  productId: string;
  discountPercentage: number;
}): Promise<FarmerProductDiscount> {
  const discount = Math.min(Math.max(Number(params.discountPercentage) || 0, 0), 100);
  const { data, error } = await supabase
    .from('farmer_product_discounts')
    .upsert({
      dealer_id: params.dealerId,
      farmer_id: params.farmerId,
      product_id: params.productId,
      discount_percentage: discount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'dealer_id,farmer_id,product_id' })
    .select('*, product:products(*)')
    .single();

  if (error) throw error;
  return data as FarmerProductDiscount;
}

export async function deleteFarmerProductDiscount(params: {
  dealerId: string;
  discountId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('farmer_product_discounts')
    .delete()
    .eq('dealer_id', params.dealerId)
    .eq('id', params.discountId);

  if (error) throw error;
}

export async function uploadFarmerImage(
  file: File,
  dealerId: string,
  farmerId: string
): Promise<string> {
  const filePath = `${dealerId}/farmer_${farmerId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from('farmer-profiles')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/webp',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('farmer-profiles')
    .getPublicUrl(filePath);

  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Paginated farmer ledger transactions via server-side RPC.
 * Replaces the old unbounded fetch that crashed on mobile with 500+ transactions.
 * The RPC returns a UNION of bills + payments, ordered newest-first, with total count.
 */
export async function getFarmerLedgerPage(params: {

  farmerId: string;
  dealerId: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: Array<{
    id: string;
    type: 'bill' | 'payment' | 'return';
    ref_number: string;
    date: string;
    amount: number;
    balance_due: number | null;
    created_at: string;
    is_estimate?: boolean;
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const { data, error } = await supabase.rpc('get_farmer_ledger_page', {
    p_farmer_id: params.farmerId,
    p_dealer_id: params.dealerId,
    p_page: params.page ?? 1,
    p_limit: params.limit ?? 20,
    p_start_date: params.startDate || null,
    p_end_date: params.endDate || null,
  });

  if (error) throw error;

  const result = data as { total: number; page: number; limit: number; data: any[] };
  return {
    data: result.data ?? [],
    total: result.total ?? 0,
    page: result.page,
    limit: result.limit,
  };
}

/**
 * Legacy full-fetch for farmer transactions — kept for backward compat with
 * components that still need the full sorted+running-balance list.
 * Internally uses pagination and fetches up to 500 records max, then computes
 * running balance client-side on that safe bounded dataset.
 */
export async function getFarmerTransactions(
  farmerId: string,
  dealerId: string,
  openingBalance: number = 0
): Promise<
  Array<{
    id: string;
    type: 'bill' | 'payment' | 'adjustment';
    refNumber: string;
    date: string;
    amount: number;
    runningBalance: number;
  }>
> {
  // Bounded 500-record fetch — safe ceiling. For farmers with more, use getFarmerLedgerPage.
  const { data: bills, error: billsErr } = await supabase
    .from('bills')
    .select('id, bill_number, bill_date, total, settlement_discount_amount, created_at, type, is_edited, is_estimate')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .neq('status', 'cancelled')
    .limit(500);

  if (billsErr) throw billsErr;

  const { data: directPayments, error: directPaymentsErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date, method, created_at, receipt_number')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .limit(500);

  if (directPaymentsErr) throw directPaymentsErr;

  const payments = directPayments ?? [];

  const combined = [
    ...(bills ?? []).map((bill) => ({
      id: bill.id,
      type: (bill.type === 'adjustment' ? 'adjustment' : 'bill') as 'adjustment' | 'bill',
      refNumber: bill.bill_number,
      date: bill.bill_date,
      amount: Number(bill.total) - Number(bill.settlement_discount_amount || 0),
      createdAt: bill.created_at,
      is_edited: bill.is_edited,
      isEstimate: (bill as any).is_estimate ?? false,
    })),
    ...(payments ?? []).map((payment) => ({
      id: payment.id,
      type: 'payment' as const,
      refNumber: payment.receipt_number || (payment.method ? payment.method.toUpperCase() : 'PAYMENT'),
      date: payment.payment_date,
      amount: Number(payment.amount),
      createdAt: payment.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let runningBalance = openingBalance;
  const withBalance = combined.reverse().map((tx) => {
    runningBalance += (tx.type === 'bill' || tx.type === 'adjustment') ? tx.amount : -tx.amount;
    return { ...tx, runningBalance };
  });

  return withBalance.reverse();
}

export interface FarmerBillRow {
  id: string;
  refNumber: string;
  date: string;
  amount: number;
  createdAt: string;
  items: { product_name: string; quantity: number }[];
}

export interface FarmerPaymentRow {
  id: string;
  refNumber: string;
  date: string;
  amount: number;
  createdAt: string;
}

export async function getFarmerBillsPage(params: {
  farmerId: string;
  dealerId: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: FarmerBillRow[]; total: number; limit: number; offset: number }> {
  const from = params.offset;
  const to = params.offset + params.limit - 1;

  let query = supabase
    .from('bills')
    .select('id, bill_number, bill_date, total, created_at, bill_items(product_name_snapshot, quantity)', { count: 'exact' })
    .eq('dealer_id', params.dealerId)
    .eq('farmer_id', params.farmerId)
    .neq('status', 'cancelled');

  if (params.startDate) query = query.gte('bill_date', params.startDate);
  if (params.endDate) query = query.lte('bill_date', params.endDate);

  const { data, count, error } = await query
    .order('bill_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    rows: (data ?? []).map((bill) => ({
      id: bill.id,
      refNumber: bill.bill_number,
      date: bill.bill_date,
      amount: Number(bill.total),
      createdAt: bill.created_at,
      items: ((bill as any).bill_items ?? []).map((i: any) => ({ product_name: i.product_name_snapshot, quantity: i.quantity })),
    })),
    total: count || 0,
    limit: params.limit,
    offset: params.offset,
  };
}

export async function getFarmerPaymentsPage(params: {
  farmerId: string;
  dealerId: string;
  startDate?: string;
  endDate?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: FarmerPaymentRow[]; total: number; limit: number; offset: number }> {
  const from = params.offset;
  const to = params.offset + params.limit - 1;

  let query = supabase
    .from('payments')
    .select('id, amount, payment_date, method, created_at, receipt_number', { count: 'exact' })
    .eq('dealer_id', params.dealerId)
    .eq('farmer_id', params.farmerId);

  if (params.startDate) query = query.gte('payment_date', params.startDate);
  if (params.endDate) query = query.lte('payment_date', params.endDate);

  const { data, count, error } = await query
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    rows: (data ?? []).map((payment) => ({
      id: payment.id,
      refNumber: payment.receipt_number || (payment.method ? payment.method.toUpperCase() : 'PAYMENT'),
      date: payment.payment_date,
      amount: Number(payment.amount),
      createdAt: payment.created_at,
    })),
    total: count || 0,
    limit: params.limit,
    offset: params.offset,
  };
}

export async function getFarmerStatement(
  farmerId: string,
  dealerId: string,
  startDate: string,
  endDate: string
) {
  const farmer = await getFarmerById(farmerId);
  
  // 1. Get all bills and payments
  const { data: bills, error: billsErr } = await supabase
    .from('bills')
    .select('id, bill_number, bill_date, total, created_at, is_edited, bill_items(product_name_snapshot, quantity, unit_price)')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .neq('status', 'cancelled');
  if (billsErr) throw billsErr;

  const billIds = (bills ?? []).map(b => b.id);

  const { data: directPayments, error: dpErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date, method, created_at, receipt_number')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId);
  if (dpErr) throw dpErr;

  let billLinkedPayments: any[] = [];
  if (billIds.length > 0) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, payment_date, method, created_at, receipt_number, bill_id')
      .eq('dealer_id', dealerId)
      .in('bill_id', billIds);
    if (error) throw error;
    billLinkedPayments = data ?? [];
  }

  const paymentMap = new Map<string, any>();
  [...(directPayments ?? []), ...billLinkedPayments].forEach(p => paymentMap.set(p.id, p));
  const payments = Array.from(paymentMap.values());

  const { data: returns, error: returnsErr } = await supabase
    .from('bill_returns')
    .select('id, return_number, return_date, total_amount, created_at, branch_name_snapshot')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId);
  if (returnsErr) throw returnsErr;

  // 2. Separate into "before start" and "in range"
  // Use business date strings (YYYY-MM-DD) for comparison — avoids Date constructor
  // timezone issues and correctly handles backdated entries where created_at differs
  // from the business date.

  let pastDebits = 0;
  let pastCredits = 0;

  const inRangeTransactions: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let totalReturns = 0;

  bills?.forEach(bill => {
    const d = bill.bill_date;                        // business date, not created_at
    if (d < startDate) {
      pastDebits += Number(bill.total);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: bill.id,
        type: 'bill',
        refNumber: bill.bill_number,
        date: bill.bill_date,
        amount: Number(bill.total),
        createdAt: bill.created_at,
        is_edited: bill.is_edited,
        items: bill.bill_items
      });
      totalDebit += Number(bill.total);
    }
  });

  payments.forEach(payment => {
    const d = payment.payment_date;                  // business date, not created_at
    if (d < startDate) {
      pastCredits += Number(payment.amount);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: payment.id,
        type: 'payment',
        refNumber: payment.receipt_number || (payment.method ? payment.method.toUpperCase() : 'PAYMENT'),
        date: payment.payment_date,
        amount: Number(payment.amount),
        createdAt: payment.created_at,
        method: payment.method
      });
      totalCredit += Number(payment.amount);
    }
  });

  (returns ?? []).forEach((farmerReturn) => {
    const d = farmerReturn.return_date;              // business date, not created_at
    if (d < startDate) {
      pastCredits += Number(farmerReturn.total_amount);
    } else if (d <= endDate) {
      inRangeTransactions.push({
        id: farmerReturn.id,
        type: 'return',
        refNumber: farmerReturn.return_number || 'FARMER RETURN',
        date: farmerReturn.return_date,
        amount: Number(farmerReturn.total_amount),
        createdAt: farmerReturn.created_at,
        branchName: farmerReturn.branch_name_snapshot,
      });
      totalReturns += Number(farmerReturn.total_amount);
    }
  });

  // 3. Calculate opening and closing balance
  const openingBalance = farmer.opening_balance + pastDebits - pastCredits;
  const closingBalance = openingBalance + totalDebit - totalCredit - totalReturns;

  // 4. Sort by business date first, then created_at as same-day tiebreaker
  inRangeTransactions.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    return dateDiff !== 0 ? dateDiff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  
  let currentBalance = openingBalance;
  const transactions = inRangeTransactions.map(tx => {
    currentBalance += tx.type === 'bill' ? tx.amount : -tx.amount;
    return { ...tx, runningBalance: currentBalance };
  });

  return {
    farmer,
    openingBalance,
    totalDebit,
    totalCredit,
    totalReturns,
    closingBalance,
    transactions
  };
}

export async function getFarmerAgeing(
  farmerId: string,
  dealerId: string
): Promise<{
  '0-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
}> {
  const { data: bills, error } = await supabase
    .from('bills')
    .select('bill_date, balance_due')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .eq('status', 'active')
    .gt('balance_due', 0);

  if (error) throw error;

  const ageing = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const today = new Date();

  (bills ?? []).forEach((bill) => {
    const days = differenceInDays(today, parseISO(bill.bill_date));
    const bucket = getAgeingBucket(Math.max(0, days));
    ageing[bucket] += Number(bill.balance_due);
  });

  return ageing;
}

export interface DuesAgeingRow {
  farmer_id: string;
  amount_0_30: number;
  amount_31_60: number;
  amount_61_90: number;
  amount_90_plus: number;
  oldest_due_days: number;
}

export async function getDuesAgeing(
  dealerId: string,
  branchId?: string | null
): Promise<DuesAgeingRow[]> {
  const { data, error } = await supabase.rpc('get_dues_ageing', {
    p_dealer_id: dealerId,
    p_branch_id: branchId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as DuesAgeingRow[];
}

export async function getOpenBillsForFarmer(
  farmerId: string,
  dealerId: string
): Promise<Array<{ id: string; bill_number: string; bill_date: string; balance_due: number; branch_name_snapshot: string | null }>> {
  const { data, error } = await supabase
    .from('bills')
    .select('id, bill_number, bill_date, balance_due, branch_name_snapshot')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .eq('status', 'active')
    .gt('balance_due', 0)
    .order('bill_date', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((bill) => ({
    ...bill,
    balance_due: Number(bill.balance_due),
  }));
}

export async function collectPayment(params: {
  dealerId: string;
  branchId: string | null;
  farmerId: string;
  amount: number;
  method: string;
  allocationMode?: 'general_account' | 'oldest_first' | 'specific_bill';
  targetBillId?: string;
  paymentDate?: string;
  upiRef?: string;
  chequeNo?: string;
  notes?: string;
}): Promise<{ payment_id: string; receipt_number: string; allocated_amount: number; unallocated_amount: number }> {
  const { data, error } = await supabase.rpc('collect_farmer_payment_v2', {
    p_payload: {
      dealer_id: params.dealerId,
      branch_id: params.branchId,
      farmer_id: params.farmerId,
      amount: params.amount,
      method: params.method,
      allocation_mode: params.allocationMode || (params.targetBillId ? 'specific_bill' : 'oldest_first'),
      target_bill_id: params.targetBillId || null,
      payment_date: params.paymentDate || null,
      upi_ref: params.upiRef || null,
      cheque_no: params.chequeNo || null,
      notes: params.notes || null,
    },
  });

  if (error) throw error;
  return data as {
    payment_id: string;
    receipt_number: string;
    allocated_amount: number;
    unallocated_amount: number;
  };
}

export async function settleRemainingBalance(params: {
  dealerId: string;
  farmerId: string;
  reason?: string;
}): Promise<number> {
  const { data, error } = await supabase.rpc('settle_farmer_remaining_balance', {
    p_dealer_id: params.dealerId,
    p_farmer_id: params.farmerId,
    p_reason: params.reason || null,
  });
  if (error) throw error;
  return data as number;
}

export async function getUniqueVillages(dealerId: string): Promise<string[]> {
  // Server-side DISTINCT via RPC — avoids fetching all farmer rows for a dropdown.
  // Falls back to client-side dedup if the RPC is not yet deployed.
  const { data, error } = await supabase
    .rpc('get_unique_villages', { p_dealer_id: dealerId });

  if (error) {
    console.error('[getUniqueVillages] RPC failed, falling back to direct query:', error);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('farmers')
      .select('village')
      .eq('dealer_id', dealerId)
      .eq('is_active', true)
      .not('village', 'is', null)
      .limit(500);
    if (fallbackError) throw fallbackError;
    const villages = [...new Set((fallbackData ?? []).map((f) => f.village).filter(Boolean))] as string[];
    return villages.sort();
  }

  return (data ?? []).map((row: { village: string }) => row.village);
}
