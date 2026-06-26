import { Bill, BillItem, Farmer } from '@/types/database';

export interface CartItem {
  inventory_id: string;
  lot_id?: string | null;
  batch_number?: string | null;
  product_id: string;
  product_name: string;
  hsn_code: string | null;
  product_type: string;
  quantity: number;
  base_unit_price: number;
  unit_price: number;
  gst_rate: number;
  discount_percentage: number;
  default_discount_percentage?: number;
  farmer_discount_percentage?: number | null;
  discount_source?: 'product_default' | 'farmer_default' | 'farmer_product' | 'manual';
  discount_label?: string | null;
  mrp?: number;
  expiry_date?: string | null;
  max_quantity: number; // from inventory
  unit: string;
}

export interface BillingPayload {
  dealer_id: string;
  branch_id?: string | null;
  farmer_id?: string | null; // null for walk-in
  farmer_name_snapshot?: string | null;
  farmer_gstin?: string | null;
  bill_date?: string;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  payment_type?: string | null;
  upi_ref?: string | null;
  cheque_number?: string | null;
  notes?: string | null;
  credit_override_used?: boolean;
  credit_override_reason?: string | null;
  type?: 'sale' | 'adjustment';
  is_historical?: boolean;
  reduce_stock?: boolean;
  items: Omit<CartItem, 'max_quantity' | 'unit' | 'product_type' | 'base_unit_price'>[];
}

export interface CreateBillResult {
  bill_id: string;
  bill_number: string;
  payment_id?: string | null;
  balance_due: number;
  subtotal?: number;
  gst_amount?: number;
  total?: number;
}

export interface FifoBillLine {
  inventory_id: string;
  product_id: string;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  base_unit_price: number;
  discount_percentage: number;
  discount_source?: 'product_default' | 'farmer_default' | 'farmer_product' | 'manual' | null;
  discount_label?: string | null;
  gst_rate: number;
  gst_amount: number;
  total_price: number;
  mrp?: number | null;
  lot_id?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
}

export interface FifoBillPreview {
  lines: FifoBillLine[];
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total: number;
}
