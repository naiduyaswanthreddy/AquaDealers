-- =============================================================================
-- OFFLINE BILLING SYNC
-- Adds an idempotency reference to bills so bills created offline and synced
-- later can never be double-created, plus a sync RPC that wraps create_bill_v2.
-- =============================================================================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS client_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS bills_dealer_client_ref_key
  ON bills (dealer_id, client_ref)
  WHERE client_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_bill_offline_sync(
  p_payload JSONB,
  p_client_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_existing RECORD;
  v_result JSONB;
BEGIN
  v_dealer_id := (p_payload->>'dealer_id')::UUID;
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF p_client_ref IS NULL OR length(trim(p_client_ref)) = 0 THEN
    RAISE EXCEPTION 'client_ref is required for offline sync';
  END IF;

  -- Idempotency: if this offline bill was already synced, return the existing
  -- bill instead of creating a duplicate.
  SELECT id, bill_number, balance_due, subtotal, gst_amount, total
    INTO v_existing
    FROM bills
   WHERE dealer_id = v_dealer_id
     AND client_ref = p_client_ref
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'bill_id', v_existing.id,
      'bill_number', v_existing.bill_number,
      'balance_due', v_existing.balance_due,
      'subtotal', v_existing.subtotal,
      'gst_amount', v_existing.gst_amount,
      'total', v_existing.total,
      'already_synced', true
    );
  END IF;

  v_result := public.create_bill_v2(p_payload);

  -- Stamp the client ref; the partial unique index makes a concurrent
  -- double-sync fail loudly and roll back its duplicate bill.
  UPDATE bills
     SET client_ref = p_client_ref
   WHERE id = (v_result->>'bill_id')::UUID;

  RETURN v_result || jsonb_build_object('already_synced', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_bill_offline_sync(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bill_offline_sync(JSONB, TEXT) TO authenticated;
