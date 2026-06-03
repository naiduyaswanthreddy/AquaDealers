-- =============================================================================
-- AquaDealer Foundation & Transactional Workflows
-- Migration 006: Align onboarding, add dealer-grade ledgers, and move core
-- write flows into transactional RPCs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. ALIGN ONBOARDING + EXTEND CORE TABLES
-- =============================================================================

ALTER TABLE onboarding_progress
  ADD COLUMN IF NOT EXISTS step_5_set_pin_at TIMESTAMPTZ;

UPDATE onboarding_progress
SET step_5_set_pin_at = COALESCE(step_5_set_pin_at, step_5_first_bill_at)
WHERE step_5_first_bill_at IS NOT NULL
  AND step_5_set_pin_at IS NULL;

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS estimated_harvest_date DATE,
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS credit_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12,2) DEFAULT 0;

ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS inventory_id_snapshot UUID;

ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_override_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_override_reason TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS allocation_mode TEXT DEFAULT 'general_account',
  ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- =============================================================================
-- 2. SUPPORTING LEDGER TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS inventory_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  stock_purchase_id UUID REFERENCES stock_purchases(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_number TEXT,
  expiry_date DATE,
  quantity_received NUMERIC(10,2) NOT NULL,
  remaining_quantity NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lots_dealer_product
  ON inventory_lots(dealer_id, product_id, expiry_date, received_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID,
  quantity_change NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_dealer_inventory
  ON inventory_movements(dealer_id, inventory_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  allocated_amount NUMERIC(12,2) NOT NULL,
  allocation_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment
  ON payment_allocations(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_bill
  ON payment_allocations(bill_id);

CREATE TABLE IF NOT EXISTS cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  expected_cash NUMERIC(12,2) NOT NULL,
  physical_cash NUMERIC(12,2) NOT NULL,
  variance NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dealer_id, branch_id, closing_date)
);

CREATE INDEX IF NOT EXISTS idx_cash_closings_dealer_date
  ON cash_closings(dealer_id, closing_date DESC);

-- =============================================================================
-- 3. RLS FOR NEW TABLES
-- =============================================================================

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_lots_select ON inventory_lots;
DROP POLICY IF EXISTS inventory_lots_insert ON inventory_lots;
DROP POLICY IF EXISTS inventory_lots_update ON inventory_lots;
DROP POLICY IF EXISTS inventory_lots_delete ON inventory_lots;
CREATE POLICY inventory_lots_select ON inventory_lots FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY inventory_lots_insert ON inventory_lots FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY inventory_lots_update ON inventory_lots FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY inventory_lots_delete ON inventory_lots FOR DELETE USING (dealer_id = auth.uid());

DROP POLICY IF EXISTS inventory_movements_select ON inventory_movements;
DROP POLICY IF EXISTS inventory_movements_insert ON inventory_movements;
DROP POLICY IF EXISTS inventory_movements_update ON inventory_movements;
DROP POLICY IF EXISTS inventory_movements_delete ON inventory_movements;
CREATE POLICY inventory_movements_select ON inventory_movements FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY inventory_movements_insert ON inventory_movements FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY inventory_movements_update ON inventory_movements FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY inventory_movements_delete ON inventory_movements FOR DELETE USING (dealer_id = auth.uid());

DROP POLICY IF EXISTS payment_allocations_select ON payment_allocations;
DROP POLICY IF EXISTS payment_allocations_insert ON payment_allocations;
DROP POLICY IF EXISTS payment_allocations_update ON payment_allocations;
DROP POLICY IF EXISTS payment_allocations_delete ON payment_allocations;
CREATE POLICY payment_allocations_select ON payment_allocations FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY payment_allocations_insert ON payment_allocations FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY payment_allocations_update ON payment_allocations FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY payment_allocations_delete ON payment_allocations FOR DELETE USING (dealer_id = auth.uid());

DROP POLICY IF EXISTS cash_closings_select ON cash_closings;
DROP POLICY IF EXISTS cash_closings_insert ON cash_closings;
DROP POLICY IF EXISTS cash_closings_update ON cash_closings;
DROP POLICY IF EXISTS cash_closings_delete ON cash_closings;
CREATE POLICY cash_closings_select ON cash_closings FOR SELECT USING (dealer_id = auth.uid());
CREATE POLICY cash_closings_insert ON cash_closings FOR INSERT WITH CHECK (dealer_id = auth.uid());
CREATE POLICY cash_closings_update ON cash_closings FOR UPDATE USING (dealer_id = auth.uid());
CREATE POLICY cash_closings_delete ON cash_closings FOR DELETE USING (dealer_id = auth.uid());

-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_receipt_number(prefix TEXT)
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT upper(prefix) || '-' ||
         to_char(current_date, 'YYYYMMDD') || '-' ||
         substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
$$;

CREATE OR REPLACE FUNCTION public.assert_dealer_access(p_dealer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_dealer_id THEN
    RAISE EXCEPTION 'Dealer access denied';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_inventory_lots(
  p_dealer_id UUID,
  p_inventory_id UUID,
  p_product_id UUID,
  p_reference_id UUID,
  p_quantity NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_quantity;
  v_lot RECORD;
  v_consumed NUMERIC;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  FOR v_lot IN
    SELECT id, remaining_quantity
    FROM inventory_lots
    WHERE dealer_id = p_dealer_id
      AND inventory_id = p_inventory_id
      AND remaining_quantity > 0
    ORDER BY expiry_date NULLS LAST, received_at, created_at
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_consumed := LEAST(v_lot.remaining_quantity, v_remaining);

    UPDATE inventory_lots
    SET remaining_quantity = remaining_quantity - v_consumed
    WHERE id = v_lot.id;

    INSERT INTO inventory_movements (
      dealer_id,
      inventory_id,
      product_id,
      lot_id,
      reference_type,
      reference_id,
      quantity_change,
      notes
    ) VALUES (
      p_dealer_id,
      p_inventory_id,
      p_product_id,
      v_lot.id,
      'bill',
      p_reference_id,
      -v_consumed,
      'Consumed through bill'
    );

    v_remaining := v_remaining - v_consumed;
  END LOOP;

  IF v_remaining > 0 THEN
    INSERT INTO inventory_movements (
      dealer_id,
      inventory_id,
      product_id,
      reference_type,
      reference_id,
      quantity_change,
      notes
    ) VALUES (
      p_dealer_id,
      p_inventory_id,
      p_product_id,
      'bill',
      p_reference_id,
      -v_remaining,
      'Consumed from legacy stock without tracked lot'
    );
  END IF;
END;
$$;

-- =============================================================================
-- 5. TRANSACTIONAL RPCS
-- =============================================================================

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

CREATE OR REPLACE FUNCTION public.collect_farmer_payment_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_branch_id UUID := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_farmer_id UUID := (p_payload->>'farmer_id')::UUID;
  v_target_bill_id UUID := NULLIF(p_payload->>'target_bill_id', '')::UUID;
  v_amount NUMERIC(12,2) := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_remaining NUMERIC(12,2);
  v_payment_id UUID;
  v_receipt_number TEXT;
  v_bill RECORD;
  v_allocation NUMERIC(12,2);
  v_order INT := 0;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_receipt_number := public.generate_receipt_number('RCPT');

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
    v_farmer_id,
    v_target_bill_id,
    v_amount,
    COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE),
    NULLIF(p_payload->>'method', ''),
    NULLIF(p_payload->>'upi_ref', ''),
    NULLIF(p_payload->>'cheque_no', ''),
    NULLIF(p_payload->>'notes', ''),
    COALESCE(NULLIF(p_payload->>'allocation_mode', ''), CASE WHEN v_target_bill_id IS NULL THEN 'oldest_first' ELSE 'specific_bill' END),
    v_receipt_number
  )
  RETURNING id INTO v_payment_id;

  v_remaining := v_amount;

  FOR v_bill IN
    SELECT id, balance_due
    FROM bills
    WHERE dealer_id = v_dealer_id
      AND farmer_id = v_farmer_id
      AND status = 'active'
      AND balance_due > 0
      AND (v_target_bill_id IS NULL OR id = v_target_bill_id)
    ORDER BY
      CASE WHEN id = v_target_bill_id THEN 0 ELSE 1 END,
      bill_date,
      created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_allocation := LEAST(v_bill.balance_due, v_remaining);
    v_order := v_order + 1;

    UPDATE bills
    SET balance_due = balance_due - v_allocation
    WHERE id = v_bill.id;

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
      v_bill.id,
      v_farmer_id,
      v_allocation,
      v_order
    );

    v_remaining := v_remaining - v_allocation;
  END LOOP;

  IF v_target_bill_id IS NOT NULL AND v_remaining > 0 THEN
    RAISE EXCEPTION 'Payment exceeds balance due for the selected bill';
  END IF;

  UPDATE farmers
  SET total_due = GREATEST(COALESCE(total_due, 0) - (v_amount - v_remaining), 0)
  WHERE id = v_farmer_id
    AND dealer_id = v_dealer_id;

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
    'farmer_payment',
    v_payment_id,
    v_amount - v_remaining,
    'Farmer payment receipt ' || v_receipt_number,
    COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE)
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'receipt_number', v_receipt_number,
    'allocated_amount', v_amount - v_remaining,
    'unallocated_amount', v_remaining
  );
END;
$$;

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
  v_purchase_id UUID;
  v_inventory_id UUID;
  v_lot_id UUID;
  v_quantity NUMERIC(10,2) := COALESCE((p_payload->>'quantity')::NUMERIC, 0);
  v_cost NUMERIC(10,2) := COALESCE((p_payload->>'cost_price_per_unit')::NUMERIC, 0);
  v_total NUMERIC(12,2) := COALESCE((p_payload->>'total_amount')::NUMERIC, 0);
  v_selling_price NUMERIC(10,2) := NULLIF(p_payload->>'selling_price', '')::NUMERIC;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

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
  ) VALUES (
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

CREATE OR REPLACE FUNCTION public.record_supplier_payment_v2(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_supplier_id UUID := (p_payload->>'supplier_id')::UUID;
  v_purchase_id UUID := NULLIF(p_payload->>'purchase_id', '')::UUID;
  v_amount NUMERIC(12,2) := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_payment_id UUID;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Supplier payment amount must be greater than zero';
  END IF;

  INSERT INTO supplier_payments (
    dealer_id,
    supplier_id,
    purchase_id,
    amount,
    payment_date,
    method,
    notes
  ) VALUES (
    v_dealer_id,
    v_supplier_id,
    v_purchase_id,
    v_amount,
    COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE),
    NULLIF(p_payload->>'method', ''),
    NULLIF(p_payload->>'notes', '')
  )
  RETURNING id INTO v_payment_id;

  UPDATE suppliers
  SET total_due = GREATEST(COALESCE(total_due, 0) - v_amount, 0)
  WHERE id = v_supplier_id
    AND dealer_id = v_dealer_id;

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
    NULLIF(p_payload->>'branch_id', '')::UUID,
    'expense',
    'supplier_payment',
    v_payment_id,
    v_amount,
    'Supplier payment recorded',
    COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE)
  );

  RETURN jsonb_build_object(
    'supplier_payment_id', v_payment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_bill_v1(p_bill_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill RECORD;
  v_item RECORD;
BEGIN
  SELECT *
  INTO v_bill
  FROM bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  PERFORM public.assert_dealer_access(v_bill.dealer_id);

  IF v_bill.status = 'cancelled' THEN
    RETURN jsonb_build_object('bill_id', p_bill_id, 'status', 'already_cancelled');
  END IF;

  IF v_bill.bill_date <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Only same-day bills can be cancelled';
  END IF;

  IF COALESCE(v_bill.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Paid bills cannot be cancelled with v1';
  END IF;

  FOR v_item IN
    SELECT inventory_id_snapshot, product_id, quantity
    FROM bill_items
    WHERE bill_id = p_bill_id
  LOOP
    IF v_item.inventory_id_snapshot IS NOT NULL THEN
      UPDATE inventory
      SET quantity_in_stock = quantity_in_stock + v_item.quantity,
          updated_at = now()
      WHERE id = v_item.inventory_id_snapshot;

      INSERT INTO inventory_movements (
        dealer_id,
        branch_id,
        inventory_id,
        product_id,
        reference_type,
        reference_id,
        quantity_change,
        notes
      ) VALUES (
        v_bill.dealer_id,
        v_bill.branch_id,
        v_item.inventory_id_snapshot,
        v_item.product_id,
        'bill_cancellation',
        p_bill_id,
        v_item.quantity,
        'Restored through bill cancellation'
      );
    END IF;
  END LOOP;

  IF v_bill.farmer_id IS NOT NULL AND COALESCE(v_bill.balance_due, 0) > 0 THEN
    UPDATE farmers
    SET total_due = GREATEST(COALESCE(total_due, 0) - v_bill.balance_due, 0)
    WHERE id = v_bill.farmer_id;
  END IF;

  UPDATE bills
  SET status = 'cancelled',
      balance_due = 0,
      cancelled_at = now(),
      cancelled_reason = p_reason
  WHERE id = p_bill_id;

  RETURN jsonb_build_object('bill_id', p_bill_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.close_cash_day_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_branch_id UUID := NULLIF(p_payload->>'branch_id', '')::UUID;
  v_closing_date DATE := COALESCE(NULLIF(p_payload->>'closing_date', '')::DATE, CURRENT_DATE);
  v_expected NUMERIC(12,2);
  v_physical NUMERIC(12,2) := COALESCE((p_payload->>'physical_cash')::NUMERIC, 0);
  v_closing_id UUID;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  SELECT COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END), 0)
  INTO v_expected
  FROM cash_book
  WHERE dealer_id = v_dealer_id
    AND ((v_branch_id IS NULL AND branch_id IS NULL) OR branch_id = v_branch_id)
    AND entry_date <= v_closing_date;

  INSERT INTO cash_closings (
    dealer_id,
    branch_id,
    closing_date,
    expected_cash,
    physical_cash,
    variance,
    notes
  ) VALUES (
    v_dealer_id,
    v_branch_id,
    v_closing_date,
    v_expected,
    v_physical,
    v_physical - v_expected,
    NULLIF(p_payload->>'notes', '')
  )
  ON CONFLICT (dealer_id, branch_id, closing_date)
  DO UPDATE SET
    expected_cash = EXCLUDED.expected_cash,
    physical_cash = EXCLUDED.physical_cash,
    variance = EXCLUDED.variance,
    notes = EXCLUDED.notes
  RETURNING id INTO v_closing_id;

  RETURN jsonb_build_object(
    'closing_id', v_closing_id,
    'expected_cash', v_expected,
    'physical_cash', v_physical,
    'variance', v_physical - v_expected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_farmer_payment_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_purchase_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bill_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_day_v1(JSONB) TO authenticated;
