-- =============================================================================
-- STOCK TRANSFERS between branches
--
-- A dealer moves physical stock from one branch to another. We preserve FIFO
-- lot data — the transferred units keep their original cost / expiry / batch
-- number, so cost accounting stays accurate. Each source lot consumed spawns
-- a matching destination lot with the same metadata.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  from_branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  to_branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  transfer_number TEXT,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  from_branch_name TEXT,
  to_branch_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_branch_id <> to_branch_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_dealer_date ON public.stock_transfers(dealer_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from ON public.stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to   ON public.stock_transfers(to_branch_id);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_transfers_dealer_all ON public.stock_transfers;
CREATE POLICY stock_transfers_dealer_all ON public.stock_transfers
  FOR ALL USING (dealer_id = auth.uid()) WITH CHECK (dealer_id = auth.uid());
DROP POLICY IF EXISTS stock_transfers_staff_select ON public.stock_transfers;
CREATE POLICY stock_transfers_staff_select ON public.stock_transfers
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  from_lot_id UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  to_lot_id   UUID REFERENCES inventory_lots(id) ON DELETE SET NULL,
  cost_price  NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON public.stock_transfer_items(transfer_id);

ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_transfer_items_dealer_all ON public.stock_transfer_items;
CREATE POLICY stock_transfer_items_dealer_all ON public.stock_transfer_items
  FOR ALL USING (dealer_id = auth.uid()) WITH CHECK (dealer_id = auth.uid());
DROP POLICY IF EXISTS stock_transfer_items_staff_select ON public.stock_transfer_items;
CREATE POLICY stock_transfer_items_staff_select ON public.stock_transfer_items
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Transfer number generator (dealer-scoped monotonic-ish).
CREATE OR REPLACE FUNCTION public.next_transfer_number(p_dealer_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM stock_transfers WHERE dealer_id = p_dealer_id;
  RETURN 'TRF-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((v_count + 1)::text, 4, '0');
END;
$$;

-- Atomic RPC: create_stock_transfer
-- p_items: [{ product_id, quantity }]
CREATE OR REPLACE FUNCTION public.create_stock_transfer(
  p_from_branch_id UUID,
  p_to_branch_id UUID,
  p_transfer_date DATE,
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
  v_transfer_id UUID := gen_random_uuid();
  v_transfer_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_lot RECORD;
  v_from_inv_qty NUMERIC;
  v_product_name TEXT;
  v_new_lot_id UUID;
  v_total_qty NUMERIC := 0;
  v_from_branch_name TEXT;
  v_to_branch_name TEXT;
BEGIN
  v_dealer_id := COALESCE(auth.uid(), public.staff_dealer_id());
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_from_branch_id IS NULL OR p_to_branch_id IS NULL THEN
    RAISE EXCEPTION 'Both source and destination branches are required';
  END IF;
  IF p_from_branch_id = p_to_branch_id THEN
    RAISE EXCEPTION 'Source and destination branches must be different';
  END IF;

  -- Verify both branches belong to this dealer + collect their names.
  SELECT name INTO v_from_branch_name FROM branches WHERE id = p_from_branch_id AND dealer_id = v_dealer_id;
  IF v_from_branch_name IS NULL THEN RAISE EXCEPTION 'Source branch not found'; END IF;
  SELECT name INTO v_to_branch_name FROM branches WHERE id = p_to_branch_id AND dealer_id = v_dealer_id;
  IF v_to_branch_name IS NULL THEN RAISE EXCEPTION 'Destination branch not found'; END IF;

  v_transfer_number := public.next_transfer_number(v_dealer_id);

  INSERT INTO stock_transfers (id, dealer_id, from_branch_id, to_branch_id,
                                transfer_number, transfer_date, notes, total_quantity,
                                from_branch_name, to_branch_name)
  VALUES (v_transfer_id, v_dealer_id, p_from_branch_id, p_to_branch_id,
          v_transfer_number, COALESCE(p_transfer_date, CURRENT_DATE), p_notes, 0,
          v_from_branch_name, v_to_branch_name);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::NUMERIC;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each item must have product_id and quantity > 0';
    END IF;

    SELECT name INTO v_product_name FROM products WHERE id = v_product_id AND dealer_id = v_dealer_id;

    -- Enough stock at source?
    SELECT quantity_in_stock INTO v_from_inv_qty
      FROM inventory
     WHERE dealer_id = v_dealer_id
       AND branch_id = p_from_branch_id
       AND product_id = v_product_id
     FOR UPDATE;
    IF NOT FOUND OR COALESCE(v_from_inv_qty, 0) < v_qty THEN
      RAISE EXCEPTION 'Not enough stock at %: % needs %, have %',
        v_from_branch_name, COALESCE(v_product_name, 'product'), v_qty, COALESCE(v_from_inv_qty, 0);
    END IF;

    -- Walk source lots FIFO, transfer to new lots at destination.
    v_remaining := v_qty;
    FOR v_lot IN
      SELECT id, remaining_quantity, cost_price, mrp, batch_number, expiry_date,
             product_id, supplier_id, stock_purchase_id
        FROM inventory_lots
       WHERE dealer_id = v_dealer_id
         AND branch_id = p_from_branch_id
         AND product_id = v_product_id
         AND remaining_quantity > 0
       ORDER BY expiry_date NULLS LAST, received_at, created_at
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.remaining_quantity, v_remaining);

      -- Decrement the source lot.
      UPDATE inventory_lots
         SET remaining_quantity = remaining_quantity - v_take
       WHERE id = v_lot.id;

      -- Create matching destination lot (fresh id, same metadata).
      v_new_lot_id := gen_random_uuid();
      INSERT INTO inventory_lots (
        id, dealer_id, branch_id, inventory_id, product_id, supplier_id, stock_purchase_id,
        batch_number, expiry_date, quantity_received, remaining_quantity, cost_price, mrp, received_at, created_at
      )
      SELECT v_new_lot_id, v_dealer_id, p_to_branch_id, i.id, v_lot.product_id, v_lot.supplier_id, v_lot.stock_purchase_id,
             v_lot.batch_number, v_lot.expiry_date, v_take, v_take, v_lot.cost_price, v_lot.mrp, now(), now()
        FROM inventory i
       WHERE i.dealer_id = v_dealer_id
         AND i.branch_id = p_to_branch_id
         AND i.product_id = v_product_id
       LIMIT 1;

      -- Record the line item (one per source-lot consumed).
      INSERT INTO stock_transfer_items (transfer_id, dealer_id, product_id, product_name_snapshot,
                                         quantity, from_lot_id, to_lot_id, cost_price)
      VALUES (v_transfer_id, v_dealer_id, v_product_id, v_product_name,
              v_take, v_lot.id, v_new_lot_id, v_lot.cost_price);

      -- Movement log — both sides.
      INSERT INTO inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id,
                                        quantity_change, reference_type, reference_id, notes)
      SELECT v_dealer_id, p_from_branch_id, i.id, v_product_id, v_lot.id,
             -v_take, 'transfer', v_transfer_id,
             'Transfer to ' || v_to_branch_name || ' (' || v_transfer_number || ')'
        FROM inventory i WHERE i.dealer_id = v_dealer_id AND i.branch_id = p_from_branch_id AND i.product_id = v_product_id;
      INSERT INTO inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id,
                                        quantity_change, reference_type, reference_id, notes)
      SELECT v_dealer_id, p_to_branch_id, i.id, v_product_id, v_new_lot_id,
             v_take, 'transfer', v_transfer_id,
             'Transfer from ' || v_from_branch_name || ' (' || v_transfer_number || ')'
        FROM inventory i WHERE i.dealer_id = v_dealer_id AND i.branch_id = p_to_branch_id AND i.product_id = v_product_id;

      v_remaining := v_remaining - v_take;
    END LOOP;

    -- Legacy fallback: product with zero lots — just adjust inventory quantities.
    IF v_remaining > 0 THEN
      INSERT INTO stock_transfer_items (transfer_id, dealer_id, product_id, product_name_snapshot, quantity)
      VALUES (v_transfer_id, v_dealer_id, v_product_id, v_product_name, v_remaining);
      -- (no lots to update; the aggregate inventory update below handles the qty)
    END IF;

    -- Aggregate inventory row deltas.
    UPDATE inventory SET quantity_in_stock = quantity_in_stock - v_qty, updated_at = now()
     WHERE dealer_id = v_dealer_id AND branch_id = p_from_branch_id AND product_id = v_product_id;
    UPDATE inventory SET quantity_in_stock = quantity_in_stock + v_qty, updated_at = now()
     WHERE dealer_id = v_dealer_id AND branch_id = p_to_branch_id AND product_id = v_product_id;

    v_total_qty := v_total_qty + v_qty;
  END LOOP;

  UPDATE stock_transfers SET total_quantity = v_total_qty WHERE id = v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_number', v_transfer_number,
    'total_quantity', v_total_qty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_transfer(UUID, UUID, DATE, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer(UUID, UUID, DATE, TEXT, JSONB) TO authenticated;

-- List RPC (per-branch filterable; NULL branch = all)
CREATE OR REPLACE FUNCTION public.list_stock_transfers(
  p_branch_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_data JSONB;
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM stock_transfers
   WHERE dealer_id = v_dealer_id
     AND (p_branch_id IS NULL OR from_branch_id = p_branch_id OR to_branch_id = p_branch_id);

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.transfer_date DESC, t.created_at DESC), '[]'::jsonb)
    INTO v_data
    FROM (
      SELECT id, transfer_number, transfer_date, from_branch_id, to_branch_id,
             from_branch_name, to_branch_name, total_quantity, notes, created_at
        FROM stock_transfers
       WHERE dealer_id = v_dealer_id
         AND (p_branch_id IS NULL OR from_branch_id = p_branch_id OR to_branch_id = p_branch_id)
       ORDER BY transfer_date DESC, created_at DESC
       LIMIT p_limit OFFSET p_offset
    ) t;

  RETURN jsonb_build_object('total', v_total, 'data', v_data);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_stock_transfers(UUID, INT, INT) TO authenticated;

-- Detail RPC
CREATE OR REPLACE FUNCTION public.get_stock_transfer(p_transfer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_header JSONB;
  v_items JSONB;
BEGIN
  SELECT row_to_json(t) INTO v_header FROM (
    SELECT * FROM stock_transfers WHERE id = p_transfer_id AND dealer_id = v_dealer_id
  ) t;
  IF v_header IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(i) ORDER BY i.created_at ASC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT id, product_id, product_name_snapshot, quantity, cost_price, from_lot_id, to_lot_id, created_at
        FROM stock_transfer_items WHERE transfer_id = p_transfer_id
    ) i;

  RETURN v_header::jsonb || jsonb_build_object('items', v_items);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_stock_transfer(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
