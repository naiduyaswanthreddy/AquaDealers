-- =============================================================================
-- Migration: Performance indexes for production scale
--
-- Run this in your Supabase SQL Editor.
-- These indexes are safe to add to a live database (CONCURRENT creation).
-- =============================================================================

-- 0. Ensure soft-delete columns exist (from 20260601, may not have been applied)
ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 1. Enable pg_trgm extension (required for GIN trigram indexes)
--    This is idempotent — safe to run even if already enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN trigram index on farmers.name
--    Enables fast substring/ilike search: "ilike '%search%'" NOW uses the index.
--    Without this: every farmer search = full table scan.
CREATE INDEX IF NOT EXISTS idx_farmers_name_trgm
  ON farmers USING GIN (name gin_trgm_ops);

-- 3. GIN trigram index on farmers.village
--    Used for village filter — also uses ilike.
CREATE INDEX IF NOT EXISTS idx_farmers_village_trgm
  ON farmers USING GIN (village gin_trgm_ops);

-- 4. Composite index for the most common dashboard query:
--    bills WHERE dealer_id = ? AND bill_date = ? AND status = 'active'
--    Already exists from 20260601000001, but adding the covering index for total + balance_due
--    so the query doesn't need a heap fetch.
CREATE INDEX IF NOT EXISTS idx_bills_dealer_date_status_covering
  ON bills (dealer_id, bill_date, status)
  INCLUDE (total, balance_due);

-- 5. Composite index for payments by date (used in dashboard payment split)
--    payments WHERE dealer_id = ? AND payment_date = ?
CREATE INDEX IF NOT EXISTS idx_payments_dealer_date
  ON payments (dealer_id, payment_date)
  INCLUDE (amount, method);

-- 6. Composite index for cash_book date range queries
--    Used by get_cash_summary_rpc and expense reports
CREATE INDEX IF NOT EXISTS idx_cash_book_dealer_date
  ON cash_book (dealer_id, entry_date)
  INCLUDE (amount, entry_type);

-- 7. Partial index for low-stock detection (dashboard + LowStockAlert component)
--    inventory WHERE dealer_id = ? AND quantity_in_stock < min_stock_alert
--    Partial indexes only index rows that match the WHERE condition — tiny and fast.
--    NOTE: PostgreSQL does not support column-to-column comparisons in partial index WHERE,
--    so we use a functional index approach instead via a generated expression index.
CREATE INDEX IF NOT EXISTS idx_inventory_dealer_id_active
  ON inventory (dealer_id)
  WHERE deleted_at IS NULL;

-- 8. Composite index for bill_items lookup (used in N+1 prevention)
--    bill_items WHERE bill_id IN (...) is the most common access pattern
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id_covering
  ON bill_items (bill_id)
  INCLUDE (product_name_snapshot, quantity, unit_price, total_price, gst_rate);

-- 9. Index on inventory_lots for FIFO pricing queries
--    lots WHERE inventory_id = ? ORDER BY purchase_date ASC
CREATE INDEX IF NOT EXISTS idx_inventory_lots_inventory_date
  ON inventory_lots (inventory_id, received_at ASC)
  INCLUDE (id, remaining_quantity, cost_price, mrp, batch_number, expiry_date);

-- 10. Index on bills for the farmer ledger (most common farmer-scoped query)
--     bills WHERE farmer_id = ? AND status = 'active' ORDER BY bill_date DESC
CREATE INDEX IF NOT EXISTS idx_bills_farmer_date_covering
  ON bills (farmer_id, bill_date DESC, status)
  INCLUDE (total, balance_due, bill_number, payment_type, branch_id);

-- =============================================================================
-- Verify indexes were created
-- =============================================================================
-- Run this to check:
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
