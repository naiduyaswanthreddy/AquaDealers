-- =============================================================================
-- AquaDealer Product Medicine Discount
-- Migration 023: Persist product-level default medicine discount percentage
-- =============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS medicine_discount_percentage NUMERIC(5,2) DEFAULT 0;
