ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_dealer_alternate_phone
  ON suppliers(dealer_id, alternate_phone);
