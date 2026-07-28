-- Correctness fixes for farmer-first returns. This migration intentionally
-- supersedes the first implementation before it is deployed.

CREATE TABLE IF NOT EXISTS public.farmer_return_credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.bill_returns(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_farmer_return_credit_applications_return ON public.farmer_return_credit_applications(return_id);

CREATE OR REPLACE FUNCTION public.recalculate_farmer_due_v1(p_farmer_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due NUMERIC;
BEGIN
  SELECT COALESCE(f.opening_balance, 0) + COALESCE((SELECT SUM(b.balance_due) FROM public.bills b WHERE b.farmer_id = f.id AND b.deleted_at IS NULL AND b.status <> 'cancelled'), 0) - COALESCE(f.return_credit_balance, 0)
    INTO v_due FROM public.farmers f WHERE f.id = p_farmer_id FOR UPDATE;
  UPDATE public.farmers SET total_due = v_due WHERE id = p_farmer_id;
  RETURN v_due;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_farmer_return_credit_v1(p_farmer_id UUID, p_return_id UUID DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credit NUMERIC; v_bill RECORD; v_return RECORD; v_apply NUMERIC; v_return_credit NUMERIC;
BEGIN
  SELECT return_credit_balance INTO v_credit FROM public.farmers WHERE id = p_farmer_id FOR UPDATE;
  FOR v_return IN SELECT r.id, r.account_credit_amount - COALESCE((SELECT SUM(a.amount) FROM public.farmer_return_credit_applications a WHERE a.return_id=r.id),0) available_credit FROM public.bill_returns r WHERE r.farmer_id=p_farmer_id AND r.account_credit_amount>0 AND (p_return_id IS NULL OR r.id=p_return_id) ORDER BY r.return_date, r.created_at FOR UPDATE LOOP
    v_return_credit := v_return.available_credit;
    FOR v_bill IN SELECT id, balance_due FROM public.bills WHERE farmer_id=p_farmer_id AND deleted_at IS NULL AND status='active' AND balance_due>0 ORDER BY bill_date ASC, created_at ASC FOR UPDATE LOOP
      EXIT WHEN v_return_credit <= 0;
      v_apply := LEAST(v_return_credit,v_bill.balance_due);
      UPDATE public.bills SET balance_due=balance_due-v_apply,amount_paid=amount_paid+v_apply WHERE id=v_bill.id;
      INSERT INTO public.farmer_return_credit_applications(return_id,bill_id,amount) VALUES(v_return.id,v_bill.id,v_apply);
      v_return_credit := v_return_credit-v_apply; v_credit := v_credit-v_apply;
    END LOOP;
  END LOOP;
  UPDATE public.farmers SET return_credit_balance = v_credit WHERE id = p_farmer_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_bill_apply_farmer_return_credit_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.farmer_id IS NOT NULL AND NEW.balance_due > 0 THEN
    PERFORM public.apply_farmer_return_credit_v1(NEW.farmer_id);
    PERFORM public.recalculate_farmer_due_v1(NEW.farmer_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS bill_apply_farmer_return_credit ON public.bills;
CREATE TRIGGER bill_apply_farmer_return_credit AFTER INSERT ON public.bills FOR EACH ROW EXECUTE FUNCTION public.trg_bill_apply_farmer_return_credit_v1();

CREATE OR REPLACE FUNCTION public.trg_farmer_recalculate_due_v1()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN PERFORM public.recalculate_farmer_due_v1(NEW.id); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS farmer_recalculate_due ON public.farmers;
CREATE TRIGGER farmer_recalculate_due AFTER UPDATE OF total_due, opening_balance, return_credit_balance ON public.farmers FOR EACH ROW EXECUTE FUNCTION public.trg_farmer_recalculate_due_v1();

CREATE OR REPLACE FUNCTION public.preview_farmer_return_v1(p_farmer_id UUID, p_start_date DATE, p_end_date DATE, p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id()); v_farmer public.farmers%ROWTYPE; v_input JSONB; v_bill_item RECORD; v_requested NUMERIC; v_remaining NUMERIC; v_take NUMERIC; v_price NUMERIC; v_value NUMERIC; v_matched_value NUMERIC; v_unmatched_total NUMERIC := 0; v_settlement NUMERIC := 0; v_bill_reduction NUMERIC := 0; v_opening NUMERIC; v_effective_due NUMERIC; v_bill_used JSONB := '{}'::JSONB; v_allocations JSONB; v_lines JSONB := '[]'::JSONB;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date OR p_end_date > CURRENT_DATE THEN RAISE EXCEPTION 'Choose a valid, non-future bill date range'; END IF;
  SELECT * INTO v_farmer FROM public.farmers WHERE id = p_farmer_id AND dealer_id = v_dealer_id; IF NOT FOUND THEN RAISE EXCEPTION 'Farmer not found'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Add at least one return item'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) item GROUP BY item->>'product_id' HAVING COUNT(*) > 1) THEN RAISE EXCEPTION 'A product can be returned only once per transaction'; END IF;
  FOR v_input IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_requested := ROUND(COALESCE((v_input->>'quantity')::NUMERIC, 0), 2); v_price := ROUND(COALESCE((v_input->>'unmatched_unit_price')::NUMERIC, -1), 2);
    IF v_requested <= 0 OR v_price < 0 OR NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = (v_input->>'product_id')::UUID AND p.dealer_id = v_dealer_id) THEN RAISE EXCEPTION 'Each return item must be an active dealer product with a valid quantity and price'; END IF;
    v_remaining := v_requested; v_matched_value := 0; v_allocations := '[]'::JSONB;
    FOR v_bill_item IN SELECT bi.id, bi.quantity, bi.unit_price, b.id bill_id, b.bill_number, b.bill_date, b.balance_due, COALESCE(b.branch_name_snapshot, br.name) branch_name, GREATEST(0, bi.quantity - COALESCE((SELECT SUM(quantity) FROM public.bill_return_items x WHERE x.bill_item_id = bi.id), 0) - COALESCE((SELECT SUM(quantity) FROM public.bill_return_allocations x WHERE x.bill_item_id = bi.id), 0)) available_quantity FROM public.bill_items bi JOIN public.bills b ON b.id = bi.bill_id LEFT JOIN public.branches br ON br.id = b.branch_id WHERE b.dealer_id = v_dealer_id AND b.farmer_id = p_farmer_id AND b.status = 'active' AND b.deleted_at IS NULL AND b.bill_date BETWEEN p_start_date AND p_end_date AND bi.product_id = (v_input->>'product_id')::UUID ORDER BY b.bill_date DESC, b.created_at DESC, bi.id DESC LOOP
      EXIT WHEN v_remaining <= 0; v_take := LEAST(v_remaining, v_bill_item.available_quantity); IF v_take <= 0 THEN CONTINUE; END IF;
      v_value := ROUND(v_take * v_bill_item.unit_price, 2); v_effective_due := GREATEST(0, v_bill_item.balance_due - COALESCE((v_bill_used->>v_bill_item.bill_id::TEXT)::NUMERIC, 0));
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('bill_id', v_bill_item.bill_id, 'bill_item_id', v_bill_item.id, 'bill_number', v_bill_item.bill_number, 'bill_date', v_bill_item.bill_date, 'branch_name', v_bill_item.branch_name, 'quantity', v_take, 'unit_price', v_bill_item.unit_price, 'total_amount', v_value, 'balance_before', v_effective_due, 'balance_reduction', LEAST(v_value, v_effective_due), 'balance_after', GREATEST(0, v_effective_due-v_value), 'settlement_amount', GREATEST(0, v_value-v_effective_due)));
      v_bill_used := jsonb_set(v_bill_used, ARRAY[v_bill_item.bill_id::TEXT], to_jsonb(COALESCE((v_bill_used->>v_bill_item.bill_id::TEXT)::NUMERIC, 0) + LEAST(v_value, v_effective_due))); v_matched_value := v_matched_value + v_value; v_bill_reduction := v_bill_reduction + LEAST(v_value, v_effective_due); v_settlement := v_settlement + GREATEST(0, v_value-v_effective_due); v_remaining := v_remaining-v_take;
    END LOOP;
    v_unmatched_total := v_unmatched_total + ROUND(v_remaining*v_price, 2);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('product_id', v_input->>'product_id', 'product_name', (SELECT name FROM public.products WHERE id=(v_input->>'product_id')::UUID), 'quantity', v_requested, 'matched_quantity', v_requested-v_remaining, 'unmatched_quantity', v_remaining, 'unmatched_unit_price', v_price, 'total_amount', ROUND(v_matched_value + v_remaining*v_price, 2), 'allocations', v_allocations));
  END LOOP;
  v_opening := LEAST(GREATEST(v_farmer.opening_balance,0), v_unmatched_total); v_settlement := v_settlement + v_unmatched_total-v_opening;
  RETURN jsonb_build_object('farmer_id',v_farmer.id,'farmer_name',v_farmer.name,'start_date',p_start_date,'end_date',p_end_date,'lines',v_lines,'total_amount',(SELECT COALESCE(SUM((x->>'total_amount')::NUMERIC),0) FROM jsonb_array_elements(v_lines) x),'unmatched_total',v_unmatched_total,'bill_balance_reduction',v_bill_reduction,'opening_balance_before',v_farmer.opening_balance,'opening_balance_reduction',v_opening,'opening_balance_after',v_farmer.opening_balance-v_opening,'settlement_amount',v_settlement,'farmer_due_before',v_farmer.total_due,'farmer_due_after_cash_refund',v_farmer.total_due-v_bill_reduction-v_opening,'farmer_due_after_credit',v_farmer.total_due-v_bill_reduction-v_opening-v_settlement);
END; $$;

CREATE OR REPLACE FUNCTION public.create_farmer_return_v1(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id()); v_farmer_id UUID := (p_payload->>'farmer_id')::UUID; v_branch_id UUID := (p_payload->>'branch_id')::UUID; v_preview JSONB; v_return_id UUID := gen_random_uuid(); v_return_number TEXT; v_line JSONB; v_allocation JSONB; v_line_id UUID; v_inventory_id UUID; v_lot_id UUID; v_method TEXT := COALESCE(NULLIF(p_payload->>'settlement_method',''),'farmer_credit'); v_credit NUMERIC := 0; v_refund NUMERIC := 0; v_return_date DATE := COALESCE(NULLIF(p_payload->>'return_date','')::DATE,CURRENT_DATE); v_total NUMERIC;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_branch_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.branches WHERE id=v_branch_id AND dealer_id=v_dealer_id AND is_active) THEN RAISE EXCEPTION 'Choose an active branch belonging to this dealer'; END IF;
  IF auth.uid() IS NULL AND NOT public.staff_can_access_branch(v_branch_id) THEN RAISE EXCEPTION 'You cannot record returns for this branch'; END IF;
  IF v_return_date > CURRENT_DATE THEN RAISE EXCEPTION 'Return date cannot be in the future'; END IF;
  IF v_method NOT IN ('farmer_credit','cash_refund') THEN RAISE EXCEPTION 'Choose farmer credit or cash refund'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_dealer_id::TEXT,1)); PERFORM pg_advisory_xact_lock(hashtextextended(v_farmer_id::TEXT,0));
  v_preview := public.preview_farmer_return_v1(v_farmer_id,(p_payload->>'start_date')::DATE,(p_payload->>'end_date')::DATE,p_payload->'items');
  IF p_payload ? 'expected_preview' AND v_preview IS DISTINCT FROM p_payload->'expected_preview' THEN RAISE EXCEPTION 'The return review is out of date. Review the latest bill balances before confirming.'; END IF;
  v_total := (v_preview->>'total_amount')::NUMERIC;
  IF (v_preview->>'settlement_amount')::NUMERIC > 0 THEN IF v_method='cash_refund' THEN v_refund := (v_preview->>'settlement_amount')::NUMERIC; ELSE v_credit := (v_preview->>'settlement_amount')::NUMERIC; END IF; END IF;
  v_return_number := public.next_return_number(v_dealer_id);
  INSERT INTO public.bill_returns(id,dealer_id,branch_id,farmer_id,return_number,return_date,total_amount,notes,source_bill_start_date,source_bill_end_date,opening_balance_reduction,account_credit_amount,cash_refund_amount,settlement_method) VALUES(v_return_id,v_dealer_id,v_branch_id,v_farmer_id,v_return_number,v_return_date,v_total,NULLIF(p_payload->>'notes',''),(p_payload->>'start_date')::DATE,(p_payload->>'end_date')::DATE,(v_preview->>'opening_balance_reduction')::NUMERIC,v_credit,v_refund,v_method);
  FOR v_line IN SELECT * FROM jsonb_array_elements(v_preview->'lines') LOOP
    INSERT INTO public.farmer_return_lines(return_id,dealer_id,product_id,product_name_snapshot,quantity,unmatched_quantity,unmatched_unit_price,total_amount) VALUES(v_return_id,v_dealer_id,(v_line->>'product_id')::UUID,v_line->>'product_name',(v_line->>'quantity')::NUMERIC,(v_line->>'unmatched_quantity')::NUMERIC,(v_line->>'unmatched_unit_price')::NUMERIC,(v_line->>'total_amount')::NUMERIC) RETURNING id INTO v_line_id;
    INSERT INTO public.inventory(dealer_id,branch_id,product_id,quantity_in_stock,min_stock_alert) VALUES(v_dealer_id,v_branch_id,(v_line->>'product_id')::UUID,0,0) ON CONFLICT(dealer_id,branch_id,product_id) DO UPDATE SET updated_at=now() RETURNING id INTO v_inventory_id;
    SELECT id INTO v_lot_id FROM public.inventory_lots WHERE dealer_id=v_dealer_id AND branch_id=v_branch_id AND inventory_id=v_inventory_id AND product_id=(v_line->>'product_id')::UUID AND batch_number='CUSTOMER-RETURN' ORDER BY created_at LIMIT 1 FOR UPDATE;
    IF v_lot_id IS NULL THEN INSERT INTO public.inventory_lots(dealer_id,branch_id,inventory_id,product_id,batch_number,quantity_received,remaining_quantity,received_at) VALUES(v_dealer_id,v_branch_id,v_inventory_id,(v_line->>'product_id')::UUID,'CUSTOMER-RETURN',(v_line->>'quantity')::NUMERIC,(v_line->>'quantity')::NUMERIC,now()) RETURNING id INTO v_lot_id; ELSE UPDATE public.inventory_lots SET quantity_received=quantity_received+(v_line->>'quantity')::NUMERIC,remaining_quantity=remaining_quantity+(v_line->>'quantity')::NUMERIC WHERE id=v_lot_id; END IF;
    UPDATE public.inventory SET quantity_in_stock=quantity_in_stock+(v_line->>'quantity')::NUMERIC,updated_at=now() WHERE id=v_inventory_id;
    INSERT INTO public.inventory_movements(dealer_id,branch_id,inventory_id,product_id,lot_id,reference_type,reference_id,quantity_change,notes) VALUES(v_dealer_id,v_branch_id,v_inventory_id,(v_line->>'product_id')::UUID,v_lot_id,'farmer_return',v_return_id,(v_line->>'quantity')::NUMERIC,'Farmer return '||v_return_number);
    FOR v_allocation IN SELECT * FROM jsonb_array_elements(v_line->'allocations') LOOP
      INSERT INTO public.bill_return_allocations(return_id,return_line_id,dealer_id,bill_id,bill_item_id,quantity,unit_price,total_amount,balance_reduction,settlement_amount) VALUES(v_return_id,v_line_id,v_dealer_id,(v_allocation->>'bill_id')::UUID,(v_allocation->>'bill_item_id')::UUID,(v_allocation->>'quantity')::NUMERIC,(v_allocation->>'unit_price')::NUMERIC,(v_allocation->>'total_amount')::NUMERIC,(v_allocation->>'balance_reduction')::NUMERIC,(v_allocation->>'settlement_amount')::NUMERIC);
      UPDATE public.bills SET balance_due=GREATEST(0,balance_due-(v_allocation->>'balance_reduction')::NUMERIC) WHERE id=(v_allocation->>'bill_id')::UUID;
    END LOOP;
  END LOOP;
  UPDATE public.farmers SET opening_balance=GREATEST(0,opening_balance-(v_preview->>'opening_balance_reduction')::NUMERIC),return_credit_balance=return_credit_balance+v_credit WHERE id=v_farmer_id AND dealer_id=v_dealer_id;
  IF v_credit > 0 THEN PERFORM public.apply_farmer_return_credit_v1(v_farmer_id,v_return_id); END IF;
  PERFORM public.recalculate_farmer_due_v1(v_farmer_id);
  IF v_refund>0 THEN INSERT INTO public.cash_book(dealer_id,branch_id,entry_type,source,reference_id,amount,notes,entry_date) VALUES(v_dealer_id,v_branch_id,'expense','farmer_return_refund',v_return_id,v_refund,'Cash refund for '||v_return_number,v_return_date); END IF;
  UPDATE public.transaction_events SET details=jsonb_build_object('affected_bill_count',(SELECT COUNT(DISTINCT bill_id) FROM public.bill_return_allocations WHERE return_id=v_return_id),'opening_balance_reduction',(v_preview->>'opening_balance_reduction')::NUMERIC,'account_credit_amount',v_credit,'cash_refund_amount',v_refund,'receiving_branch_id',v_branch_id) WHERE source_type='bill_return' AND source_id=v_return_id;
  RETURN jsonb_build_object('return_id',v_return_id,'return_number',v_return_number,'preview',v_preview,'cash_refund_amount',v_refund,'account_credit_amount',v_credit,'new_farmer_due',(SELECT total_due FROM public.farmers WHERE id=v_farmer_id));
END; $$;

ALTER FUNCTION public.undo_transaction_v1(UUID, TEXT) RENAME TO undo_transaction_legacy_v1;
CREATE OR REPLACE FUNCTION public.undo_transaction_v1(p_event_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id()); v_event public.transaction_events%ROWTYPE; v_return public.bill_returns%ROWTYPE; v_item RECORD;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_event FROM public.transaction_events WHERE id=p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.dealer_id<>v_dealer_id OR v_event.source_type <> 'bill_return' THEN RETURN public.undo_transaction_legacy_v1(p_event_id,p_reason); END IF;
  IF length(trim(COALESCE(p_reason,'')))<3 THEN RAISE EXCEPTION 'An undo reason of at least 3 characters is required'; END IF;
  IF v_event.status<>'active' OR v_event.undo_expires_at IS NULL OR v_event.undo_expires_at<=now() THEN RAISE EXCEPTION 'This return can no longer be undone'; END IF;
  SELECT * INTO v_return FROM public.bill_returns WHERE id=v_event.source_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Return not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_movements m JOIN public.inventory_lots l ON l.id=m.lot_id WHERE m.reference_type='farmer_return' AND m.reference_id=v_return.id AND l.remaining_quantity<m.quantity_change) THEN RAISE EXCEPTION 'Returned stock has already been used or transferred'; END IF;
  IF EXISTS (SELECT 1 FROM public.payment_allocations p JOIN public.farmer_return_credit_applications a ON a.bill_id=p.bill_id WHERE a.return_id=v_return.id AND p.created_at>v_return.created_at) THEN RAISE EXCEPTION 'A later payment used a bill affected by this return'; END IF;
  FOR v_item IN SELECT bill_id, SUM(amount) AS amount FROM public.farmer_return_credit_applications WHERE return_id=v_return.id GROUP BY bill_id LOOP UPDATE public.bills SET balance_due=balance_due+v_item.amount,amount_paid=GREATEST(0,amount_paid-v_item.amount) WHERE id=v_item.bill_id; END LOOP;
  DELETE FROM public.farmer_return_credit_applications WHERE return_id=v_return.id;
  FOR v_item IN SELECT bill_id, SUM(balance_reduction) AS balance_reduction FROM public.bill_return_allocations WHERE return_id=v_return.id GROUP BY bill_id LOOP UPDATE public.bills SET balance_due=balance_due+v_item.balance_reduction WHERE id=v_item.bill_id; END LOOP;
  FOR v_item IN SELECT inventory_id, lot_id, product_id, quantity_change FROM public.inventory_movements WHERE reference_type='farmer_return' AND reference_id=v_return.id FOR UPDATE LOOP UPDATE public.inventory SET quantity_in_stock=quantity_in_stock-v_item.quantity_change,updated_at=now() WHERE id=v_item.inventory_id AND quantity_in_stock>=v_item.quantity_change; IF NOT FOUND THEN RAISE EXCEPTION 'Receiving stock no longer permits undoing this return'; END IF; DELETE FROM public.inventory_lots WHERE id=v_item.lot_id; END LOOP;
  DELETE FROM public.inventory_movements WHERE reference_type='farmer_return' AND reference_id=v_return.id;
  DELETE FROM public.cash_book WHERE source='farmer_return_refund' AND reference_id=v_return.id;
  UPDATE public.farmers SET opening_balance=opening_balance+v_return.opening_balance_reduction,return_credit_balance=GREATEST(0,return_credit_balance-v_return.account_credit_amount) WHERE id=v_return.farmer_id;
  DELETE FROM public.bill_returns WHERE id=v_return.id;
  PERFORM public.recalculate_farmer_due_v1(v_return.farmer_id);
  UPDATE public.transaction_events SET status='undone',undone_at=now(),undone_by=v_dealer_id,undo_reason=trim(p_reason) WHERE id=v_event.id;
  RETURN jsonb_build_object('event_id',v_event.id,'status','undone');
END; $$;
GRANT EXECUTE ON FUNCTION public.undo_transaction_v1(UUID, TEXT) TO authenticated;
