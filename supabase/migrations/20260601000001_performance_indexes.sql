-- Performance Indexes for 1,000,000+ rows

-- Bills: Used heavily in dashboard queries for date ranges and status
CREATE INDEX IF NOT EXISTS idx_bills_dealer_date_status ON bills(dealer_id, bill_date, status);
CREATE INDEX IF NOT EXISTS idx_bills_dealer_created ON bills(dealer_id, created_at DESC);

-- Payments: Used for daily split calculations
CREATE INDEX IF NOT EXISTS idx_payments_dealer_date ON payments(dealer_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_dealer_created ON payments(dealer_id, created_at DESC);

-- Farmers: Used for total dues aggregations
CREATE INDEX IF NOT EXISTS idx_farmers_dealer_active_due ON farmers(dealer_id, is_active, total_due);

-- Inventory: Used for low stock alerts
CREATE INDEX IF NOT EXISTS idx_inventory_dealer_stock ON inventory(dealer_id, quantity_in_stock, min_stock_alert);

-- Cash Book: Used for running balance calculations and daily clarity
CREATE INDEX IF NOT EXISTS idx_cash_book_dealer_date_created ON cash_book(dealer_id, entry_date, created_at ASC);

-- Expenses: Used for paginated lists
CREATE INDEX IF NOT EXISTS idx_expenses_dealer_date ON expenses(dealer_id, expense_date DESC, created_at DESC);

-- Suppliers: General optimization
CREATE INDEX IF NOT EXISTS idx_suppliers_dealer_name ON suppliers(dealer_id, name);
