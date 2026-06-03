export interface MonthlyReportPeriod {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  label: string;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export type ReportCellValue = string | number | boolean | null;

export interface SalesRegisterRow {
  date: string;
  invoiceNo: string;
  customerName: string;
  itemService: string;
  qty: number;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  paymentStatus: string;
  paymentMode: string;
  transactionId: string;
  branch: string;
}

export interface PurchaseRegisterRow {
  date: string;
  vendor: string;
  billNo: string;
  category: string;
  amount: number;
  gstAmount: number;
  paymentMode: string;
  taxFlag: string;
  branch: string;
}

export interface ExpenseRegisterRow {
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMode: string;
  branch: string;
}

export interface CashBookReportRow {
  date: string;
  particulars: string;
  cashIn: number;
  cashOut: number;
  balance: number;
  referenceNo: string;
  source: string;
}

export interface BankReconciliationRow {
  statementDate: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  matchedReference: string;
  status: string;
}

export interface GSTSummaryRow {
  label: string;
  value: number;
}

export interface AgingRow {
  name: string;
  pendingAmount: number;
  dueDate: string;
  ageDays: number;
  agingBucket: string;
  reference: string;
}

export interface ReportTableModel<TRow extends object> {
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: TRow[];
  summaries: ReportSummaryItem[];
  exportBaseName: string;
  note?: string;
}

export interface MonthlyFinancePack {
  period: MonthlyReportPeriod;
  branchName: string;
  sales: ReportTableModel<SalesRegisterRow>;
  purchases: ReportTableModel<PurchaseRegisterRow>;
  expenses: ReportTableModel<ExpenseRegisterRow>;
  cashBook: ReportTableModel<CashBookReportRow>;
  bankReconciliation: ReportTableModel<BankReconciliationRow>;
  gst: {
    title: string;
    description: string;
    summaries: ReportSummaryItem[];
    outputRows: GSTSummaryRow[];
    inputRows: GSTSummaryRow[];
    exportBaseName: string;
  };
  profitAndLoss: {
    title: string;
    description: string;
    summaries: ReportSummaryItem[];
    exportBaseName: string;
  };
  receivables: ReportTableModel<AgingRow>;
  payables: ReportTableModel<AgingRow>;
}

export interface MonthlyFinancePackFilters {
  month: number;
  year: number;
}

export interface DashboardMetrics {
  totalSales: number;
  totalCollections: number;
  totalExpenses: number;
  totalPurchases: number;
  netProfit: number;
  outstandingDues: number;
  supplierDues: number;
}

export interface GSTReportData {
  month: number;
  year: number;
  outputTaxable: number;
  outputCGST: number;
  outputSGST: number;
  outputTotal: number;
  inputTaxable: number;
  inputCGST: number;
  inputSGST: number;
  inputTotal: number;
  netGSTPayable: number;
}

export interface TopProduct {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}
