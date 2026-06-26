-- Pro Plus farmer/product medicine discounts

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS farmer_product_discounts_enabled BOOLEAN DEFAULT false;

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS default_medicine_discount_percentage NUMERIC(5,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS farmer_product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dealer_id, farmer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_farmer_product_discounts_farmer
  ON farmer_product_discounts(dealer_id, farmer_id);

ALTER TABLE farmer_product_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farmer_product_discounts_select ON farmer_product_discounts;
DROP POLICY IF EXISTS farmer_product_discounts_insert ON farmer_product_discounts;
DROP POLICY IF EXISTS farmer_product_discounts_update ON farmer_product_discounts;
DROP POLICY IF EXISTS farmer_product_discounts_delete ON farmer_product_discounts;
CREATE POLICY farmer_product_discounts_select ON farmer_product_discounts FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY farmer_product_discounts_insert ON farmer_product_discounts FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY farmer_product_discounts_update ON farmer_product_discounts FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY farmer_product_discounts_delete ON farmer_product_discounts FOR DELETE USING (dealer_id = auth.uid());

UPDATE plan_definitions
SET features = (
  CASE
    WHEN features ? 'farmer_product_discounts' THEN features
    ELSE features || '["farmer_product_discounts"]'::jsonb
  END
)
WHERE name = 'pro_plus';
