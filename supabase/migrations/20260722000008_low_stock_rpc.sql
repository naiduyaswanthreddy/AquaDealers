-- RPC for low-stock inventory queries. Replaces the broken column-to-column
-- PostgREST filter (.filter('quantity_in_stock', 'lt', 'min_stock_alert'))
-- which returns 22P02 on this PostgREST version.
-- Also drops the generated column from migration 20260722000007 since RPCs
-- don't have schema-cache lag.

ALTER TABLE inventory DROP COLUMN IF EXISTS is_low_stock;

-- Returns full inventory+product rows for items below their alert threshold.
CREATE OR REPLACE FUNCTION get_low_stock_inventory(
  p_dealer_id  UUID,
  p_branch_id  UUID    DEFAULT NULL,
  p_limit      INTEGER DEFAULT 50
)
RETURNS SETOF inventory
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT i.*
  FROM   inventory i
  WHERE  i.dealer_id = p_dealer_id
    AND  (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    AND  i.min_stock_alert > 0
    AND  i.quantity_in_stock < i.min_stock_alert
  ORDER  BY i.quantity_in_stock ASC
  LIMIT  p_limit;
$$;

-- Lightweight version that only returns the two columns needed for the
-- summary widget (quantity_in_stock, min_stock_alert).
CREATE OR REPLACE FUNCTION get_low_stock_summary(
  p_dealer_id UUID,
  p_branch_id UUID    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 500
)
RETURNS TABLE(quantity_in_stock NUMERIC, min_stock_alert INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT i.quantity_in_stock, i.min_stock_alert
  FROM   inventory i
  WHERE  i.dealer_id = p_dealer_id
    AND  (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    AND  i.min_stock_alert > 0
    AND  i.quantity_in_stock < i.min_stock_alert
  ORDER  BY i.quantity_in_stock ASC
  LIMIT  p_limit;
$$;

-- Returns just the count (used by dashboard stat card).
CREATE OR REPLACE FUNCTION get_low_stock_count(
  p_dealer_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM   inventory i
  WHERE  i.dealer_id = p_dealer_id
    AND  (p_branch_id IS NULL OR i.branch_id = p_branch_id)
    AND  i.min_stock_alert > 0
    AND  i.quantity_in_stock < i.min_stock_alert;
$$;

GRANT EXECUTE ON FUNCTION get_low_stock_inventory(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_summary(UUID, UUID, INTEGER)    TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_count(UUID, UUID)               TO authenticated;
