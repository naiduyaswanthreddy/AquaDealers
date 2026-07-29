-- Writes off all remaining open bill balances for a farmer as settlement discount.
-- Called after a partial payment when the dealer wants to zero out the remaining due
-- (e.g. farmer owes 10200, pays 10000, dealer settles the ₹200 gap).
--
-- Finds every bill for this farmer with balance_due > 0 (not cancelled, not deleted),
-- adds balance_due to settlement_discount_amount, zeroes balance_due, then
-- recalculates farmers.total_due from remaining bill balances.
-- Writes one audit log entry per bill settled.
-- Returns the total amount settled across all bills.

CREATE OR REPLACE FUNCTION public.settle_farmer_remaining_balance(
  p_dealer_id UUID,
  p_farmer_id UUID,
  p_reason    TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r              RECORD;
  v_total        NUMERIC := 0;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  FOR r IN
    SELECT id, balance_due
    FROM bills
    WHERE dealer_id   = p_dealer_id
      AND farmer_id   = p_farmer_id
      AND balance_due > 0
      AND status     != 'cancelled'
      AND deleted_at  IS NULL
  LOOP
    UPDATE bills
    SET settlement_discount_amount = settlement_discount_amount + r.balance_due,
        balance_due                = 0,
        updated_at                 = now()
    WHERE id = r.id;

    INSERT INTO audit_logs (dealer_id, action, entity_type, entity_id, metadata)
    VALUES (
      p_dealer_id,
      'settlement_discount_applied',
      'bill',
      r.id,
      jsonb_build_object(
        'amount', r.balance_due,
        'reason', p_reason,
        'farmer_id', p_farmer_id
      )
    );

    v_total := v_total + r.balance_due;
  END LOOP;

  -- Recalculate farmer's total_due from remaining bill balances
  UPDATE farmers
  SET total_due  = COALESCE((
        SELECT SUM(balance_due)
        FROM bills
        WHERE dealer_id  = p_dealer_id
          AND farmer_id  = p_farmer_id
          AND status    != 'cancelled'
          AND deleted_at IS NULL
      ), 0),
      updated_at = now()
  WHERE id = p_farmer_id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_farmer_remaining_balance(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_farmer_remaining_balance(UUID, UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
