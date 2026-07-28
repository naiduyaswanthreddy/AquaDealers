-- A farmer's previous due is the debt that existed before app records began.
-- Update the stored base amount and live due together so later bills/payments
-- remain intact when the base amount is corrected.
CREATE OR REPLACE FUNCTION public.set_farmer_previous_due(
  p_farmer_id UUID,
  p_previous_due NUMERIC
)
RETURNS public.farmers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := auth.uid();
  v_farmer public.farmers;
  v_previous_due NUMERIC := ROUND(COALESCE(p_previous_due, 0), 2);
BEGIN
  IF v_dealer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_previous_due < 0 THEN
    RAISE EXCEPTION 'Previous due cannot be negative';
  END IF;

  UPDATE public.farmers
  SET
    opening_balance = v_previous_due,
    total_due = GREATEST(
      0,
      COALESCE(total_due, 0) + v_previous_due - COALESCE(opening_balance, 0)
    )
  WHERE id = p_farmer_id
    AND dealer_id = v_dealer_id
  RETURNING * INTO v_farmer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Farmer not found';
  END IF;

  RETURN v_farmer;
END;
$$;

REVOKE ALL ON FUNCTION public.set_farmer_previous_due(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_farmer_previous_due(UUID, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';
