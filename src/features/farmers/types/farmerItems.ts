export type FarmerItemPaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface FarmerItemsSummary {
  total_products: number;
  total_quantity: number;
  total_value: number;
  paid_amount: number;
  unpaid_amount: number;
}

export interface FarmerItemsInsights {
  top_product_name: string | null;
  average_days_between_purchases: number | null;
  predicted_next_purchase_date: string | null;
  overdue_product_names: string[];
}

export interface FarmerItemSummary {
  product_id: string;
  product_name: string;
  product_type: string;
  category: string | null;
  unit: string;
  total_quantity: number;
  total_value: number;
  paid_amount: number;
  unpaid_amount: number;
  bill_count: number;
  last_purchased_on: string;
}

export interface FarmerItemsResponse {
  summary: FarmerItemsSummary;
  insights: FarmerItemsInsights;
  items: FarmerItemSummary[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface FarmerItemBill {
  bill_id: string;
  bill_number: string;
  bill_date: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  balance_due: number;
  amount_paid: number;
  bill_total: number;
  payment_status: FarmerItemPaymentStatus;
}

export type FarmerItemsPeriod =
  | 'this-week'
  | 'this-month'
  | 'last-month'
  | 'this-season'
  | 'last-3-months'
  | 'last-6-months'
  | 'this-year'
  | 'custom';
