-- Extend edit_bill_v1 to also update bill_date when provided in the payload.
-- Previously, the service did two round-trips: the RPC + a separate UPDATE for
-- bill_date. This migration folds the date update into the RPC so it's atomic.

CREATE OR REPLACE FUNCTION public.edit_bill_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $edit_bill$
DECLARE
  v_bill_id UUID := (p_payload->>'bill_id')::UUID;
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_bill_date DATE := NULLIF(p_payload->>'bill_date', '')::DATE;
  v_user_id UUID := auth.uid();
  v_bill RECORD;
  v_edit JSONB;
  v_bill_item RECORD;
  v_inventory RECORD;
  v_allocation RECORD;
  v_lot RECORD;
  v_old_qty NUMERIC;
  v_new_qty NUMERIC;
  v_new_unit_price NUMERIC;
  v_qty_to_process NUMERIC;
  v_quantity_to_return NUMERIC;
  v_take NUMERIC;
  v_line_subtotal NUMERIC;
  v_line_gst NUMERIC;
  v_old_total NUMERIC(12,2);
  v_old_balance_due NUMERIC(12,2);
  v_new_subtotal NUMERIC(12,2);
  v_new_gst_amount NUMERIC(12,2);
  v_new_total NUMERIC(12,2);
  v_new_balance_due NUMERIC(12,2);
  v_due_delta NUMERIC(12,2);
  v_audit_changes JSONB := '[]'::JSONB;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF jsonb_typeof(COALESCE(p_payload->'edits', 'null'::JSONB)) <> 'array'
     OR jsonb_array_length(COALESCE(p_payload->'edits', '[]'::JSONB)) = 0 THEN
    RAISE EXCEPTION 'At least one bill item edit is required';
  END IF;

  SELECT * INTO v_bill
  FROM public.bills
  WHERE id = v_bill_id AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill % not found', v_bill_id;
  END IF;

  IF v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled bills cannot be edited';
  END IF;

  IF COALESCE(v_bill.type, 'sale') = 'adjustment' THEN
    RAISE EXCEPTION 'Rate adjustment bills cannot be edited';
  END IF;

  v_old_total := COALESCE(v_bill.total, 0);
  v_old_balance_due := COALESCE(v_bill.balance_due, 0);

  FOR v_edit IN SELECT value FROM jsonb_array_elements(p_payload->'edits')
  LOOP
    SELECT * INTO v_bill_item
    FROM public.bill_items
    WHERE id = (v_edit->>'bill_item_id')::UUID
      AND bill_id = v_bill_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bill item % does not belong to bill %', v_edit->>'bill_item_id', v_bill_id;
    END IF;

    v_old_qty := COALESCE(v_bill_item.quantity, 0);
    v_new_qty := NULLIF(v_edit->>'quantity', '')::NUMERIC;
    v_new_unit_price := NULLIF(v_edit->>'unit_price', '')::NUMERIC;

    IF v_new_qty IS NULL OR v_new_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero for %', v_bill_item.product_name_snapshot;
    END IF;

    IF v_new_unit_price IS NULL OR v_new_unit_price < 0 THEN
      RAISE EXCEPTION 'Unit price cannot be negative for %', v_bill_item.product_name_snapshot;
    END IF;

    IF NOT COALESCE(v_bill.is_historical, false)
       AND v_new_qty <> v_old_qty
       AND v_bill_item.inventory_id_snapshot IS NOT NULL THEN
      SELECT * INTO v_inventory
      FROM public.inventory
      WHERE id = v_bill_item.inventory_id_snapshot
        AND dealer_id = v_dealer_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item for % no longer exists', v_bill_item.product_name_snapshot;
      END IF;

      IF v_new_qty < v_old_qty THEN
        v_qty_to_process := v_old_qty - v_new_qty;

        FOR v_allocation IN
          SELECT *
          FROM public.bill_item_lot_allocations
          WHERE bill_item_id = v_bill_item.id
          ORDER BY created_at DESC
          FOR UPDATE
        LOOP
          EXIT WHEN v_qty_to_process <= 0;

          IF v_allocation.lot_id IS NULL THEN
            CONTINUE;
          END IF;

          v_quantity_to_return := LEAST(v_allocation.quantity, v_qty_to_process);
          UPDATE public.inventory_lots
          SET remaining_quantity = remaining_quantity + v_quantity_to_return
          WHERE id = v_allocation.lot_id;

          INSERT INTO public.inventory_movements (
            dealer_id, branch_id, inventory_id, product_id, lot_id,
            reference_type, reference_id, quantity_change, notes
          ) VALUES (
            v_dealer_id, v_bill.branch_id, v_inventory.id, v_inventory.product_id, v_allocation.lot_id,
            'bill_edit', v_bill_id, v_quantity_to_return, 'Stock restored through bill edit'
          );

          IF v_allocation.quantity = v_quantity_to_return THEN
            DELETE FROM public.bill_item_lot_allocations WHERE id = v_allocation.id;
          ELSE
            UPDATE public.bill_item_lot_allocations
            SET quantity = quantity - v_quantity_to_return
            WHERE id = v_allocation.id;
          END IF;

          v_qty_to_process := v_qty_to_process - v_quantity_to_return;
        END LOOP;

        IF v_qty_to_process > 0 THEN
          RAISE EXCEPTION 'Cannot reduce % because its original lot allocation is incomplete', v_bill_item.product_name_snapshot;
        END IF;

        UPDATE public.inventory
        SET quantity_in_stock = quantity_in_stock + (v_old_qty - v_new_qty), updated_at = now()
        WHERE id = v_inventory.id;
      ELSE
        v_qty_to_process := v_new_qty - v_old_qty;

        IF COALESCE(v_inventory.quantity_in_stock, 0) < v_qty_to_process THEN
          RAISE EXCEPTION 'Insufficient stock to increase quantity for %', v_bill_item.product_name_snapshot;
        END IF;

        FOR v_lot IN
          SELECT *
          FROM public.inventory_lots
          WHERE inventory_id = v_inventory.id AND remaining_quantity > 0
          ORDER BY expiry_date NULLS LAST, received_at, created_at
          FOR UPDATE
        LOOP
          EXIT WHEN v_qty_to_process <= 0;
          v_take := LEAST(v_lot.remaining_quantity, v_qty_to_process);

          UPDATE public.inventory_lots
          SET remaining_quantity = remaining_quantity - v_take
          WHERE id = v_lot.id;

          INSERT INTO public.inventory_movements (
            dealer_id, branch_id, inventory_id, product_id, lot_id,
            reference_type, reference_id, quantity_change, notes
          ) VALUES (
            v_dealer_id, v_bill.branch_id, v_inventory.id, v_inventory.product_id, v_lot.id,
            'bill_edit', v_bill_id, -v_take, 'Additional stock consumed through bill edit'
          );

          UPDATE public.bill_item_lot_allocations
          SET unit_price = v_new_unit_price
          WHERE bill_item_id = v_bill_item.id AND lot_id = v_lot.id;

          IF NOT FOUND THEN
            INSERT INTO public.bill_item_lot_allocations (
              dealer_id, bill_id, bill_item_id, inventory_id, lot_id, product_id, quantity, unit_price
            ) VALUES (
              v_dealer_id, v_bill_id, v_bill_item.id, v_inventory.id, v_lot.id,
              v_inventory.product_id, v_take, v_new_unit_price
            );
          END IF;

          v_qty_to_process := v_qty_to_process - v_take;
        END LOOP;

        IF v_qty_to_process > 0 THEN
          RAISE EXCEPTION 'Insufficient lot stock to increase quantity for %', v_bill_item.product_name_snapshot;
        END IF;

        UPDATE public.inventory
        SET quantity_in_stock = quantity_in_stock - (v_new_qty - v_old_qty), updated_at = now()
        WHERE id = v_inventory.id;
      END IF;
    END IF;

    v_line_subtotal := ROUND(v_new_qty * v_new_unit_price, 2);
    v_line_gst := ROUND(v_line_subtotal * COALESCE(v_bill_item.gst_rate, 0) / 100, 2);

    UPDATE public.bill_items
    SET quantity = v_new_qty,
        unit_price = v_new_unit_price,
        gst_amount = v_line_gst,
        cgst_amount = ROUND(v_line_gst / 2, 2),
        sgst_amount = ROUND(v_line_gst / 2, 2),
        total_price = v_line_subtotal + v_line_gst
    WHERE id = v_bill_item.id;

    UPDATE public.bill_item_lot_allocations
    SET unit_price = v_new_unit_price
    WHERE bill_item_id = v_bill_item.id;

    v_audit_changes := v_audit_changes || jsonb_build_array(jsonb_build_object(
      'bill_item_id', v_bill_item.id,
      'product_name', v_bill_item.product_name_snapshot,
      'old_quantity', v_old_qty,
      'new_quantity', v_new_qty,
      'old_unit_price', v_bill_item.unit_price,
      'new_unit_price', v_new_unit_price
    ));
  END LOOP;

  SELECT COALESCE(SUM(quantity * unit_price), 0), COALESCE(SUM(gst_amount), 0)
  INTO v_new_subtotal, v_new_gst_amount
  FROM public.bill_items
  WHERE bill_id = v_bill_id;

  v_new_total := GREATEST(ROUND(v_new_subtotal + v_new_gst_amount - COALESCE(v_bill.discount_amount, 0), 2), 0);
  v_new_balance_due := GREATEST(v_new_total - COALESCE(v_bill.amount_paid, 0), 0);
  v_due_delta := v_new_balance_due - v_old_balance_due;

  UPDATE public.bills
  SET subtotal = v_new_subtotal,
      gst_amount = v_new_gst_amount,
      cgst_amount = ROUND(v_new_gst_amount / 2, 2),
      sgst_amount = ROUND(v_new_gst_amount / 2, 2),
      total = v_new_total,
      balance_due = v_new_balance_due,
      bill_date = COALESCE(v_bill_date, bill_date),
      is_edited = true
  WHERE id = v_bill_id;

  IF v_bill.farmer_id IS NOT NULL AND v_due_delta <> 0 THEN
    UPDATE public.farmers
    SET total_due = GREATEST(COALESCE(total_due, 0) + v_due_delta, 0)
    WHERE id = v_bill.farmer_id AND dealer_id = v_dealer_id;
  END IF;

  INSERT INTO public.bill_audit_logs (bill_id, dealer_id, user_id, changes_jsonb)
  VALUES (
    v_bill_id,
    v_dealer_id,
    v_user_id,
    jsonb_build_object(
      'items', v_audit_changes,
      'old_total', v_old_total,
      'new_total', v_new_total,
      'old_balance_due', v_old_balance_due,
      'new_balance_due', v_new_balance_due
    )
  );

  RETURN jsonb_build_object(
    'bill_id', v_bill_id,
    'bill_number', v_bill.bill_number,
    'new_total', v_new_total,
    'new_balance_due', v_new_balance_due,
    'due_delta', v_due_delta
  );
END;
$edit_bill$;

GRANT EXECUTE ON FUNCTION public.edit_bill_v1(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
