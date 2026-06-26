-- ============================================================
-- Migration: Process Expired Inventory Lots
-- Automatically marks expired lots, reduces stock, logs movements
-- ============================================================

-- 1. Add is_expired flag to inventory_lots
ALTER TABLE inventory_lots
  ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT false;

-- 2. Create index for efficient expired lot queries
CREATE INDEX IF NOT EXISTS idx_inventory_lots_expiry_active
  ON inventory_lots (dealer_id, expiry_date)
  WHERE remaining_quantity > 0 AND is_expired = false;

-- 3. RPC: Process ALL expired lots for a dealer (called on app load)
CREATE OR REPLACE FUNCTION process_expired_inventory_lots(
  p_dealer_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lot RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Loop through all expired lots that still have stock
  FOR v_lot IN
    SELECT il.id AS lot_id,
           il.inventory_id,
           il.product_id,
           il.remaining_quantity,
           il.batch_number,
           il.expiry_date,
           i.branch_id
    FROM inventory_lots il
    JOIN inventory i ON i.id = il.inventory_id
    WHERE il.dealer_id = p_dealer_id
      AND il.expiry_date IS NOT NULL
      AND il.expiry_date < CURRENT_DATE
      AND il.remaining_quantity > 0
      AND il.is_expired = false
    ORDER BY il.expiry_date ASC
    FOR UPDATE OF il
  LOOP
    -- Reduce inventory aggregate stock
    UPDATE inventory
    SET quantity_in_stock = GREATEST(quantity_in_stock - v_lot.remaining_quantity, 0),
        updated_at = now()
    WHERE id = v_lot.inventory_id
      AND dealer_id = p_dealer_id;

    -- Log the movement
    INSERT INTO inventory_movements (
      dealer_id, branch_id, inventory_id, product_id,
      lot_id, reference_type, quantity_change, notes, created_at
    ) VALUES (
      p_dealer_id,
      v_lot.branch_id,
      v_lot.inventory_id,
      v_lot.product_id,
      v_lot.lot_id,
      'expiry',
      -v_lot.remaining_quantity,
      format('Expired lot (Batch: %s, Expiry: %s) — %s units removed',
        COALESCE(v_lot.batch_number, 'N/A'),
        v_lot.expiry_date::TEXT,
        v_lot.remaining_quantity),
      now()
    );

    -- Zero out the lot and mark as expired
    UPDATE inventory_lots
    SET remaining_quantity = 0,
        is_expired = true
    WHERE id = v_lot.lot_id
      AND dealer_id = p_dealer_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4. RPC: Mark a single lot as expired (manual from UI)
CREATE OR REPLACE FUNCTION mark_lot_as_expired(
  p_dealer_id UUID,
  p_lot_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lot RECORD;
BEGIN
  SELECT il.id, il.inventory_id, il.product_id, il.remaining_quantity,
         il.batch_number, il.expiry_date, i.branch_id
  INTO v_lot
  FROM inventory_lots il
  JOIN inventory i ON i.id = il.inventory_id
  WHERE il.id = p_lot_id
    AND il.dealer_id = p_dealer_id
    AND il.remaining_quantity > 0
    AND il.is_expired = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot not found, already expired, or has no remaining stock';
  END IF;

  -- Reduce inventory aggregate stock
  UPDATE inventory
  SET quantity_in_stock = GREATEST(quantity_in_stock - v_lot.remaining_quantity, 0),
      updated_at = now()
  WHERE id = v_lot.inventory_id
    AND dealer_id = p_dealer_id;

  -- Log the movement
  INSERT INTO inventory_movements (
    dealer_id, branch_id, inventory_id, product_id,
    lot_id, reference_type, quantity_change, notes, created_at
  ) VALUES (
    p_dealer_id,
    v_lot.branch_id,
    v_lot.inventory_id,
    v_lot.product_id,
    v_lot.id,
    'expiry',
    -v_lot.remaining_quantity,
    format('Manually expired lot (Batch: %s, Expiry: %s) — %s units removed',
      COALESCE(v_lot.batch_number, 'N/A'),
      COALESCE(v_lot.expiry_date::TEXT, 'N/A'),
      v_lot.remaining_quantity),
    now()
  );

  -- Zero out the lot and mark as expired
  UPDATE inventory_lots
  SET remaining_quantity = 0,
      is_expired = true
  WHERE id = p_lot_id
    AND dealer_id = p_dealer_id;
END;
$$;
