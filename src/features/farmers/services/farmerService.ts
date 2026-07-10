import { supabase } from '@/lib/supabase';
import type { Farmer, FarmerInsert, FarmerProductDiscount } from '@/types/database';
import { differenceInDays, parseISO } from 'date-fns';
import { getAgeingBucket } from '@/lib/utils';

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
    .eq('is_active', true)
    .is('deleted_at', null);

  if (params.branchId) {
    query = query.eq('branch_id', params.branchId);
  }
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
    query = query.or(
      `name.ilike.%${params.search}%,phone.ilike.%${params.search}%,village.ilike.%${params.search}%`
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
    data: (data ?? []) as Farmer[],
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
  const { data: farmer, error } = await supabase
    .from('farmers')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return farmer as Farmer;
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
  const { data: bills, error: billsErr } = await supabase
    .from('bills')
    .select('id, bill_number, bill_date, total, created_at, type, is_edited')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId)
    .neq('status', 'cancelled');

  if (billsErr) throw billsErr;

  const billIds = (bills ?? []).map((bill) => bill.id);

  const { data: directPayments, error: directPaymentsErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date, method, created_at, receipt_number')
    .eq('dealer_id', dealerId)
    .eq('farmer_id', farmerId);

  if (directPaymentsErr) throw directPaymentsErr;

  let billLinkedPayments: typeof directPayments = [];
  if (billIds.length > 0) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, amount, payment_date, method, created_at, receipt_number, bill_id')
      .eq('dealer_id', dealerId)
      .in('bill_id', billIds);

    if (error) throw error;
    billLinkedPayments = data ?? [];
  }

  const paymentMap = new Map<string, (typeof directPayments)[number]>();
  [...(directPayments ?? []), ...(billLinkedPayments ?? [])].forEach((payment) => {
    paymentMap.set(payment.id, payment);
  });
  const payments = [...paymentMap.values()];

  const combined = [
    ...(bills ?? []).map((bill) => ({
      id: bill.id,
      type: (bill.type === 'adjustment' ? 'adjustment' : 'bill') as 'adjustment' | 'bill',
      refNumber: bill.bill_number,
      date: bill.bill_date,
      amount: Number(bill.total),
      createdAt: bill.created_at,
      is_edited: bill.is_edited,
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

  // 2. Separate into "before start" and "in range"
  const startObj = new Date(startDate);
  startObj.setHours(0, 0, 0, 0);
  const endObj = new Date(endDate);
  endObj.setHours(23, 59, 59, 999);

  let pastDebits = 0;
  let pastCredits = 0;
  
  const inRangeTransactions: any[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  bills?.forEach(bill => {
    const d = new Date(bill.created_at);
    if (d < startObj) {
      pastDebits += Number(bill.total);
    } else if (d <= endObj) {
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
    const d = new Date(payment.created_at);
    if (d < startObj) {
      pastCredits += Number(payment.amount);
    } else if (d <= endObj) {
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

  // 3. Calculate opening and closing balance
  const openingBalance = farmer.opening_balance + pastDebits - pastCredits;
  const closingBalance = openingBalance + totalDebit - totalCredit;

  // 4. Sort and add running balance
  inRangeTransactions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
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
): Promise<Array<{ id: string; bill_number: string; bill_date: string; balance_due: number }>> {
  const { data, error } = await supabase
    .from('bills')
    .select('id, bill_number, bill_date, balance_due')
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

export async function getUniqueVillages(dealerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('farmers')
    .select('village')
    .eq('dealer_id', dealerId)
    .eq('is_active', true)
    .not('village', 'is', null);

  if (error) throw error;

  const villages = [...new Set((data ?? []).map((f) => f.village).filter(Boolean))] as string[];
  return villages.sort();
}
