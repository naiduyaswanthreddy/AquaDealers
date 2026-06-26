-- Update preview_fifo_bill_lines and create_bill_v2 to respect lot_id if provided

CREATE OR REPLACE FUNCTION public.preview_fifo_bill_lines(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fifo_preview$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_item JSONB;
  v_lot RECORD;
  v_inventory RECORD;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_base_unit_price NUMERIC;
  v_discount NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_subtotal NUMERIC := 0;
  v_gst_amount NUMERIC := 0;
  v_lines JSONB := '[]'::jsonb;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);

    SELECT *
    INTO v_inventory
    FROM inventory
    WHERE id = (v_item->>'inventory_id')::UUID
      AND dealer_id = v_dealer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item % not found', v_item->>'inventory_id';
    END IF;

    -- If a specific lot is requested, check if it has enough stock
    IF NULLIF(v_item->>'lot_id', '') IS NOT NULL THEN
      DECLARE
        v_requested_lot_stock NUMERIC;
      BEGIN
        SELECT remaining_quantity INTO v_requested_lot_stock
        FROM inventory_lots
        WHERE id = (v_item->>'lot_id')::UUID AND dealer_id = v_dealer_id;
        
        IF COALESCE(v_requested_lot_stock, 0) < v_remaining THEN
          RAISE EXCEPTION 'Insufficient stock in the selected batch for product %', v_item->>'product_name';
        END IF;
      END;
    ELSIF COALESCE(v_inventory.quantity_in_stock, 0) < v_remaining THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
    END IF;

    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
        AND (NULLIF(v_item->>'lot_id', '') IS NULL OR id = (v_item->>'lot_id')::UUID)
      ORDER BY expiry_date NULLS LAST, received_at, created_at
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);
      v_unit_price := CASE
        WHEN COALESCE(v_item->>'discount_source', '') IN ('farmer_product', 'farmer_default', 'manual')
          THEN ROUND(
            COALESCE(v_lot.selling_price, v_inventory.selling_price, (v_item->>'unit_price')::NUMERIC, 0)
            * (1 - GREATEST(0, LEAST(COALESCE((v_item->>'discount_percentage')::NUMERIC, 0), 100)) / 100),
            2
          )
        ELSE COALESCE(v_lot.final_unit_price, (v_item->>'unit_price')::NUMERIC, v_lot.selling_price, v_inventory.selling_price, 0)
      END;
      v_base_unit_price := COALESCE(v_lot.selling_price, v_inventory.selling_price, v_unit_price);
      v_discount := CASE
        WHEN COALESCE(v_item->>'discount_source', '') IN ('farmer_product', 'farmer_default', 'manual')
          THEN GREATEST(0, LEAST(COALESCE((v_item->>'discount_percentage')::NUMERIC, 0), 100))
        ELSE COALESCE(v_lot.medicine_discount_percentage, v_inventory.medicine_discount_percentage, 0)
      END;
      v_line_subtotal := ROUND(v_take * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      v_subtotal := v_subtotal + v_line_subtotal;
      v_gst_amount := v_gst_amount + v_line_gst;

      v_lines := v_lines || jsonb_build_object(
        'inventory_id', v_inventory.id,
        'product_id', v_inventory.product_id,
        'product_name', v_item->>'product_name',
        'hsn_code', NULLIF(v_item->>'hsn_code', ''),
        'quantity', v_take,
        'unit_price', v_unit_price,
        'base_unit_price', v_base_unit_price,
        'discount_percentage', v_discount,
        'discount_source', NULLIF(v_item->>'discount_source', ''),
        'discount_label', NULLIF(v_item->>'discount_label', ''),
        'gst_rate', COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        'gst_amount', v_line_gst,
        'total_price', v_line_subtotal + v_line_gst,
        'mrp', COALESCE(v_lot.mrp, v_inventory.mrp),
        'lot_id', v_lot.id,
        'batch_number', v_lot.batch_number,
        'expiry_date', v_lot.expiry_date
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_inventory.selling_price, 0);
      v_line_subtotal := ROUND(v_remaining * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      v_subtotal := v_subtotal + v_line_subtotal;
      v_gst_amount := v_gst_amount + v_line_gst;

      v_lines := v_lines || jsonb_build_object(
        'inventory_id', v_inventory.id,
        'product_id', v_inventory.product_id,
        'product_name', v_item->>'product_name',
        'hsn_code', NULLIF(v_item->>'hsn_code', ''),
        'quantity', v_remaining,
        'unit_price', v_unit_price,
        'base_unit_price', v_unit_price,
        'discount_percentage', 0,
        'discount_source', NULLIF(v_item->>'discount_source', ''),
        'discount_label', NULLIF(v_item->>'discount_label', ''),
        'gst_rate', COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        'gst_amount', v_line_gst,
        'total_price', v_line_subtotal + v_line_gst,
        'mrp', v_inventory.mrp,
        'lot_id', NULLIF(v_item->>'lot_id', ''),
        'batch_number', NULL,
        'expiry_date', NULL
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'gst_amount', v_gst_amount,
    'total', v_subtotal + v_gst_amount
  );
END;
$fifo_preview$;

CREATE OR REPLACE FUNCTION public.create_bill_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_bill_fifo$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_payment_id UUID;
  v_item JSONB;
  v_lot RECORD;
  v_inventory RECORD;
  v_bill_item_id UUID;
  v_farmer_due_add NUMERIC(12,2);
  v_balance_due NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_gst_amount NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_amount_paid NUMERIC(12,2);
  v_dealer_id UUID;
  v_branch_id UUID;
  v_is_historical BOOLEAN;
  v_reduce_stock BOOLEAN;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unit_price NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_payload_discount NUMERIC;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
  v_amount_paid := COALESCE((p_payload->>'amount_paid')::NUMERIC, 0);
  v_bill_number := COALESCE(NULLIF(p_payload->>'bill_number', ''), public.generate_receipt_number('AD'));

  PERFORM public.assert_dealer_access(v_dealer_id);

  IF NOT v_reduce_stock THEN
    v_subtotal := COALESCE((p_payload->>'subtotal')::NUMERIC, 0);
    v_gst_amount := COALESCE((p_payload->>'gst_amount')::NUMERIC, 0);
  ELSE
    SELECT subtotal, gst_amount
    INTO v_subtotal, v_gst_amount
    FROM jsonb_to_record(public.preview_fifo_bill_lines(p_payload)) AS x(subtotal NUMERIC, gst_amount NUMERIC);
  END IF;

  v_total := GREATEST(ROUND(v_subtotal + v_gst_amount - v_payload_discount, 2), 0);
  v_balance_due := GREATEST(v_total - v_amount_paid, 0);
  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    v_amount_paid, v_balance_due, NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale'
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

    IF v_reduce_stock THEN
      IF NULLIF(v_item->>'lot_id', '') IS NOT NULL THEN
        DECLARE
          v_requested_lot_stock NUMERIC;
        BEGIN
          SELECT remaining_quantity INTO v_requested_lot_stock
          FROM inventory_lots
          WHERE id = (v_item->>'lot_id')::UUID AND dealer_id = v_dealer_id;
          
          IF COALESCE(v_requested_lot_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
            RAISE EXCEPTION 'Insufficient stock in the selected batch for product %', v_item->>'product_name';
          END IF;
        END;
      ELSIF COALESCE(v_inventory.quantity_in_stock, 0) < COALESCE((v_item->>'quantity')::NUMERIC, 0) THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_item->>'product_name';
      END IF;
    END IF;

    IF NOT v_reduce_stock THEN
      v_line_subtotal := ROUND(COALESCE((v_item->>'quantity')::NUMERIC, 0) * COALESCE((v_item->>'unit_price')::NUMERIC, 0), 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);
      INSERT INTO bill_items (
        bill_id, product_id, product_name_snapshot, hsn_code_snapshot, quantity, unit_price, mrp,
        gst_rate, gst_amount, cgst_amount, sgst_amount, total_price, inventory_id_snapshot
      ) VALUES (
        v_bill_id, NULLIF(v_item->>'product_id', '')::UUID, NULLIF(v_item->>'product_name', ''),
        NULLIF(v_item->>'hsn_code', ''), COALESCE((v_item->>'quantity')::NUMERIC, 0),
        COALESCE((v_item->>'unit_price')::NUMERIC, 0), NULLIF(v_item->>'mrp', '')::NUMERIC,
        COALESCE((v_item->>'gst_rate')::NUMERIC, 0), v_line_gst, ROUND(v_line_gst / 2, 2),
        ROUND(v_line_gst / 2, 2), v_line_subtotal + v_line_gst, v_inventory.id
      );
      CONTINUE;
    END IF;

    v_remaining := COALESCE((v_item->>'quantity')::NUMERIC, 0);
    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
        AND (NULLIF(v_item->>'lot_id', '') IS NULL OR id = (v_item->>'lot_id')::UUID)
      ORDER BY expiry_date NULLS LAST, received_at, created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);
      v_unit_price := CASE
        WHEN COALESCE(v_item->>'discount_source', '') IN ('farmer_product', 'farmer_default', 'manual')
          THEN ROUND(
            COALESCE(v_lot.selling_price, v_inventory.selling_price, (v_item->>'unit_price')::NUMERIC, 0)
            * (1 - GREATEST(0, LEAST(COALESCE((v_item->>'discount_percentage')::NUMERIC, 0), 100)) / 100),
            2
          )
        ELSE COALESCE(v_lot.final_unit_price, (v_item->>'unit_price')::NUMERIC, v_lot.selling_price, v_inventory.selling_price, 0)
      END;
      v_line_subtotal := ROUND(v_take * v_unit_price, 2);
      v_line_gst := ROUND(v_line_subtotal * COALESCE((v_item->>'gst_rate')::NUMERIC, 0) / 100, 2);

      INSERT INTO bill_items (
        bill_id, product_id, product_name_snapshot, hsn_code_snapshot, quantity, unit_price, mrp,
        gst_rate, gst_amount, cgst_amount, sgst_amount, total_price, inventory_id_snapshot
      ) VALUES (
        v_bill_id, v_inventory.product_id, NULLIF(v_item->>'product_name', ''), NULLIF(v_item->>'hsn_code', ''),
        v_take, v_unit_price, COALESCE(v_lot.mrp, v_inventory.mrp), COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
        v_line_gst, ROUND(v_line_gst / 2, 2), ROUND(v_line_gst / 2, 2), v_line_subtotal + v_line_gst, v_inventory.id
      )
      RETURNING id INTO v_bill_item_id;

      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - v_take
      WHERE id = v_lot.id;

      INSERT INTO bill_item_lot_allocations (
        dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price
      ) VALUES (
        v_dealer_id, v_bill_id, v_bill_item_id, v_inventory.id, v_lot.id, v_inventory.product_id, v_take, v_unit_price
      );

      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes
      ) VALUES (
        v_dealer_id, v_branch_id, v_inventory.id, v_inventory.product_id, v_lot.id, 'bill', v_bill_id, -v_take,
        'Consumed through bill (lot selection applied)'
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock - COALESCE((v_item->>'quantity')::NUMERIC, 0),
        updated_at = now()
    WHERE id = v_inventory.id;
  END LOOP;

  IF NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
    SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
    WHERE id = (p_payload->>'farmer_id')::UUID
      AND dealer_id = v_dealer_id;
  END IF;

  IF v_amount_paid > 0 THEN
    INSERT INTO payments (
      dealer_id, branch_id, farmer_id, bill_id, amount, payment_date, method, upi_ref, cheque_no,
      notes, allocation_mode, receipt_number
    ) VALUES (
      v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_bill_id, v_amount_paid,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE), NULLIF(p_payload->>'payment_type', ''),
      NULLIF(p_payload->>'upi_ref', ''), NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''),
      'specific_bill', public.generate_receipt_number('RCPT')
    )
    RETURNING id INTO v_payment_id;

    INSERT INTO payment_allocations (dealer_id, payment_id, bill_id, farmer_id, allocated_amount, allocation_order)
    VALUES (v_dealer_id, v_payment_id, v_bill_id, NULLIF(p_payload->>'farmer_id', '')::UUID, v_amount_paid, 1);

    INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
    VALUES (
      v_dealer_id, v_branch_id, 'income',
      CASE WHEN NULLIF(p_payload->>'farmer_id', '') IS NULL THEN 'cash_sale' ELSE 'farmer_payment' END,
      v_payment_id, v_amount_paid, 'Payment received for bill ' || v_bill_number,
      COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE)
    );
  END IF;

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill_number,
    'payment_id', v_payment_id,
    'balance_due', v_balance_due,
    'subtotal', v_subtotal,
    'gst_amount', v_gst_amount,
    'total', v_total
  );
END;
$create_bill_fifo$;

GRANT EXECUTE ON FUNCTION public.preview_fifo_bill_lines(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;
