-- =============================================================================
-- AquaDealer MRP Feature
-- Migration 024: Add MRP to stock purchases, inventory, and bill items
-- =============================================================================

ALTER TABLE stock_purchases
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

-- Update record_stock_purchase_v2 to accept and save mrp
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
  v_mrp NUMERIC(10,2) := NULLIF(p_payload->>'mrp', '')::NUMERIC;
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
    mrp,
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
    v_mrp,
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
      mrp,
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
      v_mrp,
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
        mrp = COALESCE(v_mrp, mrp),
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
    -- Only reduce from counter cash if method is 'cash'
    IF COALESCE(p_payload->>'payment_method', 'cash') = 'cash' THEN
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
    END IF;
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

-- Update create_bill_v2 to support saving MRP
CREATE OR REPLACE FUNCTION public.create_bill_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_payment_id UUID;
  v_item JSONB;
  v_inventory RECORD;
  v_farmer_due_add NUMERIC(12,2);
  v_balance_due NUMERIC(12,2);
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_amount_paid NUMERIC(12,2);
  v_dealer_id UUID;
  v_branch_id UUID;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  PERFORM public.assert_dealer_access(v_dealer_id);

  v_subtotal := COALESCE((p_payload->>'subtotal')::NUMERIC, 0);
  v_total := COALESCE((p_payload->>'total')::NUMERIC, 0);
  v_amount_paid := COALESCE((p_payload->>'amount_paid')::NUMERIC, 0);
  v_balance_due := GREATEST(v_total - v_amount_paid, 0);
  v_farmer_due_add := v_balance_due;
  v_bill_number := COALESCE(NULLIF(p_payload->>'bill_number', ''), public.generate_receipt_number('AD'));

  INSERT INTO bills (
    bill_number,
    dealer_id,
    branch_id,
    farmer_id,
    farmer_name_snapshot,
    farmer_gstin,
    bill_date,
    subtotal,
    gst_amount,
    cgst_amount,
    sgst_amount,
    igst_amount,
    discount_amount,
    total,
    amount_paid,
    balance_due,
    payment_type,
    upi_ref,
    cheque_number,
    notes,
    status,
    credit_override_used,
    credit_override_reason
  ) VALUES (
    v_bill_number,
    v_dealer_id,
    v_branch_id,
    NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''),
    NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal,
    COALESCE((p_payload->>'gst_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'cgst_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'sgst_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0),
    COALESCE((p_payload->>'discount_amount')::NUMERIC, 0),
    v_total,
    v_amount_paid,
    v_balance_due,
    NULLIF(p_payload->>'payment_type', ''),
    NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''),
    NULLIF(p_payload->>'notes', ''),
    'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false),
    NULLIF(p_payload->>'credit_override_reason', '')
  )
  RETURNING id INTO v_bill_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    SELECT *
    INTO v_inventory
    FROM inventory
    WHERE id = (v_item->>'inventory_id')::UUID
      AND dealer_id = v_dealer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id';
    END IF;

    IF COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
    END IF;

    INSERT INTO bill_items (
      bill_id,
      product_id,
      product_name_snapshot,
      hsn_code_snapshot,
      quantity,
      unit_price,
      mrp,
      gst_rate,
      gst_amount,
      cgst_amount,
      sgst_amount,
      total_price,
      inventory_id_snapshot
    ) VALUES (
      v_bill_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      NULLIF(v_item->>'product_name', ''),
      NULLIF(v_item->>'hsn_code', ''),
      COALESCE((v_item->>'quantity')::NUMERIC, 0),
      COALESCE((v_item->>'unit_price')::NUMERIC, 0),
      NULLIF(v_item->>'mrp', '')::NUMERIC,
      COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100,
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 200,
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 200,
      (COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0))
        + (COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100),
      (v_item->>'inventory_id')::UUID
    );

    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock - COALESCE((v_item->>'quantity')::NUMERIC, 0),
        updated_at = now()
    WHERE id = v_inventory.id;

    PERFORM public.consume_inventory_lots(
      v_dealer_id,
      v_inventory.id,
      v_inventory.product_id,
      v_bill_id,
      COALESCE((v_item->>'quantity')::NUMERIC, 0)
    );
  END LOOP;

  IF NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
    SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
    WHERE id = (p_payload->>'farmer_id')::UUID
      AND dealer_id = v_dealer_id;
  END IF;

  IF v_amount_paid > 0 THEN
    INSERT INTO payments (
      dealer_id,
      branch_id,
      farmer_id,
      bill_id,
      amount,
      payment_date,
      method,
      upi_ref,
      cheque_no,
      notes,
      allocation_mode,
      receipt_number
    ) VALUES (
      v_dealer_id,
      v_branch_id,
      NULLIF(p_payload->>'farmer_id', '')::UUID,
      v_bill_id,
      v_amount_paid,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
      NULLIF(p_payload->>'payment_type', ''),
      NULLIF(p_payload->>'upi_ref', ''),
      NULLIF(p_payload->>'cheque_number', ''),
      NULLIF(p_payload->>'notes', ''),
      'specific_bill',
      public.generate_receipt_number('RCPT')
    ) RETURNING id INTO v_payment_id;

    IF NULLIF(p_payload->>'payment_type', '') = 'cash' THEN
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
        'income',
        'bill_payment',
        v_payment_id,
        v_amount_paid,
        'Received payment for bill ' || v_bill_number,
        COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'payment_id', v_payment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;
