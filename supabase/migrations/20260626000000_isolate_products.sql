-- =============================================================================
-- AquaDealer Product Isolation Fix
-- Migration 020: Isolate products by dealer
-- =============================================================================

-- 1. Add dealer_id to products
ALTER TABLE products ADD COLUMN dealer_id UUID REFERENCES dealers(id);

-- 2. Assign existing products to dealers based on inventory usage
UPDATE products p
SET dealer_id = (
  SELECT (MIN(dealer_id::text))::uuid
  FROM inventory i 
  WHERE i.product_id = p.id
)
WHERE p.dealer_id IS NULL;

-- 3. Assign based on stock_purchases for any remaining products
UPDATE products p
SET dealer_id = (
  SELECT (MIN(dealer_id::text))::uuid
  FROM stock_purchases sp 
  WHERE sp.product_id = p.id
)
WHERE p.dealer_id IS NULL;

-- 4. Assign based on bills/bill_items for any remaining products
UPDATE products p
SET dealer_id = (
  SELECT (MIN(b.dealer_id::text))::uuid
  FROM bill_items bi 
  JOIN bills b ON b.id = bi.bill_id
  WHERE bi.product_id = p.id
)
WHERE p.dealer_id IS NULL;

-- 5. Delete truly orphaned products that have no historical usage
DELETE FROM products WHERE dealer_id IS NULL;

-- 6. Make dealer_id NOT NULL
ALTER TABLE products ALTER COLUMN dealer_id SET NOT NULL;

-- 7. Update RLS policies for strict isolation
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;

CREATE POLICY "products_select" ON products
  FOR SELECT TO authenticated
  USING (dealer_id = auth.uid());

CREATE POLICY "products_insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (dealer_id = auth.uid());

CREATE POLICY "products_update" ON products
  FOR UPDATE TO authenticated
  USING (dealer_id = auth.uid());

CREATE POLICY "products_delete" ON products
  FOR DELETE TO authenticated
  USING (dealer_id = auth.uid());
