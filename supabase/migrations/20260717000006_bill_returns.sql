-- =============================================================================
-- BILL RETURNS
-- A farmer returns some or all items from a bill. We:
--   1. Record the return header + line items.
--   2. Restock the ORIGINAL FIFO lots the items were consumed from
--      (using bill_item_lot_allocations). If a lot is gone, fall back to the
--      inventory row's quantity_in_stock — the lot mapping is best-effort.
--   3. Reduce bill.balance_due by the return value (and clamp at 0). If the
--      return value exceeds the bill's remaining balance, the excess becomes
--      farmer credit — farmer.total_due can go negative (existing app already
--      renders negatives correctly via Intl.NumberFormat).
--   4. Log inventory_movement rows so the stock trail is complete.
--   5. Update farmer.total_due to the sum of all their bills' balance_due
--      (matches how other flows keep it in sync).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bill_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  farmer_id UUID REFERENCES farmers(id),
  return_number TEXT,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  branch_name_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_returns_dealer_date ON public.bill_returns(dealer_id, return_date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_returns_bill    ON public.bill_returns(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_returns_farmer  ON public.bill_returns(farmer_id);

ALTER TABLE public.bill_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bill_returns_dealer_all ON public.bill_returns;
CREATE POLICY bill_returns_dealer_all ON public.bill_returns
  FOR ALL USING (dealer_id = auth.uid()) WITH CHECK (dealer_id = auth.uid());
DROP POLICY IF EXISTS bill_returns_staff_select ON public.bill_returns;
CREATE POLICY bill_returns_staff_select ON public.bill_returns
  FOR SELECT USING (dealer_id = public.staff_dealer_id());
DROP POLICY IF EXISTS bill_returns_staff_insert ON public.bill_returns;
CREATE POLICY bill_returns_staff_insert ON public.bill_returns
  FOR INSERT WITH CHECK (dealer_id = public.staff_dealer_id() AND public.staff_can_access_branch(branch_id));

-- Snapshot branch name on insert (reuse the shared helper from previous migration).
DROP TRIGGER IF EXISTS trg_bill_returns_snapshot_branch ON public.bill_returns;
CREATE TRIGGER trg_bill_returns_snapshot_branch
BEFORE INSERT ON public.bill_returns
FOR EACH ROW EXECUTE FUNCTION public.snapshot_branch_name_on_write();

CREATE TABLE IF NOT EXISTS public.bill_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES bill_returns(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  bill_item_id UUID REFERENCES bill_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  product_name_snapshot TEXT,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_return ON public.bill_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_items_bill_item ON public.bill_return_items(bill_item_id);

ALTER TABLE public.bill_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bill_return_items_dealer_all ON public.bill_return_items;
CREATE POLICY bill_return_items_dealer_all ON public.bill_return_items
  FOR ALL USING (dealer_id = auth.uid()) WITH CHECK (dealer_id = auth.uid());
DROP POLICY IF EXISTS bill_return_items_staff_select ON public.bill_return_items;
CREATE POLICY bill_return_items_staff_select ON public.bill_return_items
  FOR SELECT USING (dealer_id = public.staff_dealer_id());
DROP POLICY IF EXISTS bill_return_items_staff_insert ON public.bill_return_items;
CREATE POLICY bill_return_items_staff_insert ON public.bill_return_items
  FOR INSERT WITH CHECK (dealer_id = public.staff_dealer_id());

-- Simple return-number generator (dealer-scoped monotonic-ish based on count).
CREATE OR REPLACE FUNCTION public.next_return_number(p_dealer_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bill_returns WHERE dealer_id = p_dealer_id;
  RETURN 'RET-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((v_count + 1)::text, 4, '0');
END;
$$;

-- =============================================================================
-- create_bill_return: atomic RPC. Input:
--   p_bill_id UUID
--   p_return_date DATE
--   p_notes TEXT
--   p_items JSONB  -- [{ bill_item_id, quantity, unit_price? }]
-- Returns: JSONB with the created return + updated bill balance + new farmer due.
-- =============================================================================
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
    SELECT COALESCE(SUM(balance_due), 0)
      INTO v_new_farmer_due
      FROM bills
     WHERE farmer_id = v_bill.farmer_id
       AND dealer_id = v_dealer_id
       AND deleted_at IS NULL
       AND status <> 'cancelled';
    UPDATE farmers SET total_due = v_new_farmer_due WHERE id = v_bill.farmer_id;
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

REVOKE ALL ON FUNCTION public.create_bill_return(UUID, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_bill_return(UUID, DATE, TEXT, JSONB) TO authenticated;

-- Fetch returns for a bill (list on bill detail).
CREATE OR REPLACE FUNCTION public.get_returns_for_bill(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_data JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT r.id, r.return_number, r.return_date, r.total_amount, r.notes,
             r.created_at, r.branch_name_snapshot AS branch_name,
             (SELECT COALESCE(jsonb_agg(row_to_json(i) ORDER BY i.created_at ASC), '[]'::jsonb)
                FROM (SELECT id, product_name_snapshot AS product_name, quantity, unit_price, total_price, created_at
                        FROM bill_return_items WHERE return_id = r.id) i) AS items
        FROM bill_returns r
       WHERE r.bill_id = p_bill_id
         AND r.dealer_id = v_dealer_id
    ) r;
  RETURN v_data;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_returns_for_bill(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
