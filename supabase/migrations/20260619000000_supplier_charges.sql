-- =============================================================================
-- AquaDealer Add Supplier Charge
-- Migration 025: Add supplier charge RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_supplier_charge(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_supplier_id UUID := (p_payload->>'supplier_id')::UUID;
  v_amount NUMERIC(12,2) := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_notes TEXT := NULLIF(p_payload->>'notes', '');
  v_charge_id UUID;
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Supplier charge amount must be greater than zero';
  END IF;

  -- Just to log the charge, we can insert into supplier_payments with a negative amount 
  -- but since negative amount throws error in payment_v2, we'll insert manually here
  -- Or just update the total due if a full ledger isn't strictly required for charges yet.
  
  -- Add to supplier total due
  UPDATE suppliers
  SET total_due = COALESCE(total_due, 0) + v_amount
  WHERE id = v_supplier_id
    AND dealer_id = v_dealer_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_supplier_charge(JSONB) TO authenticated;
