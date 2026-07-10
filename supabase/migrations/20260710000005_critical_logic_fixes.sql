-- =============================================================================
-- CRITICAL LOGIC FIXES
--
-- Addresses key findings from the app-wide correctness audit:
-- - FIFO expiry filtering (finding #7): exclude expired lots from FIFO
-- - Admin session security (finding #1): now handled in migration 004
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- FIFO CONSUMPTION: exclude expired lots (finding #7)
--
-- Expired lots (is_expired=true or expiry_date < TODAY) should not be sold
-- via FIFO consumption. This prevents the silent sale of expired inventory.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_inventory_lots(
  p_dealer_id UUID,
  p_inventory_id UUID,
  p_product_id UUID,
  p_reference_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_quantity;
  v_lot RECORD;
  v_consumed NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  FOR v_lot IN
    SELECT id, remaining_quantity
    FROM inventory_lots
    WHERE dealer_id = p_dealer_id
      AND inventory_id = p_inventory_id
      AND remaining_quantity > 0
      AND NOT COALESCE(is_expired, false)
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    ORDER BY expiry_date NULLS LAST, received_at, created_at
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_consumed := LEAST(v_lot.remaining_quantity, v_remaining);

    UPDATE inventory_lots
    SET remaining_quantity = remaining_quantity - v_consumed
    WHERE id = v_lot.id;

    INSERT INTO inventory_movements (
      dealer_id,
      inventory_id,
      product_id,
      lot_id,
      reference_type,
      reference_id,
      quantity_change,
      notes
    ) VALUES (
      p_dealer_id,
      p_inventory_id,
      p_product_id,
      v_lot.id,
      'bill',
      p_reference_id,
      -v_consumed,
      'Consumed through bill'
    );

    v_remaining := v_remaining - v_consumed;
  END LOOP;

  IF v_remaining > 0 THEN
    INSERT INTO inventory_movements (
      dealer_id,
      inventory_id,
      product_id,
      reference_type,
      reference_id,
      quantity_change,
      notes
    ) VALUES (
      p_dealer_id,
      p_inventory_id,
      p_product_id,
      'bill',
      p_reference_id,
      -v_remaining,
      'Consumed from untracked/legacy stock'
    );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
