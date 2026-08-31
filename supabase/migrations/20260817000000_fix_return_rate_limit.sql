-- create_farmer_return_v1 performs 5+ writes per line (inventory, lot, movement,
-- allocation, bill update) plus top-level inserts — easily exceeds 30/min for
-- any multi-item return. SECURITY DEFINER RPCs are trusted server-side code and
-- must bypass the interactive-write rate limiter, exactly like collect_farmer_payment_v2.

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

  -- Bypass rate limiter: this RPC is one user action, not N separate actions.
  PERFORM set_config('app.skip_rate_limit', 'true', true);

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

-- replace_farmer_return_v1 calls undo_transaction_v1 + create_farmer_return_v1
-- internally — same multi-write issue; bypass must be set before the first write.
CREATE OR REPLACE FUNCTION public.replace_farmer_return_v1(p_event_id UUID, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.skip_rate_limit', 'true', true);
  PERFORM public.undo_transaction_v1(p_event_id, 'Edited return');
  RETURN public.create_farmer_return_v1(p_payload);
END;
$$;

NOTIFY pgrst, 'reload schema';
