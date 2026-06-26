ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_inventory_id UUID := (p_payload->>'inventory_id')::UUID;
  v_selected_lot_id UUID := NULLIF(p_payload->>'lot_id', '')::UUID;
  v_adjustment NUMERIC(10,2) := COALESCE((p_payload->>'adjustment_qty')::NUMERIC, 0);
  v_reason TEXT := COALESCE(NULLIF(trim(p_payload->>'reason'), ''), 'Manual stock adjustment');
  v_inventory inventory%ROWTYPE;
  v_new_qty NUMERIC(10,2);
  v_lot inventory_lots%ROWTYPE;
  v_remaining NUMERIC(10,2);
  v_consumed NUMERIC(10,2);
  v_adjustment_id UUID := gen_random_uuid();
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_adjustment = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity cannot be zero';
  END IF;

  SELECT *
  INTO v_inventory
  FROM inventory
  WHERE id = v_inventory_id
    AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  v_new_qty := COALESCE(v_inventory.quantity_in_stock, 0) + v_adjustment;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be less than zero';
  END IF;

  UPDATE inventory
  SET quantity_in_stock = v_new_qty,
      updated_at = now()
  WHERE id = v_inventory.id;

  IF v_adjustment > 0 THEN
    INSERT INTO inventory_lots (
      dealer_id,
      branch_id,
      inventory_id,
      stock_purchase_id,
      product_id,
      supplier_id,
      batch_number,
      expiry_date,
      quantity_received,
      remaining_quantity,
      cost_price,
      selling_price,
      medicine_discount_percentage,
      final_unit_price,
      mrp
    ) VALUES (
      v_inventory.dealer_id,
      v_inventory.branch_id,
      v_inventory.id,
      NULL,
      v_inventory.product_id,
      NULL,
      v_inventory.batch_number,
      v_inventory.expiry_date,
      v_adjustment,
      v_adjustment,
      v_inventory.cost_price,
      v_inventory.selling_price,
      v_inventory.medicine_discount_percentage,
      CASE
        WHEN v_inventory.selling_price IS NULL THEN NULL
        ELSE ROUND(v_inventory.selling_price * (1 - GREATEST(0, LEAST(COALESCE(v_inventory.medicine_discount_percentage, 0), 100)) / 100), 2)
      END,
      v_inventory.mrp
    )
    RETURNING * INTO v_lot;

    INSERT INTO inventory_movements (
      dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes
    ) VALUES (
      v_inventory.dealer_id, v_inventory.branch_id, v_inventory.id, v_inventory.product_id, v_lot.id,
      'manual_adjustment', v_adjustment_id, v_adjustment, v_reason
    );
  ELSE
    v_remaining := abs(v_adjustment);

    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_inventory.dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
        AND (v_selected_lot_id IS NULL OR id = v_selected_lot_id)
      ORDER BY expiry_date NULLS LAST, received_at, created_at
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_consumed := LEAST(v_lot.remaining_quantity, v_remaining);

      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - v_consumed
      WHERE id = v_lot.id;

      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes
      ) VALUES (
        v_inventory.dealer_id, v_inventory.branch_id, v_inventory.id, v_inventory.product_id, v_lot.id,
        'manual_adjustment', v_adjustment_id, -v_consumed, v_reason
      );

      v_remaining := v_remaining - v_consumed;
    END LOOP;

    IF v_selected_lot_id IS NOT NULL AND v_remaining > 0 THEN
      RAISE EXCEPTION 'Selected lot does not have enough stock';
    END IF;

    IF v_remaining > 0 THEN
      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes
      ) VALUES (
        v_inventory.dealer_id, v_inventory.branch_id, v_inventory.id, v_inventory.product_id, NULL,
        'manual_adjustment', v_adjustment_id, -v_remaining, v_reason || ' (legacy stock)'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'inventory_id', v_inventory.id,
    'new_quantity', v_new_qty,
    'adjustment_id', v_adjustment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock_v1(JSONB) TO authenticated;
