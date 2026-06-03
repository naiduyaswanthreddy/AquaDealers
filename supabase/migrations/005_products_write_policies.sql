-- =============================================================================
-- AquaDealer Products RLS Write Policies
-- Migration 005: Allow authenticated product create/update from app/admin UI
-- =============================================================================

-- The app uses `products` as a shared catalog table. Dealer and admin UIs both
-- create/update products from authenticated client sessions, but migration 002
-- only granted SELECT on this table, causing RLS insert/update failures.

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;

CREATE POLICY "products_insert" ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "products_update" ON products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
