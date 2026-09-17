-- =============================================================================
-- offline_sync_already_exists_propagation — 2026-09-17
--
-- Follow-up to 20260917000001_bill_v2_idempotency_key.sql.
--
-- create_bill_offline_sync only ever checked its OWN client_ref before
-- deciding whether to call create_bill_v2, then unconditionally returned
-- 'already_synced': false whenever it went on to call create_bill_v2 — even
-- on the exact case 20260917000001 was written for, where create_bill_v2
-- itself found a pre-existing bill via idempotency_key and returned
-- 'already_exists': true without inserting anything.
--
-- The client (offlineBillStore.ts syncAll) uses 'already_synced' to decide
-- whether to fire the send-bill-whatsapp notification. With the old hardcoded
-- false, a bill deduped via idempotency_key still triggered a second
-- WhatsApp message to the farmer for a bill that was never actually
-- duplicated in the database — a real, if less severe, side effect of the
-- same flaky-connection retry sequence.
--
-- Fix: propagate create_bill_v2's own 'already_exists' into 'already_synced'
-- instead of hardcoding false.
-- =============================================================================

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

  -- create_bill_v2 may itself have deduped this bill via idempotency_key
  -- (a new client_ref from a retried request whose original response was
  -- lost, but whose payload — and idempotency_key — is unchanged). In that
  -- case this is a new client_ref for an already-existing bill: propagate
  -- that so callers don't treat it as a freshly created bill (e.g. re-notify
  -- the farmer over WhatsApp for a bill that already went out).
  RETURN v_result || jsonb_build_object(
    'already_synced', COALESCE((v_result->>'already_exists')::boolean, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_bill_offline_sync(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bill_offline_sync(JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
