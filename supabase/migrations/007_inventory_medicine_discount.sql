-- =============================================================================
-- AquaDealer Inventory Medicine Discount
-- Migration 007: Persist inventory-level medicine discount percentage
-- =============================================================================

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS medicine_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.record_stock_purchase_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_branch_id UUID := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_product_id UUID := (p_payload->>'product_id')::UUID;
  v_supplier_id UUID := NULLIF(p_payload->>'supplier_id', '')::UUID;
  v_quantity NUMERIC(10,2) := COALESCE((p_payload->>'quantity')::NUMERIC, 0);
  v_cost NUMERIC(10,2) := COALESCE((p_payload->>'cost_price_per_unit')::NUMERIC, 0);
  v_total NUMERIC(12,2) := COALESCE((p_payload->>'total_amount')::NUMERIC, 0);
  v_selling_price NUMERIC(10,2) := NULLIF(p_payload->>'selling_price', '')::NUMERIC;
  v_medicine_discount_percentage NUMERIC(5,2) := GREATEST(0, LEAST(COALESCE((p_payload->>'medicine_discount_percentage')::NUMERIC, 0), 100));
  v_purchase_id UUID;
  v_inventory_id UUID;
  v_lot_id UUID;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Product is required';
  END IF;

  IF v_quantity <= 0 THEN
    RAISE EXCEPTION 'Purchase quantity must be greater than zero';
  END IF;

  INSERT INTO stock_purchases (
    dealer_id,
    branch_id,
    product_id,
    supplier_id,
    quantity,
    cost_price_per_unit,
    gst_amount,
    total_amount,
    purchase_date,
    invoice_number,
    batch_number,
    expiry_date,
    is_paid,
    notes
  )
  VALUES (
    v_dealer_id,
    v_branch_id,
    v_product_id,
    v_supplier_id,
    v_quantity,
    v_cost,
    COALESCE((p_payload->>'gst_amount')::NUMERIC, 0),
    v_total,
    COALESCE(NULLIF(p_payload->>'purchase_date', '')::DATE, CURRENT_DATE),
    NULLIF(p_payload->>'invoice_number', ''),
    NULLIF(p_payload->>'batch_number', ''),
    NULLIF(p_payload->>'expiry_date', '')::DATE,
    COALESCE((p_payload->>'is_paid')::BOOLEAN, true),
    NULLIF(p_payload->>'notes', '')
  )
  RETURNING id INTO v_purchase_id;

  SELECT id
  INTO v_inventory_id
  FROM inventory
  WHERE dealer_id = v_dealer_id
    AND product_id = v_product_id
    AND (
      (branch_id IS NULL AND v_branch_id IS NULL)
      OR branch_id = v_branch_id
    )
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (
      dealer_id,
      branch_id,
      product_id,
      quantity_in_stock,
      cost_price,
      selling_price,
      medicine_discount_percentage,
      batch_number,
      expiry_date,
      updated_at
    ) VALUES (
      v_dealer_id,
      v_branch_id,
      v_product_id,
      v_quantity,
      v_cost,
      COALESCE(v_selling_price, NULLIF(p_payload->>'default_price', '')::NUMERIC, v_cost),
      v_medicine_discount_percentage,
      NULLIF(p_payload->>'batch_number', ''),
      NULLIF(p_payload->>'expiry_date', '')::DATE,
      now()
    )
    RETURNING id INTO v_inventory_id;
  ELSE
    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock + v_quantity,
        cost_price = v_cost,
        selling_price = COALESCE(v_selling_price, selling_price, v_cost),
        medicine_discount_percentage = v_medicine_discount_percentage,
        batch_number = COALESCE(NULLIF(p_payload->>'batch_number', ''), batch_number),
        expiry_date = COALESCE(NULLIF(p_payload->>'expiry_date', '')::DATE, expiry_date),
        updated_at = now()
    WHERE id = v_inventory_id;
  END IF;

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
    cost_price
  ) VALUES (
    v_dealer_id,
    v_branch_id,
    v_inventory_id,
    v_purchase_id,
    v_product_id,
    v_supplier_id,
    NULLIF(p_payload->>'batch_number', ''),
    NULLIF(p_payload->>'expiry_date', '')::DATE,
    v_quantity,
    v_quantity,
    v_cost
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO inventory_movements (
    dealer_id,
    branch_id,
    inventory_id,
    product_id,
    lot_id,
    reference_type,
    reference_id,
    quantity_change,
    notes
  ) VALUES (
    v_dealer_id,
    v_branch_id,
    v_inventory_id,
    v_product_id,
    v_lot_id,
    'purchase',
    v_purchase_id,
    v_quantity,
    'Stock purchase received'
  );

  IF COALESCE((p_payload->>'is_paid')::BOOLEAN, true) THEN
    INSERT INTO cash_book (
      dealer_id,
      branch_id,
      entry_type,
      source,
      reference_id,
      amount,
      notes,
      entry_date
    ) VALUES (
      v_dealer_id,
      v_branch_id,
      'expense',
      'stock_purchase',
      v_purchase_id,
      v_total,
      'Paid stock purchase',
      COALESCE(NULLIF(p_payload->>'purchase_date', '')::DATE, CURRENT_DATE)
    );
  ELSIF v_supplier_id IS NOT NULL THEN
    UPDATE suppliers
    SET total_due = COALESCE(total_due, 0) + v_total
    WHERE id = v_supplier_id
      AND dealer_id = v_dealer_id;
  END IF;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'inventory_id', v_inventory_id,
    'lot_id', v_lot_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_purchase_v2(JSONB) TO authenticated;
