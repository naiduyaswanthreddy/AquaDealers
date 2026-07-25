-- =============================================================================
-- Settlement Discount (2026-07-25)
--
-- Adds a post-negotiation discount field to bills so dealers can record when
-- a farmer pays less than the full bill total with the dealer's agreement.
--
-- bills.total stays unchanged (the computed bill value).
-- bills.settlement_discount_amount is the agreed reduction.
-- bills.balance_due = total - settlement_discount_amount - amount_paid
-- farmers.total_due is kept in sync by both create_bill_v2 and
-- apply_settlement_discount_v1.
-- =============================================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Schema: add settlement discount columns to bills
-- ──────────────────────────────────────────────────────────────
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS settlement_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_discount_reason TEXT;

-- ──────────────────────────────────────────────────────────────
-- 2. Update create_bill_v2 to accept settlement_discount_amount
--    Changes from 20260717000016:
--    • New variable v_settlement_discount read from payload
--    • balance_due now: total - settlement_discount - amount_paid
--    • bills INSERT includes settlement_discount_amount column
-- ──────────────────────────────────────────────────────────────
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
  v_settlement_discount NUMERIC(12,2);
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_branch_id := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_is_historical := COALESCE((p_payload->>'is_historical')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
  v_settlement_discount := COALESCE((p_payload->>'settlement_discount_amount')::NUMERIC, 0);
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
  v_balance_due := GREATEST(v_total - v_settlement_discount - v_amount_paid, 0);
  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    settlement_discount_amount, settlement_discount_reason,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type, is_verified, verification_method, delivery_pin
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    v_settlement_discount, NULLIF(p_payload->>'settlement_discount_reason', ''),
    v_amount_paid, v_balance_due, NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale', COALESCE((p_payload->>'is_verified')::BOOLEAN, true), NULLIF(p_payload->>'verification_method', ''), NULLIF(p_payload->>'delivery_pin', '')
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
      ORDER BY expiry_date NULLS LAST, received_at, created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);

      -- Always trust the client's unit_price (see 20260717000016 for rationale)
      v_unit_price := COALESCE(
        NULLIF(v_item->>'unit_price', '')::NUMERIC,
        v_lot.final_unit_price,
        v_lot.selling_price,
        v_inventory.selling_price,
        0
      );
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
        dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes, created_at
      ) VALUES (
        v_dealer_id, v_branch_id, v_inventory.id, v_inventory.product_id, v_lot.id, 'bill', v_bill_id, -v_take,
        'Consumed through FIFO-priced bill', COALESCE(NULLIF(p_payload->>'bill_date', '')::TIMESTAMPTZ, now())
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

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 3. Update get_farmer_ledger_page: bill amount = effective total
--    (total - settlement_discount_amount) so running balance is correct
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_farmer_ledger_page(
  p_farmer_id     UUID,
  p_dealer_id     UUID,
  p_page          INT DEFAULT 1,
  p_limit         INT DEFAULT 20,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT id FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
  ) t;

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      id,
      'bill' AS type,
      bill_number AS ref_number,
      bill_date AS date,
      (total - COALESCE(settlement_discount_amount, 0)) AS amount,
      balance_due,
      created_at
    FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT
      id,
      'payment' AS type,
      COALESCE(receipt_number, UPPER(method), 'PAYMENT') AS ref_number,
      payment_date AS date,
      amount,
      NULL AS balance_due,
      created_at
    FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 4. New RPC: apply_settlement_discount_v1
--    Applies/updates settlement discount on an existing bill.
--    Atomically updates bill.balance_due and farmers.total_due.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_settlement_discount_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill           bills%ROWTYPE;
  v_dealer_id      UUID;
  v_bill_id        UUID;
  v_amount         NUMERIC(12,2);
  v_reason         TEXT;
  v_old_settlement NUMERIC(12,2);
  v_delta          NUMERIC(12,2);
  v_new_balance    NUMERIC(12,2);
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_bill_id   := (p_payload->>'bill_id')::UUID;
  v_amount    := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_reason    := NULLIF(p_payload->>'reason', '');

  PERFORM public.assert_dealer_access(v_dealer_id);

  SELECT * INTO v_bill
  FROM bills
  WHERE id = v_bill_id AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;
  IF v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot apply settlement discount to a cancelled bill';
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Settlement discount cannot be negative';
  END IF;
  IF v_amount > v_bill.total THEN
    RAISE EXCEPTION 'Settlement discount cannot exceed bill total';
  END IF;
  IF (v_bill.total - v_amount) < v_bill.amount_paid THEN
    RAISE EXCEPTION 'Settlement discount cannot reduce effective total below amount already paid';
  END IF;

  v_old_settlement := COALESCE(v_bill.settlement_discount_amount, 0);
  v_delta          := v_amount - v_old_settlement;
  v_new_balance    := GREATEST(v_bill.total - v_amount - v_bill.amount_paid, 0);

  UPDATE bills
  SET settlement_discount_amount = v_amount,
      settlement_discount_reason = v_reason,
      balance_due                = v_new_balance
  WHERE id = v_bill_id;

  IF v_bill.farmer_id IS NOT NULL THEN
    UPDATE farmers
    SET total_due = total_due - v_delta
    WHERE id = v_bill.farmer_id AND dealer_id = v_dealer_id;
  END IF;

  INSERT INTO bill_audit_logs (bill_id, dealer_id, action, old_value, new_value)
  VALUES (
    v_bill_id,
    v_dealer_id,
    'settlement_discount_applied',
    jsonb_build_object('settlement_discount_amount', v_old_settlement),
    jsonb_build_object('settlement_discount_amount', v_amount, 'reason', v_reason)
  );

  RETURN jsonb_build_object(
    'bill_id',                    v_bill_id,
    'settlement_discount_amount', v_amount,
    'balance_due',                v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_settlement_discount_v1(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
