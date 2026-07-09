import { supabase } from '@/lib/supabase';
import {
  buildAgingRows,
  buildBankReconciliationRows,
  buildCashBookRows,
  buildExpenseRows,
  buildGSTSummaries,
  buildPurchaseRegisterRows,
  buildSalesRegisterRows,
  currencySummary,
  getMonthlyReportPeriod,
  numberSummary,
  DEFAULT_BANK_RECONCILIATION_NOTE,
} from '../utils/reportBuilders';
import {
  AgingRow,
  DashboardMetrics,
  GSTReportData,
  MonthlyFinancePack,
  MonthlyReportPeriod,
  ReportColumn,
  ReportTableModel,
  TopProduct,
} from '../types';
import { Bill, BillItem, CashBookEntry, Expense, Farmer, Payment, Product, StockPurchase, Supplier, SupplierPayment } from '@/types/database';

type DealerBranch = { id: string; name: string };

const toNumber = (value: number | null | undefined) => Number(value || 0);

const getBranchName = (branchId: string | null | undefined, branches: DealerBranch[]) => {
  if (!branchId) return 'All branches';
  return branches.find((branch) => branch.id === branchId)?.name || 'Branch';
};

const buildColumnSet = (columns: ReportColumn[]) => columns;

export const reportsService = {
  async getMonthlyFinancePack(
    dealerId: string,
    branchId: string | null | undefined,
    monthOrStartDate: number | string,
    yearOrEndDate: number | string
  ): Promise<MonthlyFinancePack> {
    let period;
    if (typeof monthOrStartDate === 'string' && typeof yearOrEndDate === 'string') {
      const s = new Date(monthOrStartDate);
      const e = new Date(yearOrEndDate);
      period = {
        startDate: monthOrStartDate,
        endDate: yearOrEndDate,
        label: `${s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${e.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        month: s.getMonth() + 1,
        year: e.getFullYear()
      };
    } else {
      period = getMonthlyReportPeriod(monthOrStartDate as number, yearOrEndDate as number);
    }

    let billsQuery = supabase
      .from('bills')
      .select('*, bill_items(*)')
      .eq('dealer_id', dealerId)
      .neq('status', 'cancelled')
      .gte('bill_date', period.startDate)
      .lte('bill_date', period.endDate)
      .order('bill_date', { ascending: true })
      .order('created_at', { ascending: true });

    let purchasesQuery = supabase
      .from('stock_purchases')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('purchase_date', period.startDate)
      .lte('purchase_date', period.endDate)
      .order('purchase_date', { ascending: true })
      .order('created_at', { ascending: true });

    let expensesQuery = supabase
      .from('expenses')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('expense_date', period.startDate)
      .lte('expense_date', period.endDate)
      .order('expense_date', { ascending: true })
      .order('created_at', { ascending: true });

    let cashBookQuery = supabase
      .from('cash_book')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('entry_date', period.startDate)
      .lte('entry_date', period.endDate)
      .order('entry_date', { ascending: true })
      .order('created_at', { ascending: true });

    let openingCashQuery = supabase
      .from('cash_book')
      .select('entry_type, amount')
      .eq('dealer_id', dealerId)
      .lt('entry_date', period.startDate);

    let paymentsQuery = supabase
      .from('payments')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('payment_date', period.startDate)
      .lte('payment_date', period.endDate)
      .order('payment_date', { ascending: true })
      .order('created_at', { ascending: true });

    let supplierPaymentsQuery = supabase
      .from('supplier_payments')
      .select('*')
      .eq('dealer_id', dealerId)
      .gte('payment_date', period.startDate)
      .lte('payment_date', period.endDate)
      .order('payment_date', { ascending: true })
      .order('created_at', { ascending: true });

    let farmersQuery = supabase
      .from('farmers')
      .select('id, name, total_due, opening_balance, created_at')
      .eq('dealer_id', dealerId)
      .eq('is_active', true);

    let openBillsQuery = supabase
      .from('bills')
      .select('id, farmer_name_snapshot, balance_due, bill_date, bill_number')
      .eq('dealer_id', dealerId)
      .neq('status', 'cancelled')
      .gt('balance_due', 0)
      .lte('bill_date', period.endDate);

    let openPurchasesQuery = supabase
      .from('stock_purchases')
      .select('id, supplier_id, total_amount, purchase_date, invoice_number')
      .eq('dealer_id', dealerId)
      .lte('purchase_date', period.endDate);

    let suppliersQuery = supabase
      .from('suppliers')
      .select('id, name, company, total_due, credit_days, created_at')
      .eq('dealer_id', dealerId);

    let productsQuery = supabase
      .from('products')
      .select('id, name, category, type')
      .eq('is_active', true);

    let branchesQuery = supabase
      .from('branches')
      .select('id, name')
      .eq('dealer_id', dealerId);

    if (branchId) {
      billsQuery = billsQuery.eq('branch_id', branchId);
      purchasesQuery = purchasesQuery.eq('branch_id', branchId);
      expensesQuery = expensesQuery.eq('branch_id', branchId);
      cashBookQuery = cashBookQuery.eq('branch_id', branchId);
      openingCashQuery = openingCashQuery.eq('branch_id', branchId);
      paymentsQuery = paymentsQuery.eq('branch_id', branchId);
      farmersQuery = farmersQuery.eq('branch_id', branchId);
      openBillsQuery = openBillsQuery.eq('branch_id', branchId);
      openPurchasesQuery = openPurchasesQuery.eq('branch_id', branchId);
    }

    const [
      { data: bills, error: billsError },
      { data: purchases, error: purchasesError },
      { data: expenses, error: expensesError },
      { data: cashBookEntries, error: cashBookError },
      { data: openingCashEntries, error: openingCashError },
      { data: payments, error: paymentsError },
      { data: supplierPayments, error: supplierPaymentsError },
      { data: farmers, error: farmersError },
      { data: suppliers, error: suppliersError },
      { data: products, error: productsError },
      { data: branches, error: branchesError },
      { data: openBills, error: openBillsError },
      { data: openPurchases, error: openPurchasesError },
    ] = await Promise.all([
      billsQuery,
      purchasesQuery,
      expensesQuery,
      cashBookQuery,
      openingCashQuery,
      paymentsQuery,
      supplierPaymentsQuery,
      farmersQuery,
      suppliersQuery,
      productsQuery,
      branchesQuery,
      openBillsQuery,
      openPurchasesQuery,
    ]);

    if (billsError) throw billsError;
    if (purchasesError) throw purchasesError;
    if (expensesError) throw expensesError;
    if (cashBookError) throw cashBookError;
    if (openingCashError) throw openingCashError;
    if (paymentsError) throw paymentsError;
    if (supplierPaymentsError) throw supplierPaymentsError;
    if (farmersError) throw farmersError;
    if (suppliersError) throw suppliersError;
    if (productsError) throw productsError;
    if (branchesError) throw branchesError;
    if (openBillsError) throw openBillsError;
    if (openPurchasesError) throw openPurchasesError;

    const billsList = (bills || []) as Array<Bill & { bill_items?: BillItem[] }>;
    const purchasesList = (purchases || []) as StockPurchase[];
    const expensesList = (expenses || []) as Expense[];
    const cashBookList = (cashBookEntries || []) as CashBookEntry[];
    const openingCashList = (openingCashEntries || []) as Array<Pick<CashBookEntry, 'entry_type' | 'amount'>>;
    const paymentList = (payments || []) as Payment[];
    const supplierPaymentList = (supplierPayments || []) as SupplierPayment[];
    const farmerList = (farmers || []) as Array<Pick<Farmer, 'id' | 'name' | 'total_due' | 'opening_balance' | 'created_at'>>;
    const supplierList = (suppliers || []) as Supplier[];
    const productList = (products || []) as Product[];
    const branchList = (branches || []) as DealerBranch[];
    const openBillsList = (openBills || []) as any[];
    const openPurchasesList = (openPurchases || []) as any[];

    const paymentsByBillId = new Map<string, Payment[]>();
    paymentList.forEach((payment) => {
      if (!payment.bill_id) return;
      const bucket = paymentsByBillId.get(payment.bill_id) || [];
      bucket.push(payment);
      paymentsByBillId.set(payment.bill_id, bucket);
    });

    const supplierPaymentsByPurchaseId = new Map<string, SupplierPayment[]>();
    supplierPaymentList.forEach((payment) => {
      if (!payment.purchase_id) return;
      const bucket = supplierPaymentsByPurchaseId.get(payment.purchase_id) || [];
      bucket.push(payment);
      supplierPaymentsByPurchaseId.set(payment.purchase_id, bucket);
    });

    const billItemsByBillId = new Map<string, BillItem[]>();
    billsList.forEach((bill) => {
      billItemsByBillId.set(bill.id, ((bill.bill_items || []) as BillItem[]));
    });

    const suppliersById = new Map(supplierList.map((supplier) => [supplier.id, supplier]));
    const productsById = new Map(productList.map((product) => [product.id, product]));

    const resolvedBranchName = branchId ? getBranchName(branchId, branchList) : 'All branches';

    const salesRows = buildSalesRegisterRows(
      billsList,
      billItemsByBillId,
      paymentsByBillId,
      resolvedBranchName,
      productsById
    );

    const purchaseRows = buildPurchaseRegisterRows(
      purchasesList,
      suppliersById,
      productsById,
      supplierPaymentsByPurchaseId,
      resolvedBranchName
    );

    const productStats = new Map<string, { quantity: number; revenue: number }>();
    billsList.forEach(bill => {
      const items = billItemsByBillId.get(bill.id) || [];
      items.forEach(item => {
        if (!item.product_id) return;
        const current = productStats.get(item.product_id) || { quantity: 0, revenue: 0 };
        current.quantity += toNumber(item.quantity);
        current.revenue += toNumber(item.total_price);
        productStats.set(item.product_id, current);
      });
    });

    const topProductsRows: TopProduct[] = Array.from(productStats.entries())
      .map(([productId, stats]) => {
        const product = productsById.get(productId);
        return {
          id: productId,
          name: product?.name || 'Unknown Product',
          quantity: stats.quantity,
          revenue: stats.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const expenseRows = buildExpenseRows(expensesList, resolvedBranchName);

    const openingBalance = openingCashList.reduce((sum, entry) => sum + (entry.entry_type === 'income' ? toNumber(entry.amount) : -toNumber(entry.amount)), 0);
    const cashBookRows = buildCashBookRows(cashBookList, openingBalance);
    const bankRows = buildBankReconciliationRows(cashBookRows);

    const totalSales = billsList.reduce((sum, bill) => sum + toNumber(bill.total), 0);
    const pendingSales = billsList.reduce((sum, bill) => sum + toNumber(bill.balance_due), 0);
    const totalCollections = billsList.reduce((sum, bill) => sum + toNumber(bill.amount_paid), 0);
    const totalExpenses = expenseRows.reduce((sum, row) => sum + row.amount, 0);
    const totalPurchases = purchaseRows.reduce((sum, row) => sum + row.amount, 0);
    const outstandingDues = farmerList.reduce((sum, farmer) => sum + toNumber(farmer.total_due), 0);
    const supplierDues = supplierList.reduce((sum, supplier) => sum + toNumber(supplier.total_due), 0);

    const outputTaxable = salesRows.reduce((sum, row) => sum + row.taxableValue, 0);
    const outputTotal = salesRows.reduce((sum, row) => sum + row.gstAmount, 0);
    const inputTaxable = purchaseRows.reduce((sum, row) => sum + row.amount - row.gstAmount, 0);
    const inputTotal = purchaseRows.reduce((sum, row) => sum + row.gstAmount, 0);
    
    const netProfit = outputTaxable - inputTaxable - totalExpenses;
    const gstTotals = buildGSTSummaries(outputTotal, inputTotal, outputTaxable, inputTaxable);

    const receivableRows: AgingRow[] = buildAgingRows(
      openBillsList.map((bill) => ({
        id: bill.id,
        name: bill.farmer_name_snapshot || 'Walk-in Customer',
        pendingAmount: bill.balance_due,
        baseDate: bill.bill_date,
        reference: bill.bill_number,
      }))
    );

    const payablesRows: AgingRow[] = buildAgingRows(
      openPurchasesList
        .map((purchase) => {
          const supplier = purchase.supplier_id ? suppliersById.get(purchase.supplier_id) : null;
          // Note: supplierPaymentList only has payments for the period. For true aging, 
          // we might just rely on total_amount - paidAmount but openPurchases query doesn't have paid_amount yet.
          // Wait, openPurchases is better to use `is_paid` and track cumulative payments, but
          // we just use `supplierDues` or approximate it if true payment data per purchase isn't loaded.
          // Since we didn't join payments in openPurchases, let's keep the existing logic 
          // but apply it to the openPurchasesList.
          const paidAmount = (supplierPaymentList || [])
            .filter((entry) => entry.purchase_id === purchase.id)
            .reduce((sum, entry) => sum + toNumber(entry.amount), 0);
          const pendingAmount = Math.max(0, toNumber(purchase.total_amount) - paidAmount);

          return {
            id: purchase.id,
            name: supplier?.company || supplier?.name || 'Supplier',
            pendingAmount,
            baseDate: purchase.purchase_date,
            reference: purchase.invoice_number || purchase.id.slice(0, 8).toUpperCase(),
          };
        })
        .filter((entry) => entry.pendingAmount > 0)
    );

    return {
      period,
      branchName: resolvedBranchName,
      sales: {
        title: 'Sales Register',
        description: 'Monthly sales register with GST and payment details.',
        columns: buildColumnSet([
          { key: 'date', label: 'Date' },
          { key: 'invoiceNo', label: 'Invoice No' },
          { key: 'customerName', label: 'Customer Name' },
          { key: 'itemService', label: 'Product / Service' },
          { key: 'qty', label: 'Qty', align: 'right', type: 'number' },
          { key: 'taxableValue', label: 'Taxable Value', align: 'right' },
          { key: 'gstRate', label: 'GST %', align: 'right', type: 'number' },
          { key: 'gstAmount', label: 'GST Amount', align: 'right' },
          { key: 'paymentStatus', label: 'Payment Status' },
          { key: 'paymentMode', label: 'Payment Mode' },
          { key: 'transactionId', label: 'Transaction ID' },
          { key: 'branch', label: 'Branch' },
        ]),
        rows: salesRows,
        summaries: [
          numberSummary('Bills', salesRows.length),
          currencySummary('Total Sales', totalSales),
          currencySummary('Collections', totalCollections),
          currencySummary('Pending', pendingSales),
        ],
        exportBaseName: `sales_register_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      purchases: {
        title: 'Purchase Register',
        description: 'Supplier purchases with GST treatment and payment mode.',
        columns: buildColumnSet([
          { key: 'date', label: 'Date' },
          { key: 'vendor', label: 'Vendor' },
          { key: 'billNo', label: 'Bill No' },
          { key: 'medicineName', label: 'Product Name' },
          { key: 'stockCount', label: 'Qty', align: 'right', type: 'number' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'gstAmount', label: 'GST', align: 'right' },
          { key: 'paymentMode', label: 'Payment Mode' },
          { key: 'taxFlag', label: 'Tax Flag' },
          { key: 'branch', label: 'Branch' },
        ]),
        rows: purchaseRows,
        summaries: [
          numberSummary('Purchases', purchaseRows.length),
          currencySummary('Total Purchase Value', totalPurchases),
          currencySummary('Input GST', inputTotal),
        ],
        exportBaseName: `purchase_register_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      expenses: {
        title: 'Expense Report',
        description: 'Operational expenses grouped for monthly review.',
        columns: buildColumnSet([
          { key: 'date', label: 'Date' },
          { key: 'category', label: 'Category' },
          { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount', align: 'right' },
          { key: 'paymentMode', label: 'Payment Mode' },
          { key: 'branch', label: 'Branch' },
        ]),
        rows: expenseRows,
        summaries: [
          numberSummary('Expense Entries', expenseRows.length),
          currencySummary('Total Expenses', totalExpenses),
        ],
        exportBaseName: `expense_report_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      cashBook: {
        title: 'Cash Book',
        description: 'Cash inflow and outflow ledger with running balance.',
        columns: buildColumnSet([
          { key: 'date', label: 'Date' },
          { key: 'particulars', label: 'Particulars' },
          { key: 'cashIn', label: 'Cash In', align: 'right' },
          { key: 'cashOut', label: 'Cash Out', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
          { key: 'referenceNo', label: 'Ref No' },
          { key: 'source', label: 'Source' },
        ]),
        rows: cashBookRows,
        summaries: [
          numberSummary('Cash Entries', cashBookRows.length),
          currencySummary('Net Cash Movement', cashBookRows.reduce((sum, row) => sum + row.cashIn - row.cashOut, 0)),
          currencySummary('Closing Balance', cashBookRows.length ? cashBookRows[cashBookRows.length - 1].balance : openingBalance),
        ],
        exportBaseName: `cash_book_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      bankReconciliation: {
        title: 'Bank Reconciliation',
        description: 'Import-ready worksheet for matching bank statement lines.',
        columns: buildColumnSet([
          { key: 'statementDate', label: 'Statement Date' },
          { key: 'description', label: 'Description' },
          { key: 'debit', label: 'Debit', align: 'right' },
          { key: 'credit', label: 'Credit', align: 'right' },
          { key: 'balance', label: 'Balance', align: 'right' },
          { key: 'matchedReference', label: 'Matched Reference' },
          { key: 'status', label: 'Status' },
        ]),
        rows: bankRows,
        summaries: [
          numberSummary('Ledger Lines', bankRows.length),
          numberSummary('Unreconciled', bankRows.filter((row) => row.status !== 'Matched to ledger').length),
        ],
        exportBaseName: `bank_reconciliation_${period.year}_${String(period.month).padStart(2, '0')}`,
        note: DEFAULT_BANK_RECONCILIATION_NOTE,
      },
      gst: {
        title: 'GST Pack',
        description: 'GST review pack for GSTR-1, GSTR-3B, and ITC checks.',
        summaries: [
          numberSummary('Month', period.month),
          numberSummary('Year', period.year),
          currencySummary('Output GST', outputTotal),
          currencySummary('Input GST', inputTotal),
          currencySummary('Net GST Payable', gstTotals.netGSTPayable),
        ],
        outputRows: gstTotals.outputRows,
        inputRows: gstTotals.inputRows,
        exportBaseName: `gst_pack_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      profitAndLoss: {
        title: 'Profit & Loss',
        description: 'Monthly profitability snapshot from recorded business data.',
        summaries: [
          currencySummary('Revenue (Net GST)', outputTaxable),
          currencySummary('Total Purchases (Net GST)', inputTaxable),
          currencySummary('Total Expenses', totalExpenses),
          currencySummary('Net Profit', netProfit),
        ],
        exportBaseName: `profit_loss_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      receivables: {
        title: 'Receivables Aging',
        description: 'Outstanding customer balances with aging buckets.',
        columns: buildColumnSet([
          { key: 'name', label: 'Customer' },
          { key: 'pendingAmount', label: 'Pending Amount', align: 'right' },
          { key: 'dueDate', label: 'Due Date' },
          { key: 'ageDays', label: 'Age (Days)', align: 'right', type: 'number' },
          { key: 'agingBucket', label: 'Aging Bucket' },
          { key: 'reference', label: 'Reference' },
        ]),
        rows: receivableRows,
        summaries: [
          numberSummary('Open Customers', receivableRows.length),
          currencySummary('Receivable Total', receivableRows.reduce((sum, row) => sum + row.pendingAmount, 0)),
        ],
        exportBaseName: `receivables_aging_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      payables: {
        title: 'Payables Aging',
        description: 'Outstanding supplier balances with aging buckets.',
        columns: buildColumnSet([
          { key: 'name', label: 'Vendor' },
          { key: 'pendingAmount', label: 'Pending Amount', align: 'right' },
          { key: 'dueDate', label: 'Due Date' },
          { key: 'ageDays', label: 'Age (Days)', align: 'right', type: 'number' },
          { key: 'agingBucket', label: 'Aging Bucket' },
          { key: 'reference', label: 'Reference' },
        ]),
        rows: payablesRows,
        summaries: [
          numberSummary('Open Vendors', payablesRows.length),
          currencySummary('Payable Total', payablesRows.reduce((sum, row) => sum + row.pendingAmount, 0)),
        ],
        exportBaseName: `payables_aging_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      topProducts: {
        title: 'Top Products',
        description: 'Best performing products by revenue for the selected period.',
        columns: buildColumnSet([
          { key: 'name', label: 'Product Name' },
          { key: 'quantity', label: 'Quantity Sold', align: 'right', type: 'number' },
          { key: 'revenue', label: 'Revenue', align: 'right' },
        ]),
        rows: topProductsRows,
        summaries: [
          numberSummary('Total Products Sold', topProductsRows.length),
          currencySummary('Total Product Revenue', topProductsRows.reduce((sum, p) => sum + p.revenue, 0)),
        ],
        exportBaseName: `top_products_${period.year}_${String(period.month).padStart(2, '0')}`,
      },
      rawTotals: {
        totalSales,
        totalCollections,
        totalExpenses,
        totalPurchases,
        netProfit,
        outstandingDues,
        supplierDues,
      },
    };
  },

  async getDashboardMetrics(
    dealerId: string,
    branchId?: string | null,
    monthOrStartDate?: string | number,
    endDateOrYear?: string | number
  ): Promise<DashboardMetrics> {
    if (typeof monthOrStartDate === 'number' && typeof endDateOrYear === 'number') {
      const pack = await reportsService.getMonthlyFinancePack(dealerId, branchId, monthOrStartDate, endDateOrYear);
      return pack.rawTotals;
    }

    const startDate = typeof monthOrStartDate === 'string' ? monthOrStartDate : undefined;
    const endDate = typeof endDateOrYear === 'string' ? endDateOrYear : undefined;

    let billsQuery = supabase.from('bills').select('total, amount_paid').eq('dealer_id', dealerId).neq('status', 'cancelled');
    let expensesQuery = supabase.from('expenses').select('amount').eq('dealer_id', dealerId);
    let purchasesQuery = supabase.from('stock_purchases').select('total_amount').eq('dealer_id', dealerId);
    let farmersQuery = supabase.from('farmers').select('total_due').eq('dealer_id', dealerId);
    let suppliersQuery = supabase.from('suppliers').select('total_due').eq('dealer_id', dealerId);

    if (branchId) {
      billsQuery = billsQuery.eq('branch_id', branchId);
      expensesQuery = expensesQuery.eq('branch_id', branchId);
      purchasesQuery = purchasesQuery.eq('branch_id', branchId);
      farmersQuery = farmersQuery.eq('branch_id', branchId);
    }

    if (startDate) {
      billsQuery = billsQuery.gte('bill_date', startDate);
      expensesQuery = expensesQuery.gte('expense_date', startDate);
      purchasesQuery = purchasesQuery.gte('purchase_date', startDate);
    }

    if (endDate) {
      billsQuery = billsQuery.lte('bill_date', endDate);
      expensesQuery = expensesQuery.lte('expense_date', endDate);
      purchasesQuery = purchasesQuery.lte('purchase_date', endDate);
    }

    const [{ data: bills }, { data: expenses }, { data: purchases }, { data: farmers }, { data: suppliers }] = await Promise.all([
      billsQuery,
      expensesQuery,
      purchasesQuery,
      farmersQuery,
      suppliersQuery,
    ]);

    const totalSales = (bills || []).reduce((sum, b) => sum + (b.total || 0), 0);
    const totalCollections = (bills || []).reduce((sum, b) => sum + (b.amount_paid || 0), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases = (purchases || []).reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const outstandingDues = (farmers || []).reduce((sum, f) => sum + (f.total_due || 0), 0);
    const supplierDues = (suppliers || []).reduce((sum, s) => sum + (s.total_due || 0), 0);
    const netProfit = totalSales - totalPurchases - totalExpenses;

    return {
      totalSales,
      totalCollections,
      totalExpenses,
      totalPurchases,
      netProfit,
      outstandingDues,
      supplierDues,
    };
  },

  async getGSTReport(
    dealerId: string,
    branchId: string | null,
    month: number,
    year: number
  ): Promise<GSTReportData> {
    const pack = await reportsService.getMonthlyFinancePack(dealerId, branchId, month, year);
    const outputTaxable = pack.gst.outputRows.find((row) => row.label === 'Taxable Sales')?.value || 0;
    const outputTotal = pack.gst.outputRows.find((row) => row.label === 'Output GST')?.value || 0;
    const inputTaxable = pack.gst.inputRows.find((row) => row.label === 'Taxable Purchases')?.value || 0;
    const inputTotal = pack.gst.inputRows.find((row) => row.label === 'Input GST')?.value || 0;

    return {
      month,
      year,
      outputTaxable,
      outputCGST: outputTotal / 2,
      outputSGST: outputTotal / 2,
      outputTotal,
      inputTaxable,
      inputCGST: inputTotal / 2,
      inputSGST: inputTotal / 2,
      inputTotal,
      netGSTPayable: outputTotal - inputTotal,
    };
  },
};
