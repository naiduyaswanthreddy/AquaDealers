-- =============================================================================
-- estimate_bills — 2026-08-07
--
-- 1. Add is_estimate BOOLEAN column to bills (default false, NOT NULL).
-- 2. Update create_bill_v2 to handle estimate bills:
--    - Estimates never reduce stock.
--    - Estimates record balance_due = 0 and amount_paid = 0.
--    - Estimates do not update farmer dues.
--    - Estimates do not create payment records.
-- 3. Update get_farmer_ledger_page to expose is_estimate on bill rows so the
--    UI can visually distinguish estimates from real bills.
-- =============================================================================

-- 1. Column ----------------------------------------------------------------
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN NOT NULL DEFAULT false;

-- 2. create_bill_v2 --------------------------------------------------------
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
  v_is_estimate BOOLEAN;
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
  v_is_estimate := COALESCE((p_payload->>'is_estimate')::BOOLEAN, false);
  v_reduce_stock := COALESCE((p_payload->>'reduce_stock')::BOOLEAN, true);
  v_payload_discount := COALESCE((p_payload->>'discount_amount')::NUMERIC, 0);
  v_amount_paid := COALESCE((p_payload->>'amount_paid')::NUMERIC, 0);
  v_bill_number := COALESCE(NULLIF(p_payload->>'bill_number', ''), public.generate_receipt_number('AD'));

  -- Estimates never touch stock regardless of what the client sent.
  IF v_is_estimate THEN
    v_reduce_stock := false;
  END IF;

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

  -- Estimates carry no balance and accept no payment.
  IF v_is_estimate THEN
    v_balance_due := 0;
    v_amount_paid := 0;
  ELSE
    v_balance_due := GREATEST(v_total - v_amount_paid, 0);
  END IF;

  v_farmer_due_add := v_balance_due;

  INSERT INTO bills (
    bill_number, dealer_id, branch_id, farmer_id, farmer_name_snapshot, farmer_gstin, bill_date,
    subtotal, gst_amount, cgst_amount, sgst_amount, igst_amount, discount_amount, total,
    amount_paid, balance_due, payment_type, upi_ref, cheque_number, notes, status,
    credit_override_used, credit_override_reason, is_historical, type, is_verified, verification_method, delivery_pin,
    is_estimate
  ) VALUES (
    v_bill_number, v_dealer_id, v_branch_id, NULLIF(p_payload->>'farmer_id', '')::UUID,
    NULLIF(p_payload->>'farmer_name_snapshot', ''), NULLIF(p_payload->>'farmer_gstin', ''),
    COALESCE(NULLIF(p_payload->>'bill_date', '')::DATE, CURRENT_DATE),
    v_subtotal, v_gst_amount, ROUND(v_gst_amount / 2, 2), ROUND(v_gst_amount / 2, 2),
    COALESCE((p_payload->>'igst_amount')::NUMERIC, 0), v_payload_discount, v_total,
    CASE WHEN v_is_estimate THEN 0 ELSE v_amount_paid END,
    v_balance_due, NULLIF(p_payload->>'payment_type', ''), NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_number', ''), NULLIF(p_payload->>'notes', ''), 'active',
    COALESCE((p_payload->>'credit_override_used')::BOOLEAN, false), NULLIF(p_payload->>'credit_override_reason', ''),
    v_is_historical, 'sale', COALESCE((p_payload->>'is_verified')::BOOLEAN, true), NULLIF(p_payload->>'verification_method', ''), NULLIF(p_payload->>'delivery_pin', ''),
    v_is_estimate
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
      -- Estimates (and other non-stock bills) take this path: insert bill_items
      -- without touching inventory lots or movements.
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

    -- Stock-reducing path: FIFO lot allocation.
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

      -- ALWAYS trust the client's unit_price if it is set. The cart has
      -- already computed base × (1 - discount/100) and shown the result
      -- to the user; the server just persists that number. Lot / inventory
      -- prices are pure fallbacks for legacy or malformed payloads.
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

  -- Farmer dues: skip for estimates (balance_due is always 0 anyway, but
  -- we guard explicitly so the farmer record is never touched for estimates).
  IF NOT v_is_estimate AND NULLIF(p_payload->>'farmer_id', '') IS NOT NULL AND v_farmer_due_add > 0 THEN
    UPDATE farmers
    SET total_due = COALESCE(total_due, 0) + v_farmer_due_add
    WHERE id = (p_payload->>'farmer_id')::UUID
      AND dealer_id = v_dealer_id;
  END IF;

  -- Payment records: estimates never carry a payment.
  IF NOT v_is_estimate AND v_amount_paid > 0 THEN
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

-- 3. get_farmer_ledger_page ------------------------------------------------
-- Add is_estimate to the bills sub-query; payments and returns get false so
-- the UNION column list stays consistent.
CREATE OR REPLACE FUNCTION public.get_farmer_ledger_page(
  p_farmer_id UUID, p_dealer_id UUID, p_page INT DEFAULT 1, p_limit INT DEFAULT 20,
  p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_offset INT := (p_page - 1) * p_limit; v_total BIGINT; v_rows JSONB;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);
  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM public.bills WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND status <> 'cancelled' AND (p_start_date IS NULL OR bill_date >= p_start_date) AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL SELECT id FROM public.payments WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND (p_start_date IS NULL OR payment_date >= p_start_date) AND (p_end_date IS NULL OR payment_date <= p_end_date)
    UNION ALL SELECT id FROM public.bill_returns WHERE farmer_id = p_farmer_id AND dealer_id = p_dealer_id AND (p_start_date IS NULL OR return_date >= p_start_date) AND (p_end_date IS NULL OR return_date <= p_end_date)
  ) records;
  SELECT COALESCE(jsonb_agg(row_to_json(record)), '[]'::JSONB) INTO v_rows FROM (
    SELECT b.id, 'bill'::TEXT AS type, b.bill_number AS ref_number, b.bill_date AS date, b.total AS amount, b.balance_due, b.created_at, COALESCE(b.branch_name_snapshot, br.name) AS branch_name, COALESCE(b.is_estimate, false) AS is_estimate FROM public.bills b LEFT JOIN public.branches br ON br.id = b.branch_id WHERE b.farmer_id = p_farmer_id AND b.dealer_id = p_dealer_id AND b.status <> 'cancelled' AND (p_start_date IS NULL OR b.bill_date >= p_start_date) AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    UNION ALL SELECT p.id, 'payment'::TEXT, COALESCE(p.receipt_number, UPPER(p.method), 'PAYMENT'), p.payment_date, p.amount, NULL, p.created_at, COALESCE(p.branch_name_snapshot, br.name), false AS is_estimate FROM public.payments p LEFT JOIN public.branches br ON br.id = p.branch_id WHERE p.farmer_id = p_farmer_id AND p.dealer_id = p_dealer_id AND (p_start_date IS NULL OR p.payment_date >= p_start_date) AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    UNION ALL SELECT r.id, 'return'::TEXT, COALESCE(r.return_number, 'RETURN'), r.return_date, r.total_amount, NULL, r.created_at, COALESCE(r.branch_name_snapshot, br.name), false AS is_estimate FROM public.bill_returns r LEFT JOIN public.branches br ON br.id = r.branch_id WHERE r.farmer_id = p_farmer_id AND r.dealer_id = p_dealer_id AND (p_start_date IS NULL OR r.return_date >= p_start_date) AND (p_end_date IS NULL OR r.return_date <= p_end_date)
    ORDER BY created_at DESC LIMIT p_limit OFFSET v_offset
  ) record;
  RETURN jsonb_build_object('total', v_total, 'page', p_page, 'limit', p_limit, 'data', v_rows);
END; $$;

GRANT EXECUTE ON FUNCTION public.get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
