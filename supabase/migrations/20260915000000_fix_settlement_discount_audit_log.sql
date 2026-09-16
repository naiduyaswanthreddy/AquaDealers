-- =============================================================================
-- Fix apply_settlement_discount_v1 audit log insert (2026-09-15)
--
-- 20260725000000_settlement_discount.sql inserted into bill_audit_logs using
-- columns (action, old_value, new_value) that were never part of that table.
-- The table (see 20260621000001_edit_bill_support.sql) only has
-- (bill_id, dealer_id, user_id, changes_jsonb). Every settlement discount
-- attempt has been failing with:
--   column "action" of relation "bill_audit_logs" does not exist
--
-- Fix: reissue the function with the insert matching the real schema, same
-- shape edit_bill_v1 already uses.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.apply_settlement_discount_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill           bills%ROWTYPE;
  v_dealer_id      UUID;
  v_bill_id        UUID;
  v_amount         NUMERIC(12,2);
  v_reason         TEXT;
  v_old_settlement NUMERIC(12,2);
  v_delta          NUMERIC(12,2);
  v_new_balance    NUMERIC(12,2);
  v_user_id        UUID := auth.uid();
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  v_bill_id   := (p_payload->>'bill_id')::UUID;
  v_amount    := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_reason    := NULLIF(p_payload->>'reason', '');

  PERFORM public.assert_dealer_access(v_dealer_id);

  SELECT * INTO v_bill
  FROM bills
  WHERE id = v_bill_id AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;
  IF v_bill.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot apply settlement discount to a cancelled bill';
  END IF;
  IF v_amount < 0 THEN
    RAISE EXCEPTION 'Settlement discount cannot be negative';
  END IF;
  IF v_amount > v_bill.total THEN
    RAISE EXCEPTION 'Settlement discount cannot exceed bill total';
  END IF;
  IF (v_bill.total - v_amount) < v_bill.amount_paid THEN
    RAISE EXCEPTION 'Settlement discount cannot reduce effective total below amount already paid';
  END IF;

  v_old_settlement := COALESCE(v_bill.settlement_discount_amount, 0);
  v_delta          := v_amount - v_old_settlement;
  v_new_balance    := GREATEST(v_bill.total - v_amount - v_bill.amount_paid, 0);

  UPDATE bills
  SET settlement_discount_amount = v_amount,
      settlement_discount_reason = v_reason,
      balance_due                = v_new_balance
  WHERE id = v_bill_id;

  IF v_bill.farmer_id IS NOT NULL THEN
    UPDATE farmers
    SET total_due = total_due - v_delta
    WHERE id = v_bill.farmer_id AND dealer_id = v_dealer_id;
  END IF;

  INSERT INTO bill_audit_logs (bill_id, dealer_id, user_id, changes_jsonb)
  VALUES (
    v_bill_id,
    v_dealer_id,
    v_user_id,
    jsonb_build_object(
      'action', 'settlement_discount_applied',
      'old_settlement_discount_amount', v_old_settlement,
      'new_settlement_discount_amount', v_amount,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'bill_id',                    v_bill_id,
    'settlement_discount_amount', v_amount,
    'balance_due',                v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_settlement_discount_v1(JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
