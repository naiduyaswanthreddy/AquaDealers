-- Keep inventory lot and purchase movement dates aligned with the selected purchase date.
-- Older rows may have received_at/created_at from the day the record was entered.

UPDATE inventory_lots il
SET received_at = sp.purchase_date::TIMESTAMPTZ
FROM stock_purchases sp
WHERE il.stock_purchase_id = sp.id
  AND sp.purchase_date IS NOT NULL
  AND il.received_at::DATE <> sp.purchase_date;

UPDATE inventory_movements im
SET created_at = sp.purchase_date::TIMESTAMPTZ
FROM stock_purchases sp
WHERE im.reference_type = 'purchase'
  AND im.reference_id = sp.id
  AND sp.purchase_date IS NOT NULL
  AND im.created_at::DATE <> sp.purchase_date;

CREATE OR REPLACE FUNCTION public.record_stock_purchase_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_stock_purchase_fifo$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_branch_id UUID := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_product_id UUID := (p_payload->>'product_id')::UUID;
  v_supplier_id UUID := NULLIF(p_payload->>'supplier_id', '')::UUID;
  v_quantity NUMERIC := (p_payload->>'quantity')::NUMERIC;
  v_cost NUMERIC := (p_payload->>'cost_price_per_unit')::NUMERIC;
  v_mrp NUMERIC := NULLIF(p_payload->>'mrp', '')::NUMERIC;
  v_gst NUMERIC := COALESCE((p_payload->>'gst_amount')::NUMERIC, 0);
  v_total NUMERIC := COALESCE((p_payload->>'total_amount')::NUMERIC, v_quantity * v_cost + v_gst);
  v_purchase_date DATE := COALESCE(NULLIF(p_payload->>'purchase_date', '')::DATE, CURRENT_DATE);
  v_purchase_at TIMESTAMPTZ := COALESCE(NULLIF(p_payload->>'purchase_date', '')::DATE, CURRENT_DATE)::TIMESTAMPTZ;
  v_inventory_id UUID;
  v_purchase_id UUID;
  v_lot_id UUID;
  v_current_selling_price NUMERIC;
  v_medicine_discount_percentage NUMERIC := COALESCE(NULLIF(p_payload->>'medicine_discount_percentage', '')::NUMERIC, 0);
  v_new_selling_price NUMERIC := COALESCE(NULLIF(p_payload->>'selling_price', '')::NUMERIC, v_cost);
  v_new_final_price NUMERIC := v_new_selling_price * (1 - v_medicine_discount_percentage / 100);
BEGIN
  IF v_dealer_id IS NULL OR v_product_id IS NULL THEN
    RAISE EXCEPTION 'dealer_id and product_id are required';
  END IF;

  SELECT id, selling_price
  INTO v_inventory_id, v_current_selling_price
  FROM inventory
  WHERE dealer_id = v_dealer_id
    AND product_id = v_product_id
    AND (v_branch_id IS NULL OR branch_id = v_branch_id)
  ORDER BY created_at ASC
  LIMIT 1;

  INSERT INTO stock_purchases (
    dealer_id, branch_id, product_id, supplier_id, quantity, cost_price_per_unit, mrp,
    gst_amount, total_amount, purchase_date, invoice_number, batch_number, expiry_date, is_paid, notes
  ) VALUES (
    v_dealer_id, v_branch_id, v_product_id, v_supplier_id, v_quantity, v_cost, v_mrp,
    v_gst, v_total, v_purchase_date,
    NULLIF(p_payload->>'invoice_number', ''), NULLIF(p_payload->>'batch_number', ''),
    NULLIF(p_payload->>'expiry_date', '')::DATE, COALESCE((p_payload->>'is_paid')::BOOLEAN, true),
    NULLIF(p_payload->>'notes', '')
  )
  RETURNING id INTO v_purchase_id;

  IF v_inventory_id IS NULL THEN
    INSERT INTO inventory (
      dealer_id, branch_id, product_id, quantity_in_stock, cost_price, mrp, selling_price,
      medicine_discount_percentage, batch_number, expiry_date, updated_at
    ) VALUES (
      v_dealer_id, v_branch_id, v_product_id, v_quantity, v_cost, v_mrp, v_new_selling_price,
      v_medicine_discount_percentage, NULLIF(p_payload->>'batch_number', ''),
      NULLIF(p_payload->>'expiry_date', '')::DATE, now()
    )
    RETURNING id INTO v_inventory_id;
  ELSE
    UPDATE inventory
    SET quantity_in_stock = quantity_in_stock + v_quantity,
        cost_price = v_cost,
        mrp = COALESCE(v_mrp, mrp),
        selling_price = v_new_selling_price,
        medicine_discount_percentage = v_medicine_discount_percentage,
        batch_number = COALESCE(NULLIF(p_payload->>'batch_number', ''), batch_number),
        expiry_date = COALESCE(NULLIF(p_payload->>'expiry_date', '')::DATE, expiry_date),
        updated_at = now()
    WHERE id = v_inventory_id;
  END IF;

  INSERT INTO inventory_lots (
    dealer_id, branch_id, inventory_id, stock_purchase_id, product_id, supplier_id,
    batch_number, expiry_date, quantity_received, remaining_quantity, cost_price,
    selling_price, medicine_discount_percentage, final_unit_price, mrp, received_at
  ) VALUES (
    v_dealer_id, v_branch_id, v_inventory_id, v_purchase_id, v_product_id, v_supplier_id,
    NULLIF(p_payload->>'batch_number', ''), NULLIF(p_payload->>'expiry_date', '')::DATE,
    v_quantity, v_quantity, v_cost, v_new_selling_price, v_medicine_discount_percentage,
    v_new_final_price, v_mrp, v_purchase_at
  )
  RETURNING id INTO v_lot_id;

  INSERT INTO inventory_movements (
    dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes, created_at
  ) VALUES (
    v_dealer_id, v_branch_id, v_inventory_id, v_product_id, v_lot_id, 'purchase', v_purchase_id, v_quantity,
    'Stock purchase received', v_purchase_at
  );

  IF COALESCE((p_payload->>'is_paid')::BOOLEAN, true) THEN
    IF COALESCE(p_payload->>'payment_method', 'cash') = 'cash' THEN
      INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
      VALUES (
        v_dealer_id, v_branch_id, 'expense', 'stock_purchase', v_purchase_id, v_total, 'Paid stock purchase',
        v_purchase_date
      );
    END IF;
  ELSIF v_supplier_id IS NOT NULL THEN
    UPDATE suppliers
    SET total_due = COALESCE(total_due, 0) + v_total
    WHERE id = v_supplier_id
      AND dealer_id = v_dealer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'inventory_id', v_inventory_id,
    'lot_id', v_lot_id,
    'total_amount', v_total
  );
END;
$record_stock_purchase_fifo$;

GRANT EXECUTE ON FUNCTION public.record_stock_purchase_v2(JSONB) TO authenticated;
