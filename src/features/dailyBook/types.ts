import type { Bill, BillItem, CashBookEntry, Expense } from '@/types/database';

export interface BookBillItem extends BillItem {
  products?: { name: string; type: string; unit: string } | null;
}

export interface BookBill extends Bill {
  bill_items: BookBillItem[];
  farmers?: { name: string; village: string | null } | null;
}

export interface BookPayment {
  id: string;
  farmer_id: string | null;
  bill_id: string | null;
  amount: number;
  method: string | null;
  payment_date: string;
  created_at: string;
  farmers?: { name: string } | null;
  /** true when this payment was taken with a bill created the same day (sale receipt, not an old-dues collection) */
  isSameDaySale: boolean;
}

export interface BookStockReceipt {
  id: string;
  product_id: string;
  quantity: number;
  total_amount: number | null;
  invoice_number: string | null;
  created_at: string;
  products?: { name: string; unit: string } | null;
  suppliers?: { name: string } | null;
}

export interface BookProductSummary {
  productId: string;
  name: string;
  /** 'feed' | 'medicine' | other product type */
  type: string;
  unit: string;
  quantity: number;
  farmerCount: number;
  revenue: number;
  billCount: number;
  unpaidBillCount: number;
  unpaidAmount: number;
}

export interface BookFarmerSummary {
  /** farmer id, or `walkin:<billId>` for walk-in customers */
  key: string;
  farmerId: string | null;
  name: string;
  village: string | null;
  total: number;
  billCount: number;
  firstBillAt: string;
  unpaidToday: number;
  /** full outstanding across all dates (farmers.total_due) */
  outstanding: number;
}

export interface BookCashLine {
  id: string;
  time: string;
  label: string;
  amount: number;
  direction: 'in' | 'out';
  /** cash | upi | cheque | other — physical drawer cash is 'cash' only */
  method: string;
  source: string | null;
  referenceId: string | null;
}

export interface DailyBook {
  date: string;
  bills: BookBill[];
  payments: BookPayment[];
  expenses: Expense[];
  stockReceipts: BookStockReceipt[];
  cashEntries: CashBookEntry[];
  cashLines: BookCashLine[];
  openingCash: number;
  closingCash: number;
  products: BookProductSummary[];
  farmers: BookFarmerSummary[];
  totals: {
    billCount: number;
    salesTotal: number;
    cashSales: number;
    upiSales: number;
    creditGiven: number;
    creditFarmers: number;
    receivedTotal: number;
    oldCollections: number;
    expensesTotal: number;
    supplierPaid: number;
    yesterdaySales: number;
  };
}

export interface BookStockPositionRow {
  inventoryId: string;
  productId: string;
  name: string;
  unit: string;
  opening: number;
  sold: number;
  received: number;
  closing: number;
}

export interface FarmerDayView {
  farmer: {
    id: string;
    name: string;
    village: string | null;
    pond_acres: number | null;
    risk_status: string;
    total_due: number;
    phone: string | null;
  };
  todayBills: BookBill[];
  recentBills: BookBill[];
}
