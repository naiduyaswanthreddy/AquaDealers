/* ──────────────────────────────────────────────
   AquaDealers — Database Type Definitions
   Mirrors the Supabase/PostgreSQL schema exactly.
   ────────────────────────────────────────────── */

export interface Dealer {
  id: string;
  name: string;
  shop_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  district: string | null;
  state: string;
  gstin: string | null;
  drug_license_no: string | null;
  language: string;
  plan: string;
  plan_expires_at: string | null;
  is_active: boolean;
  gst_billing_enabled: boolean;
  bill_signature_enabled: boolean;
  farmer_product_discounts_enabled?: boolean;
  pin_hash: string | null;
  pin_timeout_minutes: number;
  avatar_url: string | null;
  authorized_signatory_data?: any[] | null;
  custom_features?: string[] | null;
  created_at: string;
}

export interface DealerInsert {
  name: string;
  shop_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  district?: string | null;
  state?: string;
  gstin?: string | null;
  drug_license_no?: string | null;
  language?: string;
  plan?: string;
  plan_expires_at?: string | null;
  is_active?: boolean;
  gst_billing_enabled?: boolean;
  bill_signature_enabled?: boolean;
  farmer_product_discounts_enabled?: boolean;
  pin_hash?: string | null;
  pin_timeout_minutes?: number;
  avatar_url?: string | null;
  authorized_signatory_data?: any[] | null;
  custom_features?: string[];
}

export interface Branch {
  id: string;
  dealer_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  feed_image_url: string | null;
  is_main: boolean;
  is_active: boolean;
  invoice_template: string | null;
  statement_template: string | null;
  template_settings: any | null;
  created_at: string;
}

export interface BranchInsert {
  dealer_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  feed_image_url?: string | null;
  is_main?: boolean;
  is_active?: boolean;
}

export type StaffAccessMode = 'visible' | 'disabled' | 'hidden';

export type StaffFeatureKey =
  | 'dashboard'
  | 'billHistory'
  | 'newBill'
  | 'farmerList'
  | 'addFarmer'
  | 'inventory'
  | 'suppliers'
  | 'cashbook'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'branches'
  | 'staffManagement';

export interface StaffPermissions extends Record<StaffFeatureKey, StaffAccessMode> {}

export interface StaffMember {
  id: string;
  dealer_id: string;
  name: string;
  phone: string | null;
  pin_hash: string;
  branch_ids: string[];
  permissions: StaffPermissions;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMemberInsert {
  dealer_id: string;
  name: string;
  phone?: string | null;
  pin_hash: string;
  branch_ids?: string[];
  permissions?: StaffPermissions;
  is_active?: boolean;
}

export interface Farmer {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  name: string;
  phone: string | null;
  village: string | null;
  mandal: string | null;
  district: string | null;
  pond_acres: number | null;
  stocking_date: string | null;
  estimated_harvest_date: string | null;
  crop_status: string;
  risk_status: string;
  credit_limit: number;
  default_medicine_discount_percentage?: number;
  opening_balance: number;
  total_due: number;
  is_active: boolean;
  notes: string | null;
  image_url: string | null;
  risk_updated_at: string | null;
  is_walk_in?: boolean;
  created_at: string;
}

export interface FarmerInsert {
  dealer_id: string;
  branch_id?: string | null;
  name: string;
  phone?: string | null;
  village?: string | null;
  mandal?: string | null;
  district?: string | null;
  pond_acres?: number | null;
  stocking_date?: string | null;
  estimated_harvest_date?: string | null;
  crop_status?: string;
  risk_status?: string;
  credit_limit?: number;
  default_medicine_discount_percentage?: number;
  opening_balance?: number;
  total_due?: number;
  is_active?: boolean;
  notes?: string | null;
  image_url?: string | null;
  is_walk_in?: boolean;
}

export interface Product {
  id: string;
  dealer_id: string;
  type: string; // 'feed' | 'medicine'
  company: string | null;
  name: string;
  variant: string | null;
  category: string | null; // e.g. antibiotic, probiotic, vitamin, pond_care
  unit: string;
  hsn_code: string | null;
  gst_rate: number;
  default_price: number | null;
  track_expiry: boolean;
  is_active: boolean;
  medicine_discount_percentage?: number;
  created_at: string;
}

export interface ProductInsert {
  dealer_id: string;
  type: string;
  company?: string | null;
  name: string;
  variant?: string | null;
  category?: string | null;
  unit?: string;
  hsn_code?: string | null;
  gst_rate?: number;
  default_price?: number | null;
  track_expiry?: boolean;
  is_active?: boolean;
  medicine_discount_percentage?: number;
}

export interface FarmerProductDiscount {
  id: string;
  dealer_id: string;
  farmer_id: string;
  product_id: string;
  discount_percentage: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface Inventory {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  product_id: string;
  quantity_in_stock: number;
  cost_price: number | null;
  mrp?: number | null;
  selling_price: number | null;
  medicine_discount_percentage: number;
  min_stock_alert: number;
  expiry_date: string | null;
  batch_number: string | null;
  image_url: string | null;
  updated_at: string;
}

export interface StockPurchase {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  product_id: string;
  supplier_id: string | null;
  quantity: number;
  cost_price_per_unit: number | null;
  mrp?: number | null;
  gst_amount: number;
  total_amount: number | null;
  purchase_date: string;
  invoice_number: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  is_paid: boolean;
  notes: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  bill_number: string;
  dealer_id: string;
  branch_id: string | null;
  farmer_id: string | null;
  farmer_name_snapshot: string | null;
  farmer_gstin: string | null;
  bill_date: string;
  subtotal: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  payment_type: string | null;
  upi_ref: string | null;
  cheque_number: string | null;
  notes: string | null;
  status: string;
  type?: string;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  printed_at?: string | null;
  shared_at?: string | null;
  credit_override_used?: boolean;
  credit_override_reason?: string | null;
  created_at: string;
}

export interface BillItem {
  id: string;
  bill_id: string;
  product_id: string | null;
  product_name_snapshot: string | null;
  hsn_code_snapshot: string | null;
  quantity: number;
  unit_price: number;
  mrp?: number | null;
  gst_rate: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_price: number;
  inventory_id_snapshot?: string | null;
}

export interface BillSignature {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  bill_id: string;
  storage_path: string | null;
  signature_data: SignatureStroke[] | null;
  canvas_width: number;
  canvas_height: number;
  signer_name: string | null;
  captured_at: string;
  created_at: string;
}

export interface SignaturePoint {
  x: number;
  y: number;
}

export type SignatureStroke = SignaturePoint[];

export interface Payment {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  farmer_id: string | null;
  bill_id: string | null;
  amount: number;
  payment_date: string;
  method: string | null;
  upi_ref: string | null;
  cheque_no: string | null;
  notes: string | null;
  allocation_mode?: string | null;
  receipt_number?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  category: string | null;
  amount: number;
  description: string | null;
  expense_date: string;
  paid_via: string;
  created_at: string;
}

export interface CashBookEntry {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  entry_type: string; // 'income' | 'expense' (matches entry_type column)
  source: string | null;
  reference_id: string | null;
  amount: number;
  notes: string | null;
  entry_date: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  dealer_id: string;
  name: string;
  company: string | null;
  phone: string | null;
  alternate_phone?: string | null;
  photo_url?: string | null;
  gstin: string | null;
  address: string | null;
  credit_days: number;
  opening_balance: number;
  total_due: number;
  notes: string | null;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  dealer_id: string;
  supplier_id: string | null;
  purchase_id: string | null;
  amount: number;
  payment_date: string;
  method: string | null;
  notes: string | null;
  created_at: string;
}

export interface GSTLedger {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  month: number;
  year: number;
  output_taxable: number;
  output_cgst: number;
  output_sgst: number;
  output_igst: number;
  output_total: number;
  input_taxable: number;
  input_cgst: number;
  input_sgst: number;
  input_igst: number;
  input_total: number;
  net_gst_payable: number;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface PlanDefinition {
  id: string;
  name: string;
  price_monthly: number | null;
  farmer_limit: number | null;
  bill_limit: number | null;
  features: any;
}

export interface DealerSubscription {
  id: string;
  dealer_id: string;
  plan: string;
  start_date: string;
  end_date: string;
  status: string;
  amount_paid: number | null;
  payment_method: string | null;
  notes: string | null;
  granted_by: string | null;
  created_at: string;
}

export interface OnboardingProgress {
  id: string;
  dealer_id: string;
  step_1_shop_details_at: string | null;
  step_2_language_at: string | null;
  step_3_first_product_at: string | null;
  step_4_first_farmer_at: string | null;
  step_5_first_bill_at?: string | null;
  step_5_set_pin_at: string | null;
  completed_at: string | null;
  nudge_sent_at?: string | null;
  nudge_count?: number;
  stuck_since?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface InventoryLot {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  inventory_id: string;
  stock_purchase_id: string | null;
  product_id: string;
  supplier_id: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity_received: number;
  remaining_quantity: number;
  cost_price: number | null;
  selling_price?: number | null;
  medicine_discount_percentage?: number | null;
  final_unit_price?: number | null;
  mrp?: number | null;
  is_expired?: boolean;
  received_at: string;
  created_at: string;
}

export interface InventoryMovement {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  inventory_id: string;
  product_id: string;
  lot_id: string | null;
  reference_type: string;
  reference_id: string | null;
  quantity_change: number;
  notes: string | null;
  created_at: string;
}

export interface PaymentAllocation {
  id: string;
  dealer_id: string;
  payment_id: string;
  bill_id: string;
  farmer_id: string | null;
  allocated_amount: number;
  allocation_order: number;
  created_at: string;
}

export interface CashClosing {
  id: string;
  dealer_id: string;
  branch_id: string | null;
  closing_date: string;
  expected_cash: number;
  physical_cash: number;
  variance: number;
  notes: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  dealer_id: string | null;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface BroadcastMessage {
  id: string;
  admin_id: string | null;
  message: string;
  target_segment: string | null;
  channel: string;
  sent_at: string;
  delivery_count: number;
}
