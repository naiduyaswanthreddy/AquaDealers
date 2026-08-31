-- Patch three functions that recompute farmers.total_due without an is_estimate filter.
-- Estimates have balance_due = 0 by construction, so the math is already correct, but
-- the explicit filter makes the intent clear and guards against future code paths.

-- ── 1. recalculate_farmer_due_v1 (canonical trigger function) ─────────────────
CREATE OR REPLACE FUNCTION public.recalculate_farmer_due_v1(p_farmer_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due NUMERIC;
BEGIN
  SELECT GREATEST(0,
    COALESCE(f.opening_balance, 0)
    + COALESCE((
        SELECT SUM(b.balance_due)
        FROM public.bills b
        WHERE b.farmer_id = f.id
          AND b.deleted_at IS NULL
          AND b.status <> 'cancelled'
          AND COALESCE(b.is_estimate, false) = false
      ), 0)
    - COALESCE((
      SELECT SUM(p.amount - COALESCE((SELECT SUM(a.allocated_amount) FROM public.payment_allocations a WHERE a.payment_id = p.id), 0))
      FROM public.payments p
      WHERE p.farmer_id = f.id
         OR p.bill_id IN (SELECT id FROM public.bills WHERE farmer_id = f.id AND deleted_at IS NULL)
    ), 0)
    - COALESCE(f.return_credit_balance, 0)
  ) INTO v_due FROM public.farmers f WHERE f.id = p_farmer_id FOR UPDATE;
  UPDATE public.farmers SET total_due = v_due WHERE id = p_farmer_id;
  RETURN v_due;
END; $$;

-- ── 2. create_bill_return (inline SUM → delegate to canonical function) ────────
CREATE OR REPLACE FUNCTION public.create_bill_return(
  p_bill_id UUID,
  p_return_date DATE,
  p_notes TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_bill bills%ROWTYPE;
  v_return_id UUID := gen_random_uuid();
  v_return_number TEXT;
  v_item JSONB;
  v_bill_item bill_items%ROWTYPE;
  v_ret_qty NUMERIC;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_total NUMERIC := 0;
  v_alloc RECORD;
  v_qty_remaining NUMERIC;
  v_restock_here NUMERIC;
  v_new_balance NUMERIC;
  v_new_farmer_due NUMERIC;
BEGIN
  -- Auth: allow dealer OR their staff.
  v_dealer_id := COALESCE(auth.uid(), public.staff_dealer_id());
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_bill FROM bills WHERE id = p_bill_id AND dealer_id = v_dealer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_bill.deleted_at IS NOT NULL OR v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Bill is cancelled or deleted; cannot record return';
  END IF;

  v_return_number := public.next_return_number(v_dealer_id);

  INSERT INTO bill_returns (id, dealer_id, branch_id, bill_id, farmer_id,
                            return_number, return_date, total_amount, notes)
  VALUES (v_return_id, v_dealer_id, v_bill.branch_id, p_bill_id, v_bill.farmer_id,
          v_return_number, COALESCE(p_return_date, CURRENT_DATE), 0, p_notes);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_bill_item
      FROM bill_items
     WHERE id = (v_item->>'bill_item_id')::UUID
       AND bill_id = p_bill_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bill item % not on this bill', v_item->>'bill_item_id'; END IF;

    v_ret_qty := (v_item->>'quantity')::NUMERIC;
    IF v_ret_qty IS NULL OR v_ret_qty <= 0 THEN RAISE EXCEPTION 'Return quantity must be > 0'; END IF;

    -- Guard: total returned qty for this bill_item across all returns must not exceed original.
    IF v_ret_qty + COALESCE((
      SELECT SUM(quantity) FROM bill_return_items
       WHERE bill_item_id = v_bill_item.id
    ), 0) > v_bill_item.quantity THEN
      RAISE EXCEPTION 'Return quantity exceeds remaining for %',
        COALESCE(v_bill_item.product_name_snapshot, 'item');
    END IF;

    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_bill_item.unit_price);
    v_line_total := ROUND(v_ret_qty * v_unit_price, 2);
    v_total := v_total + v_line_total;

    INSERT INTO bill_return_items (return_id, dealer_id, bill_item_id, product_id,
                                    product_name_snapshot, quantity, unit_price, total_price)
    VALUES (v_return_id, v_dealer_id, v_bill_item.id, v_bill_item.product_id,
            v_bill_item.product_name_snapshot, v_ret_qty, v_unit_price, v_line_total);

    -- Restock: walk the original FIFO allocations for this bill_item, adding
    -- back qty until we've placed all v_ret_qty units.
    v_qty_remaining := v_ret_qty;
    FOR v_alloc IN
      SELECT a.id AS alloc_id, a.lot_id, a.inventory_id, a.quantity AS orig_qty
        FROM bill_item_lot_allocations a
       WHERE a.bill_item_id = v_bill_item.id
       ORDER BY a.created_at ASC
    LOOP
      EXIT WHEN v_qty_remaining <= 0;
      v_restock_here := LEAST(v_qty_remaining, v_alloc.orig_qty);

      IF v_alloc.lot_id IS NOT NULL THEN
        UPDATE inventory_lots
           SET remaining_quantity = remaining_quantity + v_restock_here
         WHERE id = v_alloc.lot_id;
      END IF;

      UPDATE inventory
         SET quantity_in_stock = quantity_in_stock + v_restock_here,
             updated_at = now()
       WHERE id = v_alloc.inventory_id;

      INSERT INTO inventory_movements (
        dealer_id, branch_id, inventory_id, product_id, lot_id,
        quantity_change, reference_type, reference_id, notes, created_at
      ) VALUES (
        v_dealer_id, v_bill.branch_id, v_alloc.inventory_id, v_bill_item.product_id, v_alloc.lot_id,
        v_restock_here, 'return', v_return_id,
        'Return against bill ' || v_bill.bill_number, now()
      );

      v_qty_remaining := v_qty_remaining - v_restock_here;
    END LOOP;

    -- Fallback: no lot allocations found (edge case for old bills) — restock
    -- against the current inventory row for this product/branch.
    IF v_qty_remaining > 0 THEN
      UPDATE inventory
         SET quantity_in_stock = quantity_in_stock + v_qty_remaining,
             updated_at = now()
       WHERE dealer_id = v_dealer_id
         AND branch_id = v_bill.branch_id
         AND product_id = v_bill_item.product_id
       RETURNING id INTO v_alloc.inventory_id;

      IF v_alloc.inventory_id IS NOT NULL THEN
        INSERT INTO inventory_movements (
          dealer_id, branch_id, inventory_id, product_id,
          quantity_change, reference_type, reference_id, notes, created_at
        ) VALUES (
          v_dealer_id, v_bill.branch_id, v_alloc.inventory_id, v_bill_item.product_id,
          v_qty_remaining, 'return', v_return_id,
          'Return against bill ' || v_bill.bill_number || ' (no lot map)', now()
        );
      END IF;
    END IF;
  END LOOP;

  -- Finalise the return header + adjust bill balance + refresh farmer.total_due.
  UPDATE bill_returns SET total_amount = v_total WHERE id = v_return_id;

  v_new_balance := GREATEST(0, COALESCE(v_bill.balance_due, 0) - v_total);
  UPDATE bills
     SET balance_due = v_new_balance,
         amount_paid = COALESCE(amount_paid, 0) + LEAST(v_total, COALESCE(v_bill.balance_due, 0))
   WHERE id = p_bill_id;

  IF v_bill.farmer_id IS NOT NULL THEN
    -- Delegate to canonical function so the is_estimate filter is always applied.
    v_new_farmer_due := public.recalculate_farmer_due_v1(v_bill.farmer_id);
  ELSE
    v_new_farmer_due := NULL;
  END IF;

  RETURN jsonb_build_object(
    'return_id', v_return_id,
    'return_number', v_return_number,
    'total', v_total,
    'new_bill_balance', v_new_balance,
    'new_farmer_due', v_new_farmer_due
  );
END;
$$;

-- ── 3. settle_farmer_remaining_balance (inline SUM → canonical function) ──────
CREATE OR REPLACE FUNCTION public.settle_farmer_remaining_balance(
  p_dealer_id UUID,
  p_farmer_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       RECORD;
  v_total NUMERIC := 0;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  FOR r IN
    SELECT id, balance_due
    FROM bills
    WHERE dealer_id   = p_dealer_id
      AND farmer_id   = p_farmer_id
      AND balance_due > 0
      AND status     != 'cancelled'
      AND deleted_at  IS NULL
  LOOP
    UPDATE bills
    SET settlement_discount_amount = settlement_discount_amount + r.balance_due,
        balance_due                = 0,
        updated_at                 = now()
    WHERE id = r.id;

    INSERT INTO audit_logs (dealer_id, action, entity_type, entity_id, metadata)
    VALUES (
      p_dealer_id,
      'settlement_discount_applied',
      'bill',
      r.id,
      jsonb_build_object(
        'amount', r.balance_due,
        'reason', p_reason,
        'farmer_id', p_farmer_id
      )
    );

    v_total := v_total + r.balance_due;
  END LOOP;

  -- Delegate to canonical function so the is_estimate filter is always applied.
  PERFORM public.recalculate_farmer_due_v1(p_farmer_id);

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_farmer_remaining_balance(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_farmer_remaining_balance(UUID, UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
