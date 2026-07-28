-- =============================================================================
-- STAFF HARDENING + ARCHIVED_BILLS ADVISOR (2026-07-16)
--
-- 1. Per-staff access_token — dealer gets a per-staff URL. Rotating the token
--    revokes the leaked link. Without a valid token, staff_portal_context_v2
--    and staff_portal_login refuse to load — kills the anon shop-enumeration
--    hole and turns a leaked WhatsApp link into a revocable credential.
-- 2. Session TTL 12h → 4h (default). Client can still re-login when it
--    expires; XSS window shrinks by 3x.
-- 3. Per-IP rate limit — a new client_ip column on staff_login_attempts lets
--    the failed-login counter throttle by IP as well as by dealer, so parallel
--    attacks across shops from one IP are caught.
-- 4. archived_bills view was flagged by Supabase advisor (SECURITY DEFINER
--    view). Recreate with security_invoker=true so it enforces the caller's
--    RLS instead of the creator's.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. access_token per staff
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS access_token UUID;

UPDATE public.staff_members SET access_token = gen_random_uuid() WHERE access_token IS NULL;

ALTER TABLE public.staff_members
  ALTER COLUMN access_token SET NOT NULL,
  ALTER COLUMN access_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS staff_members_access_token_key ON public.staff_members(access_token);

-- Rotator RPC — dealer regenerates the token to revoke the outstanding link.
CREATE OR REPLACE FUNCTION public.rotate_staff_access_token(p_staff_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_new UUID := gen_random_uuid();
BEGIN
  UPDATE public.staff_members
     SET access_token = v_new
   WHERE id = p_staff_id
     AND dealer_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff member not found';
  END IF;
  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_staff_access_token(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Restricted context RPC that REQUIRES the access token
--    Old staff_portal_context stays (dealer code still uses it) but its GRANT
--    to anon is revoked — no more anonymous shop enumeration.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.staff_portal_context(TEXT, TEXT) FROM anon;

CREATE OR REPLACE FUNCTION public.staff_portal_context_v2(
  p_shop_slug TEXT,
  p_branch_slug TEXT,
  p_access_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_dealer dealers%ROWTYPE;
  v_branch branches%ROWTYPE;
  v_staff  staff_members%ROWTYPE;
  v_shop_slug   TEXT := public.slugify_text(p_shop_slug);
  v_branch_slug TEXT := public.slugify_text(p_branch_slug);
BEGIN
  IF p_access_token IS NULL THEN
    RAISE EXCEPTION 'Invalid staff link';
  END IF;

  SELECT * INTO v_staff
    FROM public.staff_members
   WHERE access_token = p_access_token
     AND is_active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid staff link';
  END IF;

  SELECT * INTO v_dealer FROM dealers
   WHERE id = v_staff.dealer_id
     AND is_active = true
     AND public.slugify_text(shop_name) = v_shop_slug
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid staff link';
  END IF;

  SELECT * INTO v_branch FROM branches
   WHERE dealer_id = v_dealer.id
     AND public.slugify_text(name) = v_branch_slug
     AND is_active = true
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  IF COALESCE(array_length(v_staff.branch_ids, 1), 0) > 0
     AND NOT (v_branch.id = ANY(v_staff.branch_ids)) THEN
    RAISE EXCEPTION 'Invalid staff link';
  END IF;

  RETURN jsonb_build_object(
    'dealerId',   v_dealer.id,
    'shopName',   v_dealer.shop_name,
    'branchId',   v_branch.id,
    'branchName', v_branch.name,
    'shopSlug',   v_shop_slug,
    'branchSlug', v_branch_slug,
    'staffName',  v_staff.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_portal_context_v2(TEXT, TEXT, UUID) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Per-IP rate limit — add IP column and extend the login RPC to check it
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_login_attempts
  ADD COLUMN IF NOT EXISTS client_ip INET;

-- Bump staff_portal_login to take the access token + IP and enforce per-IP throttling.
DROP FUNCTION IF EXISTS public.staff_portal_login(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.staff_portal_login(
  p_shop_slug TEXT,
  p_branch_slug TEXT,
  p_pin TEXT,
  p_access_token UUID DEFAULT NULL,
  p_client_ip TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_context JSONB;
  v_dealer_id UUID;
  v_branch_id UUID;
  v_staff public.staff_members%ROWTYPE;
  v_recent_dealer_fail INT;
  v_recent_ip_fail INT;
  v_ip INET := NULLIF(p_client_ip, '')::INET;
  v_raw_token UUID;
BEGIN
  IF p_access_token IS NULL THEN
    RAISE EXCEPTION 'Invalid staff link';
  END IF;

  v_context := public.staff_portal_context_v2(p_shop_slug, p_branch_slug, p_access_token);
  v_dealer_id := (v_context->>'dealerId')::UUID;
  v_branch_id := (v_context->>'branchId')::UUID;

  SELECT count(*) INTO v_recent_dealer_fail
    FROM staff_login_attempts
   WHERE dealer_id = v_dealer_id
     AND NOT success
     AND attempted_at > now() - interval '15 minutes';

  IF v_recent_dealer_fail >= 8 THEN
    RAISE EXCEPTION 'Too many wrong attempts. Please wait 15 minutes and try again.';
  END IF;

  IF v_ip IS NOT NULL THEN
    SELECT count(*) INTO v_recent_ip_fail
      FROM staff_login_attempts
     WHERE client_ip = v_ip
       AND NOT success
       AND attempted_at > now() - interval '15 minutes';
    IF v_recent_ip_fail >= 20 THEN
      RAISE EXCEPTION 'Too many wrong attempts from this network. Please wait 15 minutes.';
    END IF;
  END IF;

  DELETE FROM staff_login_attempts WHERE attempted_at < now() - interval '2 days';

  SELECT * INTO v_staff
    FROM public.staff_members
   WHERE dealer_id = v_dealer_id
     AND is_active = true
     AND access_token = p_access_token
     AND pin_hash IS NOT NULL
     AND pin_hash = extensions.crypt(p_pin, pin_hash)
     AND (
       COALESCE(array_length(branch_ids, 1), 0) = 0
       OR v_branch_id = ANY(branch_ids)
     )
   ORDER BY created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO staff_login_attempts (dealer_id, success, client_ip)
    VALUES (v_dealer_id, false, v_ip);
    RAISE EXCEPTION 'Invalid PIN or access denied';
  END IF;

  INSERT INTO staff_login_attempts (dealer_id, success, client_ip)
  VALUES (v_dealer_id, true, v_ip);

  UPDATE public.staff_members SET last_login_at = now() WHERE id = v_staff.id;

  v_raw_token := gen_random_uuid();
  INSERT INTO staff_sessions (token_hash, staff_id, dealer_id, branch_id)
  VALUES (encode(extensions.digest(v_raw_token::text, 'sha256'), 'hex'),
          v_staff.id, v_dealer_id, v_branch_id);

  RETURN v_context || jsonb_build_object(
    'sessionToken', v_raw_token,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'phone', v_staff.phone,
      'branchIds', to_jsonb(v_staff.branch_ids),
      'permissions', v_staff.permissions,
      'defaultRoute', CASE
        WHEN COALESCE((v_staff.permissions->>'newBill'), 'hidden') = 'visible' THEN '/bills/new'
        WHEN COALESCE((v_staff.permissions->>'addFarmer'), 'hidden') = 'visible' THEN '/farmers/new'
        WHEN COALESCE((v_staff.permissions->>'billHistory'), 'hidden') = 'visible' THEN '/bills'
        WHEN COALESCE((v_staff.permissions->>'farmerList'), 'hidden') = 'visible' THEN '/farmers'
        ELSE '/more'
      END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_portal_login(TEXT, TEXT, TEXT, UUID, TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Session TTL 12h → 4h (default). Existing rows are unaffected; new
--    sessions minted after this migration expire in 4h.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_sessions
  ALTER COLUMN expires_at SET DEFAULT now() + interval '4 hours';

ALTER TABLE public.admin_sessions
  ALTER COLUMN expires_at SET DEFAULT now() + interval '4 hours';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. archived_bills — Supabase advisor flagged this as a SECURITY DEFINER view.
--    Recreate with security_invoker=true so the view enforces the caller's
--    RLS (not the creator's).
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.archived_bills;
CREATE VIEW public.archived_bills WITH (security_invoker = true) AS
  SELECT * FROM bills
   WHERE bill_date < (CURRENT_DATE - INTERVAL '2 years')
     AND deleted_at IS NULL;

COMMENT ON VIEW public.archived_bills IS
  'Read-only view of bills older than 2 years. security_invoker=true so it enforces the caller''s RLS. For reporting only.';

NOTIFY pgrst, 'reload schema';
