// src/features/estimates/types.ts

export interface EstimateCartItem {
  product_id: string;
  product_name: string;
  hsn_code: string | null;
  product_type: string;
  unit: string;
  quantity: number;
  base_unit_price: number;
  unit_price: number;           // base_unit_price * (1 - discount_pct/100)
  discount_percentage: number;
  gst_rate: number;
  mrp?: number;
  default_discount_percentage?: number;
  farmer_discount_percentage?: number | null;
  discount_source?: 'product_default' | 'farmer_default' | 'farmer_product' | 'manual';
  discount_label?: string | null;
}

export interface EstimatePayload {
  dealer_id: string;
  branch_id?: string | null;
  farmer_id: string;
  farmer_name_snapshot?: string | null;
  branch_name_snapshot?: string | null;
  estimate_date: string;        // YYYY-MM-DD
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total: number;
  notes?: string | null;
  items: Array<{
    product_id: string;
    product_name: string;
    hsn_code?: string | null;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    gst_rate: number;
    total_price: number;
  }>;
}

export interface EstimateListItem {
  id: string;
  estimate_number: string;
  farmer_id: string;
  farmer_name: string;
  estimate_date: string;
  total: number;
  status: 'active' | 'cancelled';
  created_at: string;
}

export interface EstimateItemDetail {
  id: string;
  product_id: string | null;
  product_name: string;
  hsn_code: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  gst_rate: number;
  total_price: number;
}

export interface Estimate {
  id: string;
  estimate_number: string;
  dealer_id: string;
  branch_id: string | null;
  farmer_id: string;
  farmer_name_snapshot: string | null;
  branch_name_snapshot: string | null;
  estimate_date: string;
  subtotal: number;
  gst_amount: number;
  discount_amount: number;
  total: number;
  notes: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  items: EstimateItemDetail[];
}
