CREATE OR REPLACE FUNCTION public.edit_bill_payment_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_dealer_id UUID := COALESCE(public.staff_dealer_id(), auth.uid());
  v_amount NUMERIC := COALESCE((p_payload->>'amount_paid')::NUMERIC, 0);
  v_method TEXT := NULLIF(trim(p_payload->>'payment_type'), '');
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
  v_due_delta NUMERIC;
BEGIN
  IF v_dealer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_bill FROM public.bills WHERE id=(p_payload->>'bill_id')::UUID AND dealer_id=v_dealer_id FOR UPDATE;
  IF NOT FOUND OR v_bill.status='cancelled' THEN RAISE EXCEPTION 'Active bill not found'; END IF;
  IF v_amount < 0 OR v_amount > v_bill.total THEN RAISE EXCEPTION 'Amount received must be between zero and the bill total'; END IF;
  IF v_amount > 0 AND v_method IS NULL THEN RAISE EXCEPTION 'Select a payment method for a received amount'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE bill_id=v_bill.id AND dealer_id=v_dealer_id ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND AND EXISTS (SELECT 1 FROM public.payment_allocations WHERE payment_id=v_payment.id AND bill_id<>v_bill.id) THEN
    RAISE EXCEPTION 'This payment was allocated to other bills and cannot be edited here';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE bill_id=v_bill.id AND dealer_id=v_dealer_id AND id<>COALESCE(v_payment.id, '00000000-0000-0000-0000-000000000000'::UUID)) THEN
    RAISE EXCEPTION 'This bill has later payments. Edit payments from the farmer ledger instead';
  END IF;

  v_old_balance := COALESCE(v_bill.balance_due, 0);
  v_new_balance := GREATEST(v_bill.total-v_amount,0);
  v_due_delta := v_new_balance-v_old_balance;
  UPDATE public.bills SET amount_paid=v_amount,balance_due=v_new_balance,payment_type=CASE WHEN v_amount>0 THEN v_method ELSE NULL END,is_edited=true WHERE id=v_bill.id;

  IF v_payment.id IS NOT NULL THEN
    IF v_amount=0 THEN
      DELETE FROM public.cash_book WHERE source='farmer_payment' AND reference_id=v_payment.id;
      DELETE FROM public.payment_allocations WHERE payment_id=v_payment.id;
      DELETE FROM public.payments WHERE id=v_payment.id;
    ELSE
      UPDATE public.payments SET amount=v_amount,method=v_method WHERE id=v_payment.id;
      UPDATE public.payment_allocations SET allocated_amount=v_amount WHERE payment_id=v_payment.id AND bill_id=v_bill.id;
      UPDATE public.cash_book SET amount=v_amount,notes='Payment received for bill '||v_bill.bill_number WHERE source='farmer_payment' AND reference_id=v_payment.id;
      UPDATE public.transaction_events SET amount=v_amount,details=jsonb_set(COALESCE(details,'{}'::jsonb),'{payment_type}',to_jsonb(v_method),true) WHERE source_type='farmer_payment' AND source_id=v_payment.id;
    END IF;
  ELSIF v_amount>0 THEN
    INSERT INTO public.payments(dealer_id,branch_id,farmer_id,bill_id,amount,payment_date,method) VALUES(v_dealer_id,v_bill.branch_id,v_bill.farmer_id,v_bill.id,v_amount,v_bill.bill_date,v_method) RETURNING * INTO v_payment;
    INSERT INTO public.payment_allocations(dealer_id,payment_id,bill_id,farmer_id,allocated_amount,allocation_order) VALUES(v_dealer_id,v_payment.id,v_bill.id,v_bill.farmer_id,v_amount,1);
    INSERT INTO public.cash_book(dealer_id,branch_id,entry_type,source,reference_id,amount,notes,entry_date) VALUES(v_dealer_id,v_bill.branch_id,'income','farmer_payment',v_payment.id,v_amount,'Payment received for bill '||v_bill.bill_number,v_bill.bill_date);
  END IF;
  IF v_bill.farmer_id IS NOT NULL AND v_due_delta<>0 THEN UPDATE public.farmers SET total_due=GREATEST(0,COALESCE(total_due,0)+v_due_delta) WHERE id=v_bill.farmer_id AND dealer_id=v_dealer_id; END IF;
  UPDATE public.transaction_events SET details=jsonb_build_object('payment_type',CASE WHEN v_amount>0 THEN v_method ELSE NULL END,'amount_paid',v_amount,'balance_due',v_new_balance) WHERE source_type='bill' AND source_id=v_bill.id;
  INSERT INTO public.bill_audit_logs(bill_id,dealer_id,user_id,changes_jsonb) VALUES(v_bill.id,v_dealer_id,auth.uid(),jsonb_build_object('payment',jsonb_build_object('old_amount_paid',v_bill.amount_paid,'new_amount_paid',v_amount,'old_payment_type',v_bill.payment_type,'new_payment_type',CASE WHEN v_amount>0 THEN v_method ELSE NULL END)));
  RETURN jsonb_build_object('bill_id',v_bill.id,'amount_paid',v_amount,'balance_due',v_new_balance);
END; $$;
GRANT EXECUTE ON FUNCTION public.edit_bill_payment_v1(JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
