-- =============================================================================
-- AquaDealer Database Schema
-- Migration 001: Create all tables in dependency order
-- =============================================================================

-- =============================================================================
-- 1. DEALERS (root table - no dependencies)
-- =============================================================================
create table dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  shop_name text not null,
  phone text unique not null,
  email text,
  address text,
  district text,
  state text default 'Andhra Pradesh',
  gstin text,
  drug_license_no text,
  language text default 'te',
  plan text default 'trial',
  plan_expires_at timestamptz,
  is_active boolean default true,
  gst_billing_enabled boolean default false,
  pin_hash text,
  pin_timeout_minutes int default 5,
  avatar_url text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 2. BRANCHES (depends on: dealers)
-- =============================================================================
create table branches (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  is_main boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =============================================================================
-- 3. FARMERS (depends on: dealers, branches)
-- =============================================================================
create table farmers (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  name text not null,
  phone text,
  village text,
  mandal text,
  district text,
  pond_acres numeric(6,2),
  stocking_date date,
  crop_status text default 'growing',
  risk_status text default 'reliable',
  credit_limit numeric(12,2) default 0,
  total_due numeric(12,2) default 0,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 4. PRODUCTS (no dependencies - standalone catalog)
-- =============================================================================
create table products (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  company text,
  name text not null,
  variant text,
  category text,
  unit text default 'bag',
  hsn_code text,
  gst_rate numeric(5,2) default 0,
  default_price numeric(10,2),
  track_expiry boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- =============================================================================
-- 5. SUPPLIERS (depends on: dealers)
-- =============================================================================
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  name text not null,
  company text,
  phone text,
  gstin text,
  address text,
  total_due numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 6. INVENTORY (depends on: dealers, branches, products)
-- =============================================================================
create table inventory (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  product_id uuid references products(id),
  quantity_in_stock numeric(10,2) default 0,
  cost_price numeric(10,2),
  selling_price numeric(10,2),
  min_stock_alert numeric(10,2) default 10,
  expiry_date date,
  batch_number text,
  updated_at timestamptz default now()
);

-- =============================================================================
-- 7. STOCK PURCHASES (depends on: dealers, branches, products, suppliers)
-- =============================================================================
create table stock_purchases (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  product_id uuid references products(id),
  supplier_id uuid references suppliers(id),
  quantity numeric(10,2) not null,
  cost_price_per_unit numeric(10,2),
  gst_amount numeric(10,2) default 0,
  total_amount numeric(12,2),
  purchase_date date default current_date,
  invoice_number text,
  batch_number text,
  expiry_date date,
  is_paid boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 8. BILLS (depends on: dealers, branches, farmers)
-- =============================================================================
create table bills (
  id uuid primary key default gen_random_uuid(),
  bill_number text not null,
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  farmer_id uuid references farmers(id),
  farmer_name_snapshot text,
  farmer_gstin text,
  bill_date date default current_date,
  subtotal numeric(12,2) not null,
  gst_amount numeric(12,2) default 0,
  cgst_amount numeric(12,2) default 0,
  sgst_amount numeric(12,2) default 0,
  igst_amount numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  total numeric(12,2) not null,
  amount_paid numeric(12,2) default 0,
  balance_due numeric(12,2) default 0,
  payment_type text,
  upi_ref text,
  cheque_number text,
  notes text,
  status text default 'active',
  created_at timestamptz default now()
);

-- =============================================================================
-- 9. BILL ITEMS (depends on: bills, products)
-- =============================================================================
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id) on delete cascade,
  product_id uuid references products(id),
  product_name_snapshot text,
  hsn_code_snapshot text,
  quantity numeric(10,2) not null,
  unit_price numeric(10,2) not null,
  gst_rate numeric(5,2) default 0,
  gst_amount numeric(10,2) default 0,
  cgst_amount numeric(10,2) default 0,
  sgst_amount numeric(10,2) default 0,
  total_price numeric(12,2) not null
);

-- =============================================================================
-- 10. PAYMENTS (depends on: dealers, branches, farmers, bills)
-- =============================================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  farmer_id uuid references farmers(id),
  bill_id uuid references bills(id),
  amount numeric(12,2) not null,
  payment_date date default current_date,
  method text,
  upi_ref text,
  cheque_no text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 11. EXPENSES (depends on: dealers, branches)
-- =============================================================================
create table expenses (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  category text,
  amount numeric(12,2) not null,
  description text,
  expense_date date default current_date,
  paid_via text default 'cash',
  created_at timestamptz default now()
);

-- =============================================================================
-- 12. CASH BOOK (depends on: dealers, branches)
-- =============================================================================
create table cash_book (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  entry_type text not null,
  source text,
  reference_id uuid,
  amount numeric(12,2) not null,
  notes text,
  entry_date date default current_date,
  created_at timestamptz default now()
);

-- =============================================================================
-- 13. SUPPLIER PAYMENTS (depends on: dealers, suppliers, stock_purchases)
-- =============================================================================
create table supplier_payments (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  supplier_id uuid references suppliers(id),
  purchase_id uuid references stock_purchases(id),
  amount numeric(12,2) not null,
  payment_date date default current_date,
  method text,
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 14. GST LEDGER (depends on: dealers, branches)
-- =============================================================================
create table gst_ledger (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  branch_id uuid references branches(id),
  month int not null,
  year int not null,
  output_taxable numeric(12,2) default 0,
  output_cgst numeric(12,2) default 0,
  output_sgst numeric(12,2) default 0,
  output_igst numeric(12,2) default 0,
  output_total numeric(12,2) default 0,
  input_taxable numeric(12,2) default 0,
  input_cgst numeric(12,2) default 0,
  input_sgst numeric(12,2) default 0,
  input_igst numeric(12,2) default 0,
  input_total numeric(12,2) default 0,
  net_gst_payable numeric(12,2) default 0,
  updated_at timestamptz default now(),
  unique(dealer_id, branch_id, month, year)
);

-- =============================================================================
-- 15. ADMIN USERS (no dependencies - standalone)
-- =============================================================================
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  role text default 'support',
  is_active boolean default true,
  last_login timestamptz,
  created_at timestamptz default now()
);

-- =============================================================================
-- 16. ADMIN AUDIT LOG (depends on: admin_users)
-- =============================================================================
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admin_users(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- =============================================================================
-- 17. PLAN DEFINITIONS (no dependencies - standalone)
-- =============================================================================
create table plan_definitions (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  price_monthly numeric(8,2),
  farmer_limit int,
  bill_limit int,
  features jsonb
);

-- =============================================================================
-- 18. DEALER SUBSCRIPTIONS (depends on: dealers, admin_users)
-- =============================================================================
create table dealer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  plan text not null,
  start_date date not null,
  end_date date not null,
  status text default 'active',
  amount_paid numeric(8,2),
  payment_method text,
  notes text,
  granted_by uuid references admin_users(id),
  created_at timestamptz default now()
);

-- =============================================================================
-- 19. PAYMENT HISTORY (depends on: dealers)
-- =============================================================================
create table payment_history (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id),
  amount numeric(8,2) not null,
  payment_date date default current_date,
  method text,
  status text default 'paid',
  notes text,
  created_at timestamptz default now()
);

-- =============================================================================
-- 20. ONBOARDING PROGRESS (depends on: dealers)
-- =============================================================================
create table onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id) on delete cascade,
  step text not null,
  completed_at timestamptz,
  unique(dealer_id, step)
);

-- =============================================================================
-- 21. SUPPORT TICKETS (depends on: dealers, admin_users)
-- =============================================================================
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid references dealers(id),
  subject text not null,
  message text not null,
  status text default 'open',
  admin_reply text,
  resolved_by uuid references admin_users(id),
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- =============================================================================
-- 22. BROADCAST MESSAGES (depends on: admin_users)
-- =============================================================================
create table broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references admin_users(id),
  message text not null,
  target_segment text,
  channel text default 'in_app',
  sent_at timestamptz default now(),
  delivery_count int default 0
);

-- =============================================================================
-- INDEXES for commonly queried fields
-- =============================================================================

-- Branches
create index idx_branches_dealer_id on branches(dealer_id);

-- Farmers
create index idx_farmers_dealer_id on farmers(dealer_id);
create index idx_farmers_branch_id on farmers(branch_id);
create index idx_farmers_created_at on farmers(created_at);

-- Suppliers
create index idx_suppliers_dealer_id on suppliers(dealer_id);

-- Inventory
create index idx_inventory_dealer_id on inventory(dealer_id);
create index idx_inventory_branch_id on inventory(branch_id);
create index idx_inventory_product_id on inventory(product_id);

-- Stock Purchases
create index idx_stock_purchases_dealer_id on stock_purchases(dealer_id);
create index idx_stock_purchases_branch_id on stock_purchases(branch_id);
create index idx_stock_purchases_supplier_id on stock_purchases(supplier_id);
create index idx_stock_purchases_created_at on stock_purchases(created_at);

-- Bills
create index idx_bills_dealer_id on bills(dealer_id);
create index idx_bills_branch_id on bills(branch_id);
create index idx_bills_farmer_id on bills(farmer_id);
create index idx_bills_bill_date on bills(bill_date);
create index idx_bills_created_at on bills(created_at);

-- Bill Items
create index idx_bill_items_bill_id on bill_items(bill_id);
create index idx_bill_items_product_id on bill_items(product_id);

-- Payments
create index idx_payments_dealer_id on payments(dealer_id);
create index idx_payments_farmer_id on payments(farmer_id);
create index idx_payments_bill_id on payments(bill_id);
create index idx_payments_created_at on payments(created_at);

-- Expenses
create index idx_expenses_dealer_id on expenses(dealer_id);
create index idx_expenses_branch_id on expenses(branch_id);
create index idx_expenses_created_at on expenses(created_at);

-- Cash Book
create index idx_cash_book_dealer_id on cash_book(dealer_id);
create index idx_cash_book_branch_id on cash_book(branch_id);
create index idx_cash_book_entry_date on cash_book(entry_date);

-- Supplier Payments
create index idx_supplier_payments_dealer_id on supplier_payments(dealer_id);
create index idx_supplier_payments_supplier_id on supplier_payments(supplier_id);
create index idx_supplier_payments_created_at on supplier_payments(created_at);

-- GST Ledger
create index idx_gst_ledger_dealer_id on gst_ledger(dealer_id);
create index idx_gst_ledger_branch_id on gst_ledger(branch_id);

-- Admin Audit Log
create index idx_admin_audit_log_admin_id on admin_audit_log(admin_id);
create index idx_admin_audit_log_created_at on admin_audit_log(created_at);

-- Dealer Subscriptions
create index idx_dealer_subscriptions_dealer_id on dealer_subscriptions(dealer_id);

-- Payment History
create index idx_payment_history_dealer_id on payment_history(dealer_id);

-- Onboarding Progress
create index idx_onboarding_progress_dealer_id on onboarding_progress(dealer_id);

-- Support Tickets
create index idx_support_tickets_dealer_id on support_tickets(dealer_id);
create index idx_support_tickets_created_at on support_tickets(created_at);

-- Broadcast Messages
create index idx_broadcast_messages_sent_at on broadcast_messages(sent_at);
