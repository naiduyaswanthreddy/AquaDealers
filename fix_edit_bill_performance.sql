-- Performance Indexes for Bill Editing
-- Run this in your Supabase SQL Editor to speed up bill edits and prevent timeouts

CREATE INDEX IF NOT EXISTS idx_bill_item_lot_allocations_item
  ON bill_item_lot_allocations(bill_item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_inventory_id
  ON inventory_lots(inventory_id);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id
  ON bill_items(bill_id);
