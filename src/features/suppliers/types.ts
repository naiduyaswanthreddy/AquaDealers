import { Supplier, SupplierPayment, StockPurchase, Product } from '@/types/database';

export interface SupplierItem extends Supplier {}

export interface SupplierInsert {
  dealer_id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  gstin?: string | null;
  address?: string | null;
  credit_days?: number;
  opening_balance?: number;
  notes?: string | null;
}

export interface SupplierUpdate extends Partial<SupplierInsert> {
  id: string;
}

export interface PurchaseItem extends StockPurchase {
  product?: Product;
}

export interface PaymentItem extends SupplierPayment {}

export interface SupplierTransaction {
  id: string;
  date: string;
  type: 'purchase' | 'payment';
  amount: number;
  reference: string | null;
  details?: any; // PurchaseItem or PaymentItem
}

export interface PurchasePayload {
  dealer_id: string;
  branch_id?: string | null;
  product_id: string;
  supplier_id: string;
  quantity: number;
  cost_price_per_unit: number;
  gst_amount: number;
  total_amount: number;
  purchase_date: string;
  invoice_number?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  is_paid: boolean;
  notes?: string | null;
  selling_price?: number; // Used to update inventory
  mrp?: number;
  medicine_discount_percentage?: number;
  payment_method?: string | null;
}

export interface PurchaseResult {
  purchase_id: string;
  inventory_id: string;
  lot_id: string;
}

export interface SupplierPaymentResult {
  supplier_payment_id: string;
}
