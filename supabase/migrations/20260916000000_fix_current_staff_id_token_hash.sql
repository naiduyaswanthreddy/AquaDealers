-- Fix: current_staff_id() (added in 20260723000000_staff_transaction_filter.sql)
-- queried staff_sessions.token directly, comparing it to the raw x-staff-token
-- header. That column was dropped a week earlier in
-- 20260716000002_hash_session_tokens.sql, which rebuilt staff_sessions to
-- store only a sha256 token_hash — staff_dealer_id() was updated to hash the
-- header before comparing, but current_staff_id() was added after that
-- rewrite and never followed the same pattern.
--
-- Every staff purchase runs this via the transaction_event_stock_purchase
-- trigger (trg_transaction_event_purchase_v1 -> log_transaction_event_v1 ->
-- current_staff_id()), so any staff-recorded purchase failed outright with
-- "column ss.token does not exist" and rolled back the whole insert.

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token UUID;
  v_hash TEXT;
  v_staff_id UUID;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN RETURN NULL; END IF;
  v_hash := encode(extensions.digest(v_token::text, 'sha256'), 'hex');

  SELECT ss.staff_id INTO v_staff_id
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token_hash = v_hash
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN v_staff_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
