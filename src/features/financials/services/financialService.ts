import { supabase } from '@/lib/supabase';
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
      .is('deleted_at', null)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (branchId) query = query.eq('branch_id', branchId);
    
    if (search) {
      query = query.or(`description.ilike.%${search}%,category.ilike.%${search}%`);
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
    // 1. Insert expense record
    const { error: expError } = await supabase
      .from('expenses')
      .insert(payload);
    
    if (expError) throw expError;

    // 2. Add entry to cash book
    const { error: cbError } = await supabase
      .from('cash_book')
      .insert({
        dealer_id: payload.dealer_id,
        branch_id: payload.branch_id,
        entry_type: 'expense',
        source: 'general_expense',
        amount: payload.amount,
        notes: `[${payload.category}] ${payload.description}`,
        entry_date: payload.expense_date,
      });

    if (cbError) throw cbError;
  },

  // Cash Book
  async getCashBookEntries(
    dealerId: string,
    branchId?: string | null,
    startDate?: string,
    endDate?: string
  ): Promise<CashBookLedger> {
    let openingQuery = supabase
      .from('cash_book')
      .select('entry_type, amount')
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    let rangeQuery = supabase
      .from('cash_book')
      .select('*')
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (branchId) {
      openingQuery = openingQuery.eq('branch_id', branchId);
      rangeQuery = rangeQuery.eq('branch_id', branchId);
    }

    if (startDate) {
      openingQuery = openingQuery.lt('entry_date', startDate);
      rangeQuery = rangeQuery.gte('entry_date', startDate);
    }

    if (endDate) {
      rangeQuery = rangeQuery.lte('entry_date', endDate);
    }

    const [{ data: openingData, error: openingError }, { data, error }] = await Promise.all([
      openingQuery,
      rangeQuery,
    ]);

    if (openingError) throw openingError;
    if (error) throw error;

    const openingBalance = (openingData || []).reduce((sum, entry) => {
      return sum + (entry.entry_type === 'income' ? entry.amount : -entry.amount);
    }, 0);

    return {
      entries: data as CashBookEntry[],
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
      .lte('entry_date', date)
      .is('deleted_at', null)
      .order('entry_date', { ascending: true })
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

    const { data: cashEntries, error: cashError } = await cashQuery;
    if (cashError) throw cashError;

    const paymentIds = (cashEntries || [])
      .map((entry) => entry.reference_id)
      .filter(Boolean) as string[];

    const [
      { data: payments, error: paymentsError },
      { data: supplierPayments, error: supplierPaymentsError },
      { data: closing, error: closingError },
    ] = await Promise.all([
      paymentIds.length
        ? supabase.from('payments').select('id, method').in('id', paymentIds)
        : Promise.resolve({ data: [], error: null }),
      paymentIds.length
        ? supabase.from('supplier_payments').select('id, method').in('id', paymentIds)
        : Promise.resolve({ data: [], error: null }),
      closingQuery.maybeSingle(),
    ]);

    if (paymentsError) throw paymentsError;
    if (supplierPaymentsError) throw supplierPaymentsError;
    if (closingError) throw closingError;

    const paymentMethods = new Map((payments || []).map((payment) => [payment.id, payment.method || 'cash']));
    const supplierPaymentMethods = new Map(
      (supplierPayments || []).map((payment) => [payment.id, payment.method || 'cash'])
    );

    const classifiedEntries = ((cashEntries || []) as CashBookEntry[]).map((entry) =>
      classifyCashEntry(entry, paymentMethods, supplierPaymentMethods)
    );

    const openingCash = classifiedEntries
      .filter((entry) => entry.entry_date < date)
      .reduce((sum, entry) => sum + entry.counterCashChange, 0);
    const entries = classifiedEntries.filter((entry) => entry.entry_date === date);

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
