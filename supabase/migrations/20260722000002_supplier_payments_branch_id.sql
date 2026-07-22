-- Add branch_id to supplier_payments so daily book / cash book can filter by branch.
-- Backfill from the linked stock_purchase; payments with no purchase link stay NULL
-- (they appear in the "all branches" view only, same behaviour as today).

ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

UPDATE supplier_payments sp
  SET branch_id = sq.branch_id
  FROM stock_purchases sq
  WHERE sp.purchase_id = sq.id
    AND sq.branch_id IS NOT NULL
    AND sp.branch_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payments_branch_id
  ON supplier_payments(branch_id);
