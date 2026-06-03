-- =============================================================================
-- Migration: Missing Indexes for Search and Performance
-- =============================================================================

-- Farmers: Frequently searched by phone and name
CREATE INDEX IF NOT EXISTS idx_farmers_phone ON farmers(phone);
CREATE INDEX IF NOT EXISTS idx_farmers_name ON farmers(name);

-- Products: Frequently searched/filtered by name and category for autocomplete
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Bills: Searched by bill number
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);

-- Dealers: Lookups by GSTIN
CREATE INDEX IF NOT EXISTS idx_dealers_gstin ON dealers(gstin);

-- Staff Members: Lookups by phone
CREATE INDEX IF NOT EXISTS idx_staff_members_phone ON public.staff_members(phone);

-- Inventory Lots & Movements (from foundation transactions)
CREATE INDEX IF NOT EXISTS idx_inventory_lots_product_id ON inventory_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
