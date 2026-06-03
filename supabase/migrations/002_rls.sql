-- =============================================================================
-- AquaDealer Row Level Security (RLS) Policies
-- Migration 002: Enable RLS on all tables and create access policies
-- =============================================================================

-- =============================================================================
-- Enable RLS on ALL tables
-- =============================================================================
alter table dealers enable row level security;
alter table branches enable row level security;
alter table farmers enable row level security;
alter table products enable row level security;
alter table suppliers enable row level security;
alter table inventory enable row level security;
alter table stock_purchases enable row level security;
alter table bills enable row level security;
alter table bill_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table cash_book enable row level security;
alter table supplier_payments enable row level security;
alter table gst_ledger enable row level security;
alter table admin_users enable row level security;
alter table admin_audit_log enable row level security;
alter table plan_definitions enable row level security;
alter table dealer_subscriptions enable row level security;
alter table payment_history enable row level security;
alter table onboarding_progress enable row level security;
alter table support_tickets enable row level security;
alter table broadcast_messages enable row level security;

-- =============================================================================
-- DEALERS - special: USING (id = auth.uid())
-- =============================================================================
create policy "dealers_select" on dealers
  for select using (id = auth.uid());

create policy "dealers_insert" on dealers
  for insert with check (id = auth.uid());

create policy "dealers_update" on dealers
  for update using (id = auth.uid());

create policy "dealers_delete" on dealers
  for delete using (id = auth.uid());

-- =============================================================================
-- BRANCHES
-- =============================================================================
create policy "branches_select" on branches
  for select using (dealer_id = auth.uid());

create policy "branches_insert" on branches
  for insert with check (dealer_id = auth.uid());

create policy "branches_update" on branches
  for update using (dealer_id = auth.uid());

create policy "branches_delete" on branches
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- FARMERS
-- =============================================================================
create policy "farmers_select" on farmers
  for select using (dealer_id = auth.uid());

create policy "farmers_insert" on farmers
  for insert with check (dealer_id = auth.uid());

create policy "farmers_update" on farmers
  for update using (dealer_id = auth.uid());

create policy "farmers_delete" on farmers
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- PRODUCTS - public read for all authenticated users, no write from client
-- =============================================================================
create policy "products_select" on products
  for select to authenticated using (true);

-- =============================================================================
-- SUPPLIERS
-- =============================================================================
create policy "suppliers_select" on suppliers
  for select using (dealer_id = auth.uid());

create policy "suppliers_insert" on suppliers
  for insert with check (dealer_id = auth.uid());

create policy "suppliers_update" on suppliers
  for update using (dealer_id = auth.uid());

create policy "suppliers_delete" on suppliers
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- INVENTORY
-- =============================================================================
create policy "inventory_select" on inventory
  for select using (dealer_id = auth.uid());

create policy "inventory_insert" on inventory
  for insert with check (dealer_id = auth.uid());

create policy "inventory_update" on inventory
  for update using (dealer_id = auth.uid());

create policy "inventory_delete" on inventory
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- STOCK PURCHASES
-- =============================================================================
create policy "stock_purchases_select" on stock_purchases
  for select using (dealer_id = auth.uid());

create policy "stock_purchases_insert" on stock_purchases
  for insert with check (dealer_id = auth.uid());

create policy "stock_purchases_update" on stock_purchases
  for update using (dealer_id = auth.uid());

create policy "stock_purchases_delete" on stock_purchases
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- BILLS
-- =============================================================================
create policy "bills_select" on bills
  for select using (dealer_id = auth.uid());

create policy "bills_insert" on bills
  for insert with check (dealer_id = auth.uid());

create policy "bills_update" on bills
  for update using (dealer_id = auth.uid());

create policy "bills_delete" on bills
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- BILL ITEMS - join through bills table using EXISTS subquery
-- =============================================================================
create policy "bill_items_select" on bill_items
  for select using (
    exists (
      select 1 from bills
      where bills.id = bill_items.bill_id
        and bills.dealer_id = auth.uid()
    )
  );

create policy "bill_items_insert" on bill_items
  for insert with check (
    exists (
      select 1 from bills
      where bills.id = bill_items.bill_id
        and bills.dealer_id = auth.uid()
    )
  );

create policy "bill_items_update" on bill_items
  for update using (
    exists (
      select 1 from bills
      where bills.id = bill_items.bill_id
        and bills.dealer_id = auth.uid()
    )
  );

create policy "bill_items_delete" on bill_items
  for delete using (
    exists (
      select 1 from bills
      where bills.id = bill_items.bill_id
        and bills.dealer_id = auth.uid()
    )
  );

-- =============================================================================
-- PAYMENTS
-- =============================================================================
create policy "payments_select" on payments
  for select using (dealer_id = auth.uid());

create policy "payments_insert" on payments
  for insert with check (dealer_id = auth.uid());

create policy "payments_update" on payments
  for update using (dealer_id = auth.uid());

create policy "payments_delete" on payments
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- EXPENSES
-- =============================================================================
create policy "expenses_select" on expenses
  for select using (dealer_id = auth.uid());

create policy "expenses_insert" on expenses
  for insert with check (dealer_id = auth.uid());

create policy "expenses_update" on expenses
  for update using (dealer_id = auth.uid());

create policy "expenses_delete" on expenses
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- CASH BOOK
-- =============================================================================
create policy "cash_book_select" on cash_book
  for select using (dealer_id = auth.uid());

create policy "cash_book_insert" on cash_book
  for insert with check (dealer_id = auth.uid());

create policy "cash_book_update" on cash_book
  for update using (dealer_id = auth.uid());

create policy "cash_book_delete" on cash_book
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- SUPPLIER PAYMENTS
-- =============================================================================
create policy "supplier_payments_select" on supplier_payments
  for select using (dealer_id = auth.uid());

create policy "supplier_payments_insert" on supplier_payments
  for insert with check (dealer_id = auth.uid());

create policy "supplier_payments_update" on supplier_payments
  for update using (dealer_id = auth.uid());

create policy "supplier_payments_delete" on supplier_payments
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- GST LEDGER
-- =============================================================================
create policy "gst_ledger_select" on gst_ledger
  for select using (dealer_id = auth.uid());

create policy "gst_ledger_insert" on gst_ledger
  for insert with check (dealer_id = auth.uid());

create policy "gst_ledger_update" on gst_ledger
  for update using (dealer_id = auth.uid());

create policy "gst_ledger_delete" on gst_ledger
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- ONBOARDING PROGRESS
-- =============================================================================
create policy "onboarding_progress_select" on onboarding_progress
  for select using (dealer_id = auth.uid());

create policy "onboarding_progress_insert" on onboarding_progress
  for insert with check (dealer_id = auth.uid());

create policy "onboarding_progress_update" on onboarding_progress
  for update using (dealer_id = auth.uid());

create policy "onboarding_progress_delete" on onboarding_progress
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- DEALER SUBSCRIPTIONS
-- =============================================================================
create policy "dealer_subscriptions_select" on dealer_subscriptions
  for select using (dealer_id = auth.uid());

create policy "dealer_subscriptions_insert" on dealer_subscriptions
  for insert with check (dealer_id = auth.uid());

create policy "dealer_subscriptions_update" on dealer_subscriptions
  for update using (dealer_id = auth.uid());

create policy "dealer_subscriptions_delete" on dealer_subscriptions
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- PAYMENT HISTORY
-- =============================================================================
create policy "payment_history_select" on payment_history
  for select using (dealer_id = auth.uid());

create policy "payment_history_insert" on payment_history
  for insert with check (dealer_id = auth.uid());

create policy "payment_history_update" on payment_history
  for update using (dealer_id = auth.uid());

create policy "payment_history_delete" on payment_history
  for delete using (dealer_id = auth.uid());

-- =============================================================================
-- PLAN DEFINITIONS - public read for all authenticated users, no write
-- =============================================================================
create policy "plan_definitions_select" on plan_definitions
  for select to authenticated using (true);

-- =============================================================================
-- ADMIN TABLES - locked down: no client access
-- =============================================================================

-- Admin Users
create policy "admin_users_no_access" on admin_users
  for all using (false);

-- Admin Audit Log
create policy "admin_audit_log_no_access" on admin_audit_log
  for all using (false);

-- Support Tickets
create policy "support_tickets_no_access" on support_tickets
  for all using (false);

-- Broadcast Messages
create policy "broadcast_messages_no_access" on broadcast_messages
  for all using (false);
