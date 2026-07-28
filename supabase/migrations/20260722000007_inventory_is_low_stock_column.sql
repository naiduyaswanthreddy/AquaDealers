-- Add a stored generated column so PostgREST can filter low-stock rows with
-- a plain equality check. The column-to-column approach (.filter('quantity_in_stock',
-- 'lt', 'min_stock_alert')) triggers a 22P02 on this PostgREST version because
-- the RHS is cast as a literal value, not a column reference.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS is_low_stock boolean GENERATED ALWAYS AS (
    min_stock_alert > 0 AND quantity_in_stock < min_stock_alert
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_inventory_is_low_stock
  ON inventory(dealer_id, is_low_stock)
  WHERE is_low_stock = true;
