-- undo_transaction_v1 and undo_transaction_legacy_v1 each do many writes
-- (inventory lots, bills, payments, cash_book, etc.) for every item in the
-- transaction being reversed. A bill with 5 products hits ~10 writes; a
-- return with allocations is worse. Neither function had the rate-limit bypass
-- that collect_farmer_payment_v2 already uses. Adding it here.

-- ── Legacy handler (bills, payments, purchases, expenses, transfers) ──────────
CREATE OR REPLACE FUNCTION public.undo_transaction_legacy_v1(p_event_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dealer_id UUID := COALESCE(auth.uid(), public.staff_dealer_id());
  v_event public.transaction_events%ROWTYPE;
  v_bill public.bills%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_purchase public.stock_purchases%ROWTYPE;
  v_supplier_payment public.supplier_payments%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_cash public.cash_book%ROWTYPE;
  v_return public.bill_returns%ROWTYPE;
  v_transfer public.stock_transfers%ROWTYPE;
  v_item RECORD;
  v_farmer_due NUMERIC;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'An undo reason of at least 3 characters is required'; END IF;
  SELECT * INTO v_event FROM public.transaction_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.dealer_id <> v_dealer_id THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_event.status <> 'active' THEN RAISE EXCEPTION 'This transaction has already been %', v_event.status; END IF;
  IF v_event.undo_expires_at IS NULL OR v_event.undo_expires_at <= now() THEN RAISE EXCEPTION 'The undo window has ended'; END IF;

  -- One user action, many internal writes — bypass the per-minute write limiter.
  PERFORM set_config('app.skip_rate_limit', 'true', true);

  IF v_event.source_type = 'bill' THEN
    SELECT * INTO v_bill FROM public.bills WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND OR v_bill.status = 'cancelled' OR v_bill.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'The bill is already inactive'; END IF;
    IF COALESCE(v_bill.is_edited, false) THEN RAISE EXCEPTION 'This bill was edited later and must be handled from the bill editor'; END IF;
    IF EXISTS (SELECT 1 FROM public.bill_returns WHERE bill_id = v_bill.id) THEN RAISE EXCEPTION 'A return was recorded against this bill'; END IF;
    IF EXISTS (SELECT 1 FROM public.payment_allocations pa JOIN public.payments p ON p.id = pa.payment_id WHERE pa.bill_id = v_bill.id AND p.created_at > v_bill.created_at) THEN RAISE EXCEPTION 'A later farmer payment was allocated to this bill'; END IF;
    FOR v_item IN SELECT lot_id, inventory_id, product_id, quantity FROM public.bill_item_lot_allocations WHERE bill_id = v_bill.id FOR UPDATE LOOP
      UPDATE public.inventory_lots SET remaining_quantity = remaining_quantity + v_item.quantity WHERE id = v_item.lot_id;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock + v_item.quantity, updated_at = now() WHERE id = v_item.inventory_id;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type = 'bill' AND reference_id = v_bill.id;
    DELETE FROM public.cash_book
     WHERE (source = 'bill' AND reference_id = v_bill.id)
        OR (source IN ('farmer_payment', 'cash_sale') AND reference_id IN (SELECT id FROM public.payments WHERE bill_id = v_bill.id));
    DELETE FROM public.payment_allocations WHERE payment_id IN (SELECT id FROM public.payments WHERE bill_id = v_bill.id);
    DELETE FROM public.payments WHERE bill_id = v_bill.id;
    UPDATE public.bills SET status = 'cancelled', balance_due = 0, amount_paid = 0 WHERE id = v_bill.id;
    IF v_bill.farmer_id IS NOT NULL THEN
      SELECT COALESCE(SUM(balance_due), 0) INTO v_farmer_due FROM public.bills WHERE farmer_id = v_bill.farmer_id AND dealer_id = v_dealer_id AND deleted_at IS NULL AND status <> 'cancelled';
      UPDATE public.farmers SET total_due = v_farmer_due WHERE id = v_bill.farmer_id;
    END IF;
  ELSIF v_event.source_type = 'farmer_payment' THEN
    SELECT * INTO v_payment FROM public.payments WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The payment is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.bill_returns r JOIN public.payment_allocations pa ON pa.bill_id = r.bill_id WHERE pa.payment_id = v_payment.id) THEN RAISE EXCEPTION 'A later return affects a bill paid by this payment'; END IF;
    UPDATE public.bills b SET balance_due = b.balance_due + a.allocated_amount, amount_paid = GREATEST(0, b.amount_paid - a.allocated_amount)
      FROM public.payment_allocations a WHERE a.payment_id = v_payment.id AND b.id = a.bill_id;
    DELETE FROM public.cash_book WHERE source = 'farmer_payment' AND reference_id = v_payment.id;
    DELETE FROM public.payment_allocations WHERE payment_id = v_payment.id;
    DELETE FROM public.payments WHERE id = v_payment.id;
    SELECT COALESCE(SUM(balance_due), 0) INTO v_farmer_due FROM public.bills WHERE farmer_id = v_payment.farmer_id AND dealer_id = v_dealer_id AND deleted_at IS NULL AND status <> 'cancelled';
    UPDATE public.farmers SET total_due = v_farmer_due WHERE id = v_payment.farmer_id;
  ELSIF v_event.source_type = 'stock_purchase' THEN
    SELECT * INTO v_purchase FROM public.stock_purchases WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The purchase is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id AND remaining_quantity < quantity_received) THEN RAISE EXCEPTION 'Some stock from this purchase was sold, returned, adjusted, or transferred later'; END IF;
    FOR v_item IN SELECT inventory_id, product_id, quantity_received FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id FOR UPDATE LOOP
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock - v_item.quantity_received, updated_at = now() WHERE id = v_item.inventory_id AND quantity_in_stock >= v_item.quantity_received;
      IF NOT FOUND THEN RAISE EXCEPTION 'Current stock no longer permits undoing this purchase'; END IF;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type IN ('stock_purchase', 'purchase') AND reference_id = v_purchase.id;
    DELETE FROM public.inventory_lots WHERE stock_purchase_id = v_purchase.id;
    IF NOT COALESCE(v_purchase.is_paid, false) THEN UPDATE public.suppliers SET total_due = GREATEST(0, total_due - COALESCE(v_purchase.total_amount, 0)) WHERE id = v_purchase.supplier_id; END IF;
    DELETE FROM public.cash_book WHERE source IN ('stock_purchase', 'purchase') AND reference_id = v_purchase.id;
    DELETE FROM public.stock_purchases WHERE id = v_purchase.id;
  ELSIF v_event.source_type = 'supplier_payment' THEN
    SELECT * INTO v_supplier_payment FROM public.supplier_payments WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The supplier payment is no longer active'; END IF;
    UPDATE public.suppliers SET total_due = total_due + v_supplier_payment.amount WHERE id = v_supplier_payment.supplier_id;
    DELETE FROM public.cash_book WHERE source = 'supplier_payment' AND reference_id = v_supplier_payment.id;
    DELETE FROM public.supplier_payments WHERE id = v_supplier_payment.id;
  ELSIF v_event.source_type = 'expense' THEN
    SELECT * INTO v_expense FROM public.expenses WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The expense is no longer active'; END IF;
    DELETE FROM public.cash_book WHERE source = 'expense' AND reference_id = v_expense.id;
    DELETE FROM public.expenses WHERE id = v_expense.id;
  ELSIF v_event.source_type = 'cash_entry' THEN
    SELECT * INTO v_cash FROM public.cash_book WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The cash entry is no longer active'; END IF;
    DELETE FROM public.cash_book WHERE id = v_cash.id;
  ELSIF v_event.source_type = 'stock_transfer' THEN
    SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = v_event.source_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The transfer is no longer active'; END IF;
    IF EXISTS (SELECT 1 FROM public.stock_transfer_items i JOIN public.inventory_lots l ON l.id = i.to_lot_id WHERE i.transfer_id = v_transfer.id AND l.remaining_quantity < i.quantity) THEN RAISE EXCEPTION 'Transferred stock was used at the destination branch'; END IF;
    FOR v_item IN SELECT * FROM public.stock_transfer_items WHERE transfer_id = v_transfer.id FOR UPDATE LOOP
      IF v_item.from_lot_id IS NOT NULL THEN UPDATE public.inventory_lots SET remaining_quantity = remaining_quantity + v_item.quantity WHERE id = v_item.from_lot_id; END IF;
      IF v_item.to_lot_id IS NOT NULL THEN DELETE FROM public.inventory_lots WHERE id = v_item.to_lot_id; END IF;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock + v_item.quantity, updated_at = now() WHERE dealer_id = v_dealer_id AND branch_id = v_transfer.from_branch_id AND product_id = v_item.product_id;
      UPDATE public.inventory SET quantity_in_stock = quantity_in_stock - v_item.quantity, updated_at = now() WHERE dealer_id = v_dealer_id AND branch_id = v_transfer.to_branch_id AND product_id = v_item.product_id AND quantity_in_stock >= v_item.quantity;
      IF NOT FOUND THEN RAISE EXCEPTION 'Destination stock no longer permits undoing this transfer'; END IF;
    END LOOP;
    DELETE FROM public.inventory_movements WHERE reference_type = 'transfer' AND reference_id = v_transfer.id;
    DELETE FROM public.stock_transfers WHERE id = v_transfer.id;
  ELSE
    RAISE EXCEPTION 'Undo is not available yet for transaction type %', v_event.source_type;
  END IF;
  UPDATE public.transaction_events SET status = 'undone', undone_at = now(), undone_by = COALESCE(auth.uid(), public.staff_dealer_id()), undo_reason = trim(p_reason) WHERE id = v_event.id;
  RETURN jsonb_build_object('event_id', v_event.id, 'status', 'undone');
END;
$$;

-- ── Bill-return handler ───────────────────────────────────────────────────────
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

  -- One user action, many internal writes — bypass the per-minute write limiter.
  PERFORM set_config('app.skip_rate_limit', 'true', true);

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

GRANT EXECUTE ON FUNCTION public.undo_transaction_legacy_v1(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_transaction_v1(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
