import { CashClosing, Expense, CashBookEntry as DbCashBookEntry } from '@/types/database';

export interface ExpenseItem extends Expense {}
export interface CashBookEntry extends DbCashBookEntry {}

export interface CashBookLedger {
  entries: CashBookEntry[];
  openingBalance: number;
}

export interface DailyCashEntry extends CashBookEntry {
  paymentMethod: string;
  displayType: 'cash_in' | 'cash_out' | 'upi_in' | 'cheque_in' | 'other_in' | 'non_cash_out';
  counterCashChange: number;
}

export interface DailyCashClarity {
  date: string;
  entries: DailyCashEntry[];
  closing: CashClosing | null;
  openingCash: number;
  cashIn: number;
  cashOut: number;
  upiIn: number;
  chequeIn: number;
  otherIn: number;
  nonCashOut: number;
  shopExpenses: number;
  expectedClosingCash: number;
  physicalClosingCash: number | null;
  variance: number | null;
}

export interface ExpenseInsert {
  dealer_id: string;
  branch_id?: string | null;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  paid_via: string;
}

export interface CashBookInsert {
  dealer_id: string;
  branch_id?: string | null;
  entry_type: 'income' | 'expense';
  source: string;
  reference_id?: string | null;
  amount: number;
  notes?: string | null;
  entry_date: string;
}

export interface CashClosingPayload {
  dealer_id: string;
  branch_id?: string | null;
  closing_date: string;
  physical_cash: number;
  notes?: string | null;
}
