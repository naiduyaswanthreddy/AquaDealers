-- Customer-return lots are shared per product/branch. Undo must remove only
-- the quantity received by this return, never delete stock from older returns.

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
  FOR v_item IN SELECT inventory_id, lot_id, quantity_change FROM public.inventory_movements WHERE reference_type='farmer_return' AND reference_id=v_return.id FOR UPDATE LOOP
    UPDATE public.inventory SET quantity_in_stock=quantity_in_stock-v_item.quantity_change,updated_at=now() WHERE id=v_item.inventory_id AND quantity_in_stock>=v_item.quantity_change; IF NOT FOUND THEN RAISE EXCEPTION 'Receiving stock no longer permits undoing this return'; END IF;
    UPDATE public.inventory_lots SET quantity_received=quantity_received-v_item.quantity_change,remaining_quantity=remaining_quantity-v_item.quantity_change WHERE id=v_item.lot_id AND remaining_quantity>=v_item.quantity_change;
  END LOOP;
  DELETE FROM public.inventory_movements WHERE reference_type='farmer_return' AND reference_id=v_return.id;
  DELETE FROM public.cash_book WHERE source='farmer_return_refund' AND reference_id=v_return.id;
  UPDATE public.farmers SET opening_balance=opening_balance+v_return.opening_balance_reduction,return_credit_balance=GREATEST(0,return_credit_balance-v_return.account_credit_amount) WHERE id=v_return.farmer_id;
  DELETE FROM public.bill_returns WHERE id=v_return.id;
  PERFORM public.recalculate_farmer_due_v1(v_return.farmer_id);
  UPDATE public.transaction_events SET status='undone',undone_at=now(),undone_by=v_dealer_id,undo_reason=trim(p_reason) WHERE id=v_event.id;
  RETURN jsonb_build_object('event_id',v_event.id,'status','undone');
END; $$;

GRANT EXECUTE ON FUNCTION public.undo_transaction_v1(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
