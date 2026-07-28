-- Farmer-first, multi-bill returns. All pricing and bill allocation decisions
-- are made on the server so the review screen and confirmed transaction agree.

ALTER TABLE public.bill_returns ALTER COLUMN bill_id DROP NOT NULL;
ALTER TABLE public.bill_returns
  ADD COLUMN IF NOT EXISTS source_bill_start_date DATE,
  ADD COLUMN IF NOT EXISTS source_bill_end_date DATE,
  ADD COLUMN IF NOT EXISTS opening_balance_reduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_method TEXT;

ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS return_credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.farmer_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.bill_returns(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name_snapshot TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unmatched_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  unmatched_unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bill_return_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.bill_returns(id) ON DELETE CASCADE,
  return_line_id UUID NOT NULL REFERENCES public.farmer_return_lines(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE RESTRICT,
  bill_item_id UUID NOT NULL REFERENCES public.bill_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  balance_reduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  settlement_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_return_allocations_bill_item ON public.bill_return_allocations(bill_item_id);
CREATE INDEX IF NOT EXISTS idx_bill_return_allocations_return ON public.bill_return_allocations(return_id);
CREATE INDEX IF NOT EXISTS idx_bills_farmer_active_date ON public.bills(dealer_id, farmer_id, bill_date DESC, created_at DESC) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bill_items_product_bill ON public.bill_items(product_id, bill_id);

ALTER TABLE public.farmer_return_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_return_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY farmer_return_lines_dealer_all ON public.farmer_return_lines FOR ALL USING (dealer_id = COALESCE(auth.uid(), public.staff_dealer_id())) WITH CHECK (dealer_id = COALESCE(auth.uid(), public.staff_dealer_id()));
CREATE POLICY bill_return_allocations_dealer_all ON public.bill_return_allocations FOR ALL USING (dealer_id = COALESCE(auth.uid(), public.staff_dealer_id())) WITH CHECK (dealer_id = COALESCE(auth.uid(), public.staff_dealer_id()));

CREATE OR REPLACE FUNCTION public.preview_farmer_return_v1(
  p_farmer_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_farmer public.farmers%ROWTYPE;
  v_input JSONB;
  v_bill_item RECORD;
  v_requested NUMERIC;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_unmatched_price NUMERIC;
  v_line_total NUMERIC;
  v_matched_total NUMERIC;
  v_unmatched_total NUMERIC := 0;
  v_settlement_total NUMERIC := 0;
  v_opening_reduction NUMERIC;
  v_allocations JSONB := '[]'::JSONB;
  v_lines JSONB := '[]'::JSONB;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN RAISE EXCEPTION 'Choose a valid bill date range'; END IF;
  SELECT * INTO v_farmer FROM public.farmers WHERE id = p_farmer_id AND dealer_id = v_dealer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one return item'; END IF;

  FOR v_input IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_requested := ROUND(COALESCE((v_input->>'quantity')::NUMERIC, 0), 2);
    v_unmatched_price := ROUND(COALESCE((v_input->>'unmatched_unit_price')::NUMERIC, 0), 2);
    IF v_requested <= 0 OR v_unmatched_price < 0 OR NULLIF(v_input->>'product_id', '') IS NULL THEN RAISE EXCEPTION 'Each return item needs a product, quantity, and valid price'; END IF;
    v_remaining := v_requested;
    v_matched_total := 0;
    v_allocations := '[]'::JSONB;
    FOR v_bill_item IN
      SELECT bi.id, bi.quantity, bi.unit_price, b.id AS bill_id, b.bill_number, b.bill_date,
             b.balance_due, COALESCE(b.branch_name_snapshot, br.name) AS branch_name,
             GREATEST(0, bi.quantity - COALESCE((SELECT SUM(quantity) FROM public.bill_return_items bri WHERE bri.bill_item_id = bi.id), 0) - COALESCE((SELECT SUM(quantity) FROM public.bill_return_allocations bra WHERE bra.bill_item_id = bi.id), 0)) AS available_quantity
      FROM public.bill_items bi
      JOIN public.bills b ON b.id = bi.bill_id
      LEFT JOIN public.branches br ON br.id = b.branch_id
      WHERE b.dealer_id = v_dealer_id AND b.farmer_id = p_farmer_id
        AND b.status = 'active' AND b.deleted_at IS NULL
        AND b.bill_date BETWEEN p_start_date AND p_end_date
        AND bi.product_id = (v_input->>'product_id')::UUID
      ORDER BY b.bill_date DESC, b.created_at DESC, bi.id DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_bill_item.available_quantity);
      IF v_take <= 0 THEN CONTINUE; END IF;
      v_line_total := ROUND(v_take * v_bill_item.unit_price, 2);
      v_matched_total := v_matched_total + v_line_total;
      v_settlement_total := v_settlement_total + GREATEST(0, v_line_total - LEAST(v_line_total, v_bill_item.balance_due));
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('bill_id', v_bill_item.bill_id, 'bill_item_id', v_bill_item.id, 'bill_number', v_bill_item.bill_number, 'bill_date', v_bill_item.bill_date, 'branch_name', v_bill_item.branch_name, 'quantity', v_take, 'unit_price', v_bill_item.unit_price, 'total_amount', v_line_total, 'balance_before', v_bill_item.balance_due, 'balance_reduction', LEAST(v_line_total, v_bill_item.balance_due), 'balance_after', GREATEST(0, v_bill_item.balance_due - v_line_total), 'settlement_amount', GREATEST(0, v_line_total - v_bill_item.balance_due)));
      v_remaining := v_remaining - v_take;
    END LOOP;
    v_line_total := ROUND(v_matched_total + (v_remaining * v_unmatched_price), 2);
    v_unmatched_total := v_unmatched_total + ROUND(v_remaining * v_unmatched_price, 2);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('product_id', v_input->>'product_id', 'product_name', COALESCE((SELECT name FROM public.products WHERE id = (v_input->>'product_id')::UUID), 'Product'), 'quantity', v_requested, 'matched_quantity', v_requested - v_remaining, 'unmatched_quantity', v_remaining, 'unmatched_unit_price', v_unmatched_price, 'total_amount', v_line_total, 'allocations', v_allocations));
  END LOOP;
  v_opening_reduction := LEAST(GREATEST(COALESCE(v_farmer.opening_balance, 0), 0), v_unmatched_total);
  v_settlement_total := ROUND(v_settlement_total + v_unmatched_total - v_opening_reduction, 2);
  RETURN jsonb_build_object('farmer_id', v_farmer.id, 'farmer_name', v_farmer.name, 'start_date', p_start_date, 'end_date', p_end_date, 'lines', v_lines, 'total_amount', ROUND((SELECT COALESCE(SUM((line->>'total_amount')::NUMERIC), 0) FROM jsonb_array_elements(v_lines) line), 2), 'unmatched_total', v_unmatched_total, 'opening_balance_before', v_farmer.opening_balance, 'opening_balance_reduction', v_opening_reduction, 'opening_balance_after', v_farmer.opening_balance - v_opening_reduction, 'settlement_amount', v_settlement_total, 'farmer_due_before', v_farmer.total_due, 'farmer_due_after_credit', v_farmer.total_due - v_opening_reduction - v_settlement_total);
END; $$;

CREATE OR REPLACE FUNCTION public.create_farmer_return_v1(p_payload JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_farmer_id UUID := (p_payload->>'farmer_id')::UUID;
  v_branch_id UUID := (p_payload->>'branch_id')::UUID;
  v_preview JSONB;
  v_return_id UUID := gen_random_uuid();
  v_return_number TEXT;
  v_line JSONB;
  v_allocation JSONB;
  v_line_id UUID;
  v_inventory_id UUID;
  v_lot_id UUID;
  v_settlement_method TEXT := COALESCE(NULLIF(p_payload->>'settlement_method', ''), 'farmer_credit');
  v_cash_refund NUMERIC := 0;
  v_credit NUMERIC := 0;
  v_total NUMERIC;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'Select a receiving branch'; END IF;
  IF v_settlement_method NOT IN ('farmer_credit', 'cash_refund') THEN RAISE EXCEPTION 'Choose farmer credit or cash refund'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_farmer_id::TEXT, 0));
  v_preview := public.preview_farmer_return_v1(v_farmer_id, (p_payload->>'start_date')::DATE, (p_payload->>'end_date')::DATE, p_payload->'items');
  v_total := (v_preview->>'total_amount')::NUMERIC;
  IF (v_preview->>'settlement_amount')::NUMERIC > 0 THEN
    IF v_settlement_method = 'cash_refund' THEN v_cash_refund := (v_preview->>'settlement_amount')::NUMERIC; ELSE v_credit := (v_preview->>'settlement_amount')::NUMERIC; END IF;
  END IF;
  v_return_number := public.next_return_number(v_dealer_id);
  INSERT INTO public.bill_returns (id, dealer_id, branch_id, farmer_id, return_number, return_date, total_amount, notes, source_bill_start_date, source_bill_end_date, opening_balance_reduction, account_credit_amount, cash_refund_amount, settlement_method)
  VALUES (v_return_id, v_dealer_id, v_branch_id, v_farmer_id, v_return_number, COALESCE((p_payload->>'return_date')::DATE, CURRENT_DATE), v_total, NULLIF(p_payload->>'notes', ''), (p_payload->>'start_date')::DATE, (p_payload->>'end_date')::DATE, (v_preview->>'opening_balance_reduction')::NUMERIC, v_credit, v_cash_refund, v_settlement_method);
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_preview->'lines') LOOP
    INSERT INTO public.farmer_return_lines (return_id, dealer_id, product_id, product_name_snapshot, quantity, unmatched_quantity, unmatched_unit_price, total_amount)
    VALUES (v_return_id, v_dealer_id, (v_line->>'product_id')::UUID, v_line->>'product_name', (v_line->>'quantity')::NUMERIC, (v_line->>'unmatched_quantity')::NUMERIC, (v_line->>'unmatched_unit_price')::NUMERIC, (v_line->>'total_amount')::NUMERIC) RETURNING id INTO v_line_id;
    INSERT INTO public.inventory (dealer_id, branch_id, product_id, quantity_in_stock, min_stock_alert)
    VALUES (v_dealer_id, v_branch_id, (v_line->>'product_id')::UUID, 0, 0)
    ON CONFLICT (dealer_id, branch_id, product_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_inventory_id;
    INSERT INTO public.inventory_lots (dealer_id, branch_id, inventory_id, product_id, batch_number, quantity_received, remaining_quantity, received_at)
    VALUES (v_dealer_id, v_branch_id, v_inventory_id, (v_line->>'product_id')::UUID, 'CUSTOMER-RETURN', (v_line->>'quantity')::NUMERIC, (v_line->>'quantity')::NUMERIC, now()) RETURNING id INTO v_lot_id;
    UPDATE public.inventory SET quantity_in_stock = quantity_in_stock + (v_line->>'quantity')::NUMERIC, updated_at = now() WHERE id = v_inventory_id;
    INSERT INTO public.inventory_movements (dealer_id, branch_id, inventory_id, product_id, lot_id, reference_type, reference_id, quantity_change, notes) VALUES (v_dealer_id, v_branch_id, v_inventory_id, (v_line->>'product_id')::UUID, v_lot_id, 'farmer_return', v_return_id, (v_line->>'quantity')::NUMERIC, 'Farmer return ' || v_return_number);
    FOR v_allocation IN SELECT * FROM jsonb_array_elements(v_line->'allocations') LOOP
      INSERT INTO public.bill_return_allocations (return_id, return_line_id, dealer_id, bill_id, bill_item_id, quantity, unit_price, total_amount, balance_reduction, settlement_amount)
      VALUES (v_return_id, v_line_id, v_dealer_id, (v_allocation->>'bill_id')::UUID, (v_allocation->>'bill_item_id')::UUID, (v_allocation->>'quantity')::NUMERIC, (v_allocation->>'unit_price')::NUMERIC, (v_allocation->>'total_amount')::NUMERIC, (v_allocation->>'balance_reduction')::NUMERIC, (v_allocation->>'settlement_amount')::NUMERIC);
      UPDATE public.bills SET balance_due = GREATEST(0, balance_due - (v_allocation->>'balance_reduction')::NUMERIC) WHERE id = (v_allocation->>'bill_id')::UUID;
    END LOOP;
  END LOOP;
  UPDATE public.farmers SET opening_balance = GREATEST(0, opening_balance - (v_preview->>'opening_balance_reduction')::NUMERIC), return_credit_balance = return_credit_balance + v_credit, total_due = total_due - (v_preview->>'opening_balance_reduction')::NUMERIC - v_credit WHERE id = v_farmer_id AND dealer_id = v_dealer_id;
  IF v_cash_refund > 0 THEN INSERT INTO public.cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date) VALUES (v_dealer_id, v_branch_id, 'expense', 'farmer_return_refund', v_return_id, v_cash_refund, 'Cash refund for ' || v_return_number, COALESCE((p_payload->>'return_date')::DATE, CURRENT_DATE)); END IF;
  UPDATE public.transaction_events
  SET details = jsonb_build_object('affected_bill_count', (SELECT COUNT(DISTINCT bill_id) FROM public.bill_return_allocations WHERE return_id = v_return_id), 'opening_balance_reduction', (v_preview->>'opening_balance_reduction')::NUMERIC, 'account_credit_amount', v_credit, 'cash_refund_amount', v_cash_refund, 'receiving_branch_id', v_branch_id)
  WHERE source_type = 'bill_return' AND source_id = v_return_id;
  RETURN jsonb_build_object('return_id', v_return_id, 'return_number', v_return_number, 'preview', v_preview, 'cash_refund_amount', v_cash_refund, 'account_credit_amount', v_credit);
END; $$;

CREATE OR REPLACE FUNCTION public.get_returns_for_bill(p_bill_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id()); v_data JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::JSONB) INTO v_data FROM (
    SELECT r.id, r.return_number, r.return_date, r.total_amount, r.notes, r.created_at, r.branch_name_snapshot AS branch_name,
      COALESCE((SELECT jsonb_agg(row_to_json(i) ORDER BY i.created_at) FROM (SELECT id, product_name_snapshot AS product_name, quantity, unit_price, total_price, created_at FROM public.bill_return_items WHERE return_id = r.id) i),
        (SELECT jsonb_agg(jsonb_build_object('id', l.id, 'product_name', l.product_name_snapshot, 'quantity', a.quantity, 'unit_price', a.unit_price, 'total_price', a.total_amount, 'created_at', a.created_at) ORDER BY a.created_at) FROM public.bill_return_allocations a JOIN public.farmer_return_lines l ON l.id = a.return_line_id WHERE a.return_id = r.id AND a.bill_id = p_bill_id), '[]'::JSONB) AS items
    FROM public.bill_returns r
    WHERE r.dealer_id = v_dealer_id AND (r.bill_id = p_bill_id OR EXISTS (SELECT 1 FROM public.bill_return_allocations a WHERE a.return_id = r.id AND a.bill_id = p_bill_id))
  ) r;
  RETURN v_data;
END; $$;

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
    SELECT b.id, 'bill'::TEXT AS type, b.bill_number AS ref_number, b.bill_date AS date, b.total AS amount, b.balance_due, b.created_at, COALESCE(b.branch_name_snapshot, br.name) AS branch_name FROM public.bills b LEFT JOIN public.branches br ON br.id = b.branch_id WHERE b.farmer_id = p_farmer_id AND b.dealer_id = p_dealer_id AND b.status <> 'cancelled' AND (p_start_date IS NULL OR b.bill_date >= p_start_date) AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    UNION ALL SELECT p.id, 'payment'::TEXT, COALESCE(p.receipt_number, UPPER(p.method), 'PAYMENT'), p.payment_date, p.amount, NULL, p.created_at, COALESCE(p.branch_name_snapshot, br.name) FROM public.payments p LEFT JOIN public.branches br ON br.id = p.branch_id WHERE p.farmer_id = p_farmer_id AND p.dealer_id = p_dealer_id AND (p_start_date IS NULL OR p.payment_date >= p_start_date) AND (p_end_date IS NULL OR p.payment_date <= p_end_date)
    UNION ALL SELECT r.id, 'return'::TEXT, COALESCE(r.return_number, 'RETURN'), r.return_date, r.total_amount, NULL, r.created_at, COALESCE(r.branch_name_snapshot, br.name) FROM public.bill_returns r LEFT JOIN public.branches br ON br.id = r.branch_id WHERE r.farmer_id = p_farmer_id AND r.dealer_id = p_dealer_id AND (p_start_date IS NULL OR r.return_date >= p_start_date) AND (p_end_date IS NULL OR r.return_date <= p_end_date)
    ORDER BY created_at DESC LIMIT p_limit OFFSET v_offset
  ) record;
  RETURN jsonb_build_object('total', v_total, 'page', p_page, 'limit', p_limit, 'data', v_rows);
END; $$;

GRANT EXECUTE ON FUNCTION public.preview_farmer_return_v1(UUID, DATE, DATE, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_farmer_return_v1(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_returns_for_bill(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
