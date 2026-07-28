import { supabase } from '@/lib/supabase';
import { sanitizeSearchTerm } from '@/lib/utils';
import {
  CashBookEntry,
  CashBookInsert,
  CashBookLedger,
  CashClosingPayload,
  DailyCashClarity,
  DailyCashEntry,
  ExpenseInsert,
  ExpenseItem,
} from '../types';

const CASH_METHODS = new Set(['cash', '']);
const UPI_METHODS = new Set(['upi', 'gpay', 'phonepe', 'paytm']);
const CHEQUE_METHODS = new Set(['cheque', 'check']);

const normalizeMethod = (value?: string | null) => (value || '').trim().toLowerCase();

const classifyCashEntry = (
  entry: CashBookEntry,
  paymentMethods: Map<string, string>,
  supplierPaymentMethods: Map<string, string>
): DailyCashEntry => {
  const paymentMethod =
    (entry.reference_id ? paymentMethods.get(entry.reference_id) : null) ||
    (entry.reference_id ? supplierPaymentMethods.get(entry.reference_id) : null) ||
    (entry.entry_type === 'expense' ? 'cash' : 'cash');
  const normalizedMethod = normalizeMethod(paymentMethod);
  const amount = Number(entry.amount || 0);

  if (entry.entry_type === 'income') {
    if (UPI_METHODS.has(normalizedMethod)) {
      return { ...entry, paymentMethod, displayType: 'upi_in', counterCashChange: 0 };
    }
    if (CHEQUE_METHODS.has(normalizedMethod)) {
      return { ...entry, paymentMethod, displayType: 'cheque_in', counterCashChange: 0 };
    }
    if (!CASH_METHODS.has(normalizedMethod)) {
      return { ...entry, paymentMethod, displayType: 'other_in', counterCashChange: 0 };
    }
    return { ...entry, paymentMethod, displayType: 'cash_in', counterCashChange: amount };
  }

  if (!CASH_METHODS.has(normalizedMethod)) {
    return { ...entry, paymentMethod, displayType: 'non_cash_out', counterCashChange: 0 };
  }

  return { ...entry, paymentMethod, displayType: 'cash_out', counterCashChange: -amount };
};

export const financialService = {
  // Expenses
  async getExpenses(
    dealerId: string, 
    branchId?: string | null,
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: ExpenseItem[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' })
      .eq('dealer_id', dealerId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (branchId) query = query.eq('branch_id', branchId);
    
    if (search) {
      const safeSearch = sanitizeSearchTerm(search);
      if (safeSearch) {
        query = query.or(`description.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%`);
      }
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      data: data as ExpenseItem[],
      total: count || 0
    };
  },

  async recordExpense(payload: ExpenseInsert): Promise<void> {
    const { error } = await supabase.rpc('record_expense_v1', {
      p_payload: {
        dealer_id: payload.dealer_id,
        branch_id: payload.branch_id ?? null,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        paid_via: payload.paid_via ?? 'cash',
        expense_date: payload.expense_date,
      },
    });
    if (error) throw error;
  },

  // Cash Book
  async getCashBookEntries(
    dealerId: string,
    branchId?: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<CashBookLedger> {
    let rangeQuery = supabase
      .from('cash_book')
      .select('*')
      .eq('dealer_id', dealerId)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (branchId) {
      rangeQuery = rangeQuery.eq('branch_id', branchId);
    }

    if (startDate) {
      rangeQuery = rangeQuery.gte('entry_date', startDate);
    }

    if (endDate) {
      rangeQuery = rangeQuery.lte('entry_date', endDate);
    }

    let openingBalance = 0;
    if (startDate) {
      const { data: ob, error: obErr } = await supabase.rpc('get_cash_book_opening_balance_v1', {
        p_dealer_id: dealerId,
        p_branch_id: branchId ?? null,
        p_before_date: startDate,
      });
      if (obErr) throw obErr;
      openingBalance = Number(ob ?? 0);
    }

    const { data, error } = await rangeQuery;
    if (error) throw error;

    const entries = (data || []) as CashBookEntry[];

    // Enrich with farmer names in 2 parallel queries
    const saleIds = entries.filter(e => e.source === 'sale').map(e => e.reference_id).filter(Boolean) as string[];
    const paymentIds = entries.filter(e => e.source === 'farmer_payment').map(e => e.reference_id).filter(Boolean) as string[];

    const [salesRows, paymentRows] = await Promise.all([
      saleIds.length ? supabase.from('bills').select('id, farmer_name_snapshot').in('id', saleIds).then(r => r.data || []) : Promise.resolve([]),
      paymentIds.length ? supabase.from('payments').select('id, farmers!farmer_id(name)').in('id', paymentIds).then(r => r.data || []) : Promise.resolve([]),
    ]);

    const saleNameMap = new Map<string, string | null>((salesRows as { id: string; farmer_name_snapshot: string | null }[]).map(b => [b.id, b.farmer_name_snapshot]));
    const paymentNameMap = new Map<string, string | null>((paymentRows as unknown as { id: string; farmers: { name: string } | null }[]).map(p => [p.id, p.farmers?.name ?? null]));

    for (const e of entries) {
      if (e.source === 'sale' && e.reference_id) e.farmer_name = saleNameMap.get(e.reference_id) ?? null;
      else if (e.source === 'farmer_payment' && e.reference_id) e.farmer_name = paymentNameMap.get(e.reference_id) ?? null;
    }

    return {
      entries,
      openingBalance,
    };
  },

  async addManualCashEntry(payload: CashBookInsert): Promise<void> {
    const { error } = await supabase
      .from('cash_book')
      .insert(payload);
    if (error) throw error;
  },

  async getDailyCashClarity(
    dealerId: string,
    branchId: string | null | undefined,
    date: string
  ): Promise<DailyCashClarity> {
    let cashQuery = supabase
      .from('cash_book')
      .select('*')
      .eq('dealer_id', dealerId)
      .eq('entry_date', date)
      .order('created_at', { ascending: true });

    let closingQuery = supabase
      .from('cash_closings')
      .select('*')
      .eq('dealer_id', dealerId)
      .eq('closing_date', date);

    if (branchId) {
      cashQuery = cashQuery.eq('branch_id', branchId);
      closingQuery = closingQuery.eq('branch_id', branchId);
    }

    const [
      { data: openingData, error: openingError },
      { data: cashEntries, error: cashError },
      { data: closing, error: closingError },
    ] = await Promise.all([
      supabase.rpc('get_cash_clarity_opening_v1', {
        p_dealer_id: dealerId,
        p_branch_id: branchId ?? null,
        p_date: date,
      }),
      cashQuery,
      closingQuery.maybeSingle(),
    ]);

    if (openingError) throw openingError;
    if (cashError) throw cashError;
    if (closingError) throw closingError;

    const paymentIds = (cashEntries || [])
      .map((entry) => entry.reference_id)
      .filter(Boolean) as string[];

    const [
      { data: payments, error: paymentsError },
      { data: supplierPayments, error: supplierPaymentsError },
    ] = await Promise.all([
      paymentIds.length
        ? supabase.from('payments').select('id, method').in('id', paymentIds)
        : Promise.resolve({ data: [], error: null }),
      paymentIds.length
        ? supabase.from('supplier_payments').select('id, method').in('id', paymentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (paymentsError) throw paymentsError;
    if (supplierPaymentsError) throw supplierPaymentsError;

    const paymentMethods = new Map((payments || []).map((payment) => [payment.id, payment.method || 'cash']));
    const supplierPaymentMethods = new Map(
      (supplierPayments || []).map((payment) => [payment.id, payment.method || 'cash'])
    );

    const openingCash = Number(openingData ?? 0);
    const entries = ((cashEntries || []) as CashBookEntry[]).map((entry) =>
      classifyCashEntry(entry, paymentMethods, supplierPaymentMethods)
    );

    const cashIn = entries
      .filter((entry) => entry.displayType === 'cash_in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const cashOut = entries
      .filter((entry) => entry.displayType === 'cash_out')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const upiIn = entries
      .filter((entry) => entry.displayType === 'upi_in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const chequeIn = entries
      .filter((entry) => entry.displayType === 'cheque_in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const otherIn = entries
      .filter((entry) => entry.displayType === 'other_in')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const nonCashOut = entries
      .filter((entry) => entry.displayType === 'non_cash_out')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const shopExpenses = entries
      .filter((entry) => entry.source === 'general_expense' || entry.source === 'expense')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expectedClosingCash = openingCash + cashIn - cashOut;

    return {
      date,
      entries,
      closing: closing || null,
      openingCash,
      cashIn,
      cashOut,
      upiIn,
      chequeIn,
      otherIn,
      nonCashOut,
      shopExpenses,
      expectedClosingCash,
      physicalClosingCash: closing?.physical_cash ?? null,
      variance: closing?.variance ?? null,
    };
  },

  async closeCashDay(payload: CashClosingPayload): Promise<void> {
    const { error } = await supabase.rpc('close_cash_day_v1', {
      p_payload: payload,
    });

    if (error) throw error;
  }
};
