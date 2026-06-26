import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';
import {
  AgingRow,
  BankReconciliationRow,
  CashBookReportRow,
  ExpenseRegisterRow,
  GSTSummaryRow,
  MonthlyReportPeriod,
  PurchaseRegisterRow,
  ReportColumn,
  ReportSummaryItem,
  SalesRegisterRow,
} from '../types';
import { Bill, BillItem, CashBookEntry, Expense, Farmer, Payment, Product, StockPurchase, Supplier, SupplierPayment } from '@/types/database';

export const DEFAULT_AGING_DAYS = 30;
export const DEFAULT_BANK_RECONCILIATION_NOTE =
  'Bank reconciliation is shown as an import-ready worksheet because no live bank feed is connected yet.';

export function getMonthlyReportPeriod(month: number, year: number): MonthlyReportPeriod {
  const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
  const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');
  return {
    month,
    year,
    startDate,
    endDate,
    label: `${format(new Date(year, month - 1, 1), 'MMMM yyyy')}`,
  };
}

export const currencySummary = (label: string, value: number): ReportSummaryItem => ({
  label,
  value: value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }),
});

export const numberSummary = (label: string, value: number): ReportSummaryItem => ({
  label,
  value: value.toLocaleString('en-IN'),
});

const toMoney = (value: number | null | undefined) => Number(value || 0);

const formatDateValue = (value?: string | null) => (value ? format(parseISO(value), 'dd MMM yyyy') : '—');

const inferPaymentStatus = (bill: Bill) => {
  if (bill.status === 'cancelled') return 'Cancelled';
  if (bill.balance_due <= 0) return 'Paid';
  if (bill.amount_paid > 0) return 'Part-paid';
  return 'Pending';
};

const inferPaymentMode = (bill: Bill, paymentMap: Map<string, Payment[]>) => {
  const payments = paymentMap.get(bill.id) || [];
  if (!payments.length) {
    return bill.payment_type || (bill.amount_paid > 0 ? 'Recorded' : 'Credit');
  }

  const modes = Array.from(new Set(payments.map((payment) => payment.method || 'cash'))).filter(Boolean);
  return modes.join(', ');
};

const inferTransactionId = (bill: Bill, paymentMap: Map<string, Payment[]>) => {
  const payments = paymentMap.get(bill.id) || [];
  const firstPayment = payments[0];
  return firstPayment?.upi_ref || firstPayment?.cheque_no || firstPayment?.receipt_number || bill.upi_ref || bill.cheque_number || '—';
};

const summarizeBillItems = (billItems: BillItem[] | null | undefined, productsById: Map<string, Product>): { itemService: string; qty: number } => {
  const items = billItems || [];
  if (!items.length) {
    return { itemService: 'Bill total', qty: 0 };
  }

  const names = items.map((item) => {
    const product = item.product_id ? productsById.get(item.product_id) : null;
    return item.product_name_snapshot || product?.name || 'Item';
  });
  const quantity = items.reduce((sum, item) => sum + toMoney(item.quantity), 0);
  return {
    itemService: names.join(', '),
    qty: quantity,
  };
};

export function buildSalesRegisterRows(
  bills: Bill[],
  billItemsByBillId: Map<string, BillItem[]>,
  paymentsByBillId: Map<string, Payment[]>,
  branchName = 'Main branch',
  productsById = new Map<string, Product>()
): SalesRegisterRow[] {
  return bills.map((bill) => {
    const summary = summarizeBillItems(billItemsByBillId.get(bill.id), productsById);
    const items = billItemsByBillId.get(bill.id) || [];
    const firstItem = items[0];
    const uniqueGstRates = new Set(items.map(item => item.gst_rate));
    const gstRate = uniqueGstRates.size > 1 ? 'Multiple' : (firstItem?.gst_rate || (bill.subtotal > 0 ? Math.round((bill.gst_amount / bill.subtotal) * 100) : 0));

    return {
      date: formatDateValue(bill.bill_date),
      invoiceNo: bill.bill_number,
      customerName: bill.farmer_name_snapshot || 'Walk-in Customer',
      itemService: summary.itemService,
      qty: summary.qty || 1,
      taxableValue: toMoney(bill.subtotal),
      gstRate,
      gstAmount: toMoney(bill.gst_amount),
      paymentStatus: inferPaymentStatus(bill),
      paymentMode: inferPaymentMode(bill, paymentsByBillId),
      transactionId: inferTransactionId(bill, paymentsByBillId),
      branch: branchName,
    };
  });
}

export function buildPurchaseRegisterRows(
  purchases: StockPurchase[],
  suppliersById: Map<string, Supplier>,
  productById: Map<string, Product>,
  supplierPaymentsByPurchaseId: Map<string, SupplierPayment[]>,
  branchName = 'Main branch'
): PurchaseRegisterRow[] {
  return purchases.map((purchase) => {
    const supplier = purchase.supplier_id ? suppliersById.get(purchase.supplier_id) : null;
    const product = productById.get(purchase.product_id);
    const payment = supplierPaymentsByPurchaseId.get(purchase.id)?.[0];

    return {
      date: formatDateValue(purchase.purchase_date),
      vendor: supplier?.company || supplier?.name || 'Unknown supplier',
      billNo: purchase.invoice_number || purchase.id.slice(0, 8).toUpperCase(),
      medicineName: product?.name || 'Unknown Product',
      stockCount: purchase.quantity,
      category: product?.category || product?.type || 'Purchase',
      amount: toMoney(purchase.total_amount),
      gstAmount: toMoney(purchase.gst_amount),
      paymentMode: purchase.is_paid ? (payment?.method || 'Paid') : 'Credit',
      taxFlag: toMoney(purchase.gst_amount) > 0 ? 'GST Eligible' : 'No GST',
      branch: branchName,
    };
  });
}

export function buildExpenseRows(expenses: Expense[], branchName = 'Main branch'): ExpenseRegisterRow[] {
  return expenses.map((expense) => ({
    date: formatDateValue(expense.expense_date),
    category: expense.category || 'General',
    description: expense.description || '—',
    amount: toMoney(expense.amount),
    paymentMode: expense.paid_via || 'cash',
    branch: branchName,
  }));
}

export function buildCashBookRows(entries: CashBookEntry[], openingBalance: number): CashBookReportRow[] {
  let runningBalance = openingBalance;

  return entries.map((entry) => {
    const cashIn = entry.entry_type === 'income' ? toMoney(entry.amount) : 0;
    const cashOut = entry.entry_type === 'expense' ? toMoney(entry.amount) : 0;
    runningBalance += cashIn - cashOut;

    return {
      date: formatDateValue(entry.entry_date),
      particulars: entry.notes || entry.source || 'Cash movement',
      cashIn,
      cashOut,
      balance: runningBalance,
      referenceNo: entry.reference_id || '—',
      source: entry.source || 'manual',
    };
  });
}

export function buildBankReconciliationRows(rows: CashBookReportRow[]): BankReconciliationRow[] {
  return rows.map((row) => ({
    statementDate: row.date,
    description: row.particulars,
    debit: row.cashOut,
    credit: row.cashIn,
    balance: row.balance,
    matchedReference: row.referenceNo !== '—' ? row.referenceNo : 'Needs bank import',
    status: row.referenceNo !== '—' ? 'Matched to ledger' : 'Unreconciled',
  }));
}

export function buildGSTSummaries(outputTotal: number, inputTotal: number, outputTaxable: number, inputTaxable: number): {
  summaries: ReportSummaryItem[];
  outputRows: GSTSummaryRow[];
  inputRows: GSTSummaryRow[];
  netGSTPayable: number;
} {
  const netGSTPayable = outputTotal - inputTotal;

  return {
    summaries: [
      currencySummary('Output GST', outputTotal),
      currencySummary('Input GST', inputTotal),
      currencySummary('Net GST Payable', netGSTPayable),
    ],
    outputRows: [
      { label: 'Taxable Sales', value: outputTaxable },
      { label: 'Output GST', value: outputTotal },
    ],
    inputRows: [
      { label: 'Taxable Purchases', value: inputTaxable },
      { label: 'Input GST', value: inputTotal },
    ],
    netGSTPayable,
  };
}

export function buildAgingRows<T extends { id: string; name: string }>(
  records: Array<T & { pendingAmount: number; baseDate: string; reference: string }>,
  defaultDueDays = DEFAULT_AGING_DAYS
): AgingRow[] {
  const today = new Date();

  return records.map((record) => {
    const dueDate = addDays(parseISO(record.baseDate), defaultDueDays);
    const ageDays = Math.max(0, differenceInCalendarDays(today, parseISO(record.baseDate)));

    return {
      name: record.name,
      pendingAmount: toMoney(record.pendingAmount),
      dueDate: format(dueDate, 'dd MMM yyyy'),
      ageDays,
      agingBucket: getAgingBucket(ageDays),
      reference: record.reference,
    };
  });
}

export function getAgingBucket(ageDays: number) {
  if (ageDays <= 30) return '0-30 days';
  if (ageDays <= 60) return '31-60 days';
  if (ageDays <= 90) return '61-90 days';
  return '90+ days';
}

export function buildLedgerColumns(keys: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center' }>): ReportColumn[] {
  return keys;
}
