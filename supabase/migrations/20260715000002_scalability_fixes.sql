-- ==========================================================================
-- Migration: Critical scalability fixes
-- 20260715000002_scalability_fixes.sql
--
-- NOTE: Run this in the Supabase SQL Editor as individual statements
-- (NOT inside a transaction block). If you get an error on indexes,
-- run the index statements separately from the function statements.
-- ==========================================================================

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 0 — Ensure soft-delete columns exist (from 20260601)      │
-- └─────────────────────────────────────────────────────────────────┘
ALTER TABLE IF EXISTS bills ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS farmers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS inventory ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 1 — Run indexes first (paste into SQL editor and run)     │
-- └─────────────────────────────────────────────────────────────────┘

-- Ensure trigram extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. INDEX on share_token — MOST CRITICAL
--    Every public farmer balance page load does: WHERE share_token = ?
--    Without this: full table scan on farmers at EVERY public page view.
CREATE INDEX IF NOT EXISTS idx_farmers_share_token
  ON farmers(share_token)
  WHERE share_token IS NOT NULL;

-- 2. INDEX on inventory_lots.expiry_date for expiry alerts
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiry
  ON inventory_lots (dealer_id, expiry_date ASC)
  WHERE remaining_quantity > 0;

-- 3. GIN trigram index on bill_number for ilike search
CREATE INDEX IF NOT EXISTS idx_bills_bill_number_trgm
  ON bills USING GIN (bill_number gin_trgm_ops);

-- 4. GIN trigram index on farmer_name_snapshot for bill list search
CREATE INDEX IF NOT EXISTS idx_bills_farmer_name_trgm
  ON bills USING GIN (farmer_name_snapshot gin_trgm_ops);

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 2 — Idempotency key column on bills table                  │
-- └─────────────────────────────────────────────────────────────────┘

-- Add idempotency_key column so double-submits don't create duplicate bills
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique constraint: one bill per idempotency key per dealer
CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_idempotency_key
  ON bills (dealer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 3 — Safety constraint on inventory_lots                    │
-- └─────────────────────────────────────────────────────────────────┘

-- Prevent lot quantity from going negative (race condition guard)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lot_remaining_non_negative') THEN
    ALTER TABLE inventory_lots ADD CONSTRAINT chk_lot_remaining_non_negative CHECK (remaining_quantity >= 0);
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 4 — RPCs (run these as a block)                           │
-- └─────────────────────────────────────────────────────────────────┘

-- 5. Low-stock RPC: replaces getLowStockItems() full-table scan
CREATE OR REPLACE FUNCTION get_low_stock_items(
  p_dealer_id   UUID,
  p_branch_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  id                UUID,
  product_id        UUID,
  dealer_id         UUID,
  branch_id         UUID,
  quantity_in_stock NUMERIC,
  min_stock_alert   NUMERIC,
  selling_price     NUMERIC,
  mrp               NUMERIC,
  image_url         TEXT,
  updated_at        TIMESTAMPTZ,
  products          JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.product_id,
    i.dealer_id,
    i.branch_id,
    i.quantity_in_stock,
    i.min_stock_alert,
    i.selling_price,
    i.mrp,
    i.image_url,
    i.updated_at,
    row_to_json(p)::jsonb AS products
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE i.dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    AND i.deleted_at IS NULL
    AND i.quantity_in_stock < i.min_stock_alert
  ORDER BY (i.min_stock_alert - i.quantity_in_stock) DESC
  LIMIT 100;
$$;

-- 6. Unique villages RPC: replaces getUniqueVillages() full-table scan
CREATE OR REPLACE FUNCTION get_unique_villages(
  p_dealer_id UUID
)
RETURNS TABLE (village TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT f.village
  FROM farmers f
  WHERE f.dealer_id = p_dealer_id
    AND f.is_active = true
    AND f.village IS NOT NULL
    AND f.deleted_at IS NULL
  ORDER BY f.village
  LIMIT 500;
$$;

-- 7. Farmer ledger RPC: paginated combined transactions, newest-first
CREATE OR REPLACE FUNCTION get_farmer_ledger_page(
  p_farmer_id     UUID,
  p_dealer_id     UUID,
  p_page          INT DEFAULT 1,
  p_limit         INT DEFAULT 20,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  -- Count total transactions (for pagination UI)
  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT id FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
  ) t;

  -- Paginated result
  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      id,
      'bill' AS type,
      bill_number AS ref_number,
      bill_date AS date,
      total AS amount,
      balance_due,
      created_at
    FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT
      id,
      'payment' AS type,
      COALESCE(receipt_number, UPPER(method), 'PAYMENT') AS ref_number,
      payment_date AS date,
      amount,
      NULL AS balance_due,
      created_at
    FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- 8. Bills export RPC: fetches ALL matching bills in one server call for CSV export
--    Client calls this with full filter set, receives paginated chunks of 500
CREATE OR REPLACE FUNCTION export_bills_chunk(
  p_dealer_id     UUID,
  p_branch_id     UUID DEFAULT NULL,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL,
  p_payment_status TEXT DEFAULT 'all',   -- 'all' | 'paid' | 'unpaid'
  p_search        TEXT DEFAULT NULL,
  p_limit         INT DEFAULT 500,
  p_offset        INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  -- Count matching bills
  SELECT COUNT(*) INTO v_total
  FROM bills b
  WHERE b.dealer_id = p_dealer_id
    AND b.deleted_at IS NULL
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    AND (p_start_date IS NULL OR b.bill_date >= p_start_date)
    AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    AND (
      p_payment_status = 'all'
      OR (p_payment_status = 'paid' AND b.balance_due <= 0)
      OR (p_payment_status = 'unpaid' AND b.balance_due > 0)
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR b.bill_number ILIKE '%' || p_search || '%'
      OR b.farmer_name_snapshot ILIKE '%' || p_search || '%'
    );

  -- Fetch chunk
  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      b.bill_number,
      b.bill_date,
      b.farmer_name_snapshot,
      b.total,
      b.subtotal,
      b.discount_amount,
      b.gst_amount,
      b.amount_paid,
      b.balance_due,
      b.payment_type,
      b.type,
      b.created_at
    FROM bills b
    WHERE b.dealer_id = p_dealer_id
      AND b.deleted_at IS NULL
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR b.bill_date >= p_start_date)
      AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
      AND (
        p_payment_status = 'all'
        OR (p_payment_status = 'paid' AND b.balance_due <= 0)
        OR (p_payment_status = 'unpaid' AND b.balance_due > 0)
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR b.bill_number ILIKE '%' || p_search || '%'
        OR b.farmer_name_snapshot ILIKE '%' || p_search || '%'
      )
    ORDER BY b.bill_date DESC, b.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'offset', p_offset,
    'limit', p_limit,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 5 — Grants                                                │
-- └─────────────────────────────────────────────────────────────────┘
GRANT EXECUTE ON FUNCTION get_low_stock_items(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unique_villages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION export_bills_chunk(UUID, UUID, DATE, DATE, TEXT, TEXT, INT, INT) TO authenticated;

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  STEP 6 — Cold data archive view (bills > 2 years old)          │
-- └─────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE VIEW archived_bills AS
  SELECT * FROM bills
  WHERE bill_date < (CURRENT_DATE - INTERVAL '2 years')
    AND deleted_at IS NULL;

COMMENT ON VIEW archived_bills IS
  'Read-only view of bills older than 2 years. Use for reporting only. These rows are cold and infrequently accessed.';

-- ┌─────────────────────────────────────────────────────────────────┐
-- │  Verify — run after applying:                                   │
-- │  SELECT indexname, tablename FROM pg_indexes                    │
-- │  WHERE schemaname = 'public' AND indexname LIKE 'idx_%'         │
-- │  ORDER BY tablename, indexname;                                 │
-- └─────────────────────────────────────────────────────────────────┘
