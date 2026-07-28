-- Multi-row payment allocation is one user action. Do not charge each internal
-- update against the interactive table-write limiter.
CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_current_minute TIMESTAMP;
  v_count INTEGER;
  v_max_actions INTEGER := 30;
BEGIN
  IF current_setting('app.skip_rate_limit', true) = 'true' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_current_minute := date_trunc('minute', now());
  INSERT INTO user_activity_limits (user_id, minute_window, action_count)
  VALUES (v_user_id, v_current_minute, 1)
  ON CONFLICT (user_id, minute_window)
  DO UPDATE SET action_count = user_activity_limits.action_count + 1
  RETURNING action_count INTO v_count;

  IF v_count > v_max_actions THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only perform % actions per minute.', v_max_actions;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the payment RPC with a transaction-local bypass for its own internal
-- writes. Direct browser writes remain protected by enforce_rate_limit().
CREATE OR REPLACE FUNCTION public.collect_farmer_payment_v2(p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
  PERFORM set_config('app.skip_rate_limit', 'true', true);

  v_receipt_number := public.generate_receipt_number('RCPT');
  INSERT INTO payments (dealer_id, branch_id, farmer_id, bill_id, amount, payment_date, method, upi_ref, cheque_no, notes, allocation_mode, receipt_number)
  VALUES (v_dealer_id, v_branch_id, v_farmer_id, v_target_bill_id, v_amount,
    COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE), NULLIF(p_payload->>'method', ''),
    NULLIF(p_payload->>'upi_ref', ''), NULLIF(p_payload->>'cheque_no', ''), NULLIF(p_payload->>'notes', ''),
    COALESCE(NULLIF(p_payload->>'allocation_mode', ''), CASE WHEN v_target_bill_id IS NULL THEN 'oldest_first' ELSE 'specific_bill' END), v_receipt_number)
  RETURNING id INTO v_payment_id;

  v_remaining := v_amount;
  FOR v_bill IN SELECT id, balance_due FROM bills
    WHERE dealer_id = v_dealer_id AND farmer_id = v_farmer_id AND status = 'active' AND balance_due > 0
      AND (v_target_bill_id IS NULL OR id = v_target_bill_id)
    ORDER BY CASE WHEN id = v_target_bill_id THEN 0 ELSE 1 END, bill_date, created_at FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_allocation := LEAST(v_bill.balance_due, v_remaining);
    v_order := v_order + 1;
    UPDATE bills SET balance_due = balance_due - v_allocation WHERE id = v_bill.id;
    INSERT INTO payment_allocations (dealer_id, payment_id, bill_id, farmer_id, allocated_amount, allocation_order)
    VALUES (v_dealer_id, v_payment_id, v_bill.id, v_farmer_id, v_allocation, v_order);
    v_remaining := v_remaining - v_allocation;
  END LOOP;

  IF v_target_bill_id IS NOT NULL AND v_remaining > 0 THEN RAISE EXCEPTION 'Payment exceeds balance due for the selected bill'; END IF;
  UPDATE farmers SET total_due = GREATEST(COALESCE(total_due, 0) - (v_amount - v_remaining), 0)
  WHERE id = v_farmer_id AND dealer_id = v_dealer_id;
  INSERT INTO cash_book (dealer_id, branch_id, entry_type, source, reference_id, amount, notes, entry_date)
  VALUES (v_dealer_id, v_branch_id, 'income', 'farmer_payment', v_payment_id, v_amount - v_remaining,
    'Farmer payment receipt ' || v_receipt_number, COALESCE(NULLIF(p_payload->>'payment_date', '')::DATE, CURRENT_DATE));

  RETURN jsonb_build_object('payment_id', v_payment_id, 'receipt_number', v_receipt_number,
    'allocated_amount', v_amount - v_remaining, 'unallocated_amount', v_remaining);
END;
$$;

-- Editing a return is an atomic undo-and-replace operation. If any validation
-- fails, PostgreSQL rolls back the undo as well, keeping stock and dues aligned.
CREATE OR REPLACE FUNCTION public.replace_farmer_return_v1(p_event_id UUID, p_payload JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.undo_transaction_v1(p_event_id, 'Edited return');
  RETURN public.create_farmer_return_v1(p_payload);
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_farmer_payment_v2(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_farmer_return_v1(UUID, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
