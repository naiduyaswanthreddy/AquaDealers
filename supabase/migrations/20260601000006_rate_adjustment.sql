-- Migration: 20260601000006_rate_adjustment.sql

-- 1. Add `type` column to bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS type text default 'sale';

-- 2. Update create_bill_v3 to handle 'adjustment' type (skip inventory deduction)
CREATE OR REPLACE FUNCTION public.create_bill_v3(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_bill_number TEXT;
  v_item JSONB;
  v_inventory RECORD;
  v_farmer_due_add NUMERIC(12,2);
  v_balance_due NUMERIC(12,2);
  v_subtotal NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_amount_paid NUMERIC(12,2);
  v_dealer_id UUID;
  v_branch_id UUID;
  v_type TEXT;
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
  v_type := COALESCE(NULLIF(p_payload->>'type', ''), 'sale');

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
    type
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
    v_type
  )
  RETURNING id INTO v_bill_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb))
  LOOP
    IF v_type = 'sale' THEN
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
      NULLIF(v_item->>'inventory_id', '')::UUID
    );

    IF v_type = 'sale' THEN
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
    );
  END IF;

  RETURN jsonb_build_object('bill_id', v_bill_id);
END;
$$;

-- 3. Create RPC to fetch targets for Rate Adjustment
CREATE OR REPLACE FUNCTION public.get_rate_adjustment_targets(
  p_dealer_id UUID,
  p_product_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  farmer_id UUID,
  farmer_name TEXT,
  farmer_phone TEXT,
  total_quantity NUMERIC,
  avg_unit_price NUMERIC,
  bill_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    b.farmer_id,
    f.name as farmer_name,
    f.phone as farmer_phone,
    SUM(bi.quantity) as total_quantity,
    SUM(bi.total_price) / NULLIF(SUM(bi.quantity), 0) as avg_unit_price,
    COUNT(DISTINCT b.id) as bill_count
  FROM bills b
  JOIN bill_items bi ON b.id = bi.bill_id
  JOIN farmers f ON b.farmer_id = f.id
  WHERE b.dealer_id = p_dealer_id
    AND b.status = 'active'
    AND COALESCE(b.type, 'sale') = 'sale'
    AND bi.product_id = p_product_id
    AND b.bill_date >= p_start_date
    AND b.bill_date <= p_end_date
  GROUP BY b.farmer_id, f.name, f.phone
  HAVING SUM(bi.quantity) > 0
  ORDER BY f.name;
$$;
