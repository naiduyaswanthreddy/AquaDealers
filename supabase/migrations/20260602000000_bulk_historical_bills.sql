ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT false;

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
  v_is_historical BOOLEAN;
  v_reduce_stock BOOLEAN;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);

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
    credit_override_reason,
    is_historical
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
    NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical
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

    IF v_reduce_stock AND COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
    END IF;

    INSERT INTO bill_items (
      bill_id,
      product_id,
      product_name_snapshot,
      hsn_code_snapshot,
      quantity,
      unit_price,
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
      COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100,
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 200,
      COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 200,
      (COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0))
        + (COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0) * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100),
      (v_item->>'inventory_id')::UUID
    );

    IF v_reduce_stock THEN
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
    END IF;
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
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO payment_allocations (
      dealer_id,
      payment_id,
      bill_id,
      farmer_id,
      allocated_amount,
      allocation_order
    ) VALUES (
      v_dealer_id,
      v_payment_id,
      v_bill_id,
      NULLIF(p_payload->>'farmer_id', '')::UUID,
      v_amount_paid,
      1
    );

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
      CASE WHEN NULLIF(p_payload->>'farmer_id', '') IS NULL THEN 'cash_sale' ELSE 'farmer_payment' END,
      v_payment_id,
      v_amount_paid,
      'Payment received for bill ' || v_bill_number,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE)
    );
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'payment_id', v_payment_id,
    'balance_due', v_balance_due
  );
END;
$$;
