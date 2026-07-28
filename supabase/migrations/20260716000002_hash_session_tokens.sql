-- =============================================================================
-- HASH STAFF & ADMIN SESSION TOKENS
--
-- Migration 20260710000004 stored session tokens in plaintext as the primary
-- key of staff_sessions / admin_sessions. Anyone with DB read access could
-- lift a live token and impersonate the session.
--
-- Fix: store SHA-256 hex of the UUID, not the UUID itself. Login mints a
-- random UUID, returns it to the client once, and persists only the hash.
-- Every lookup helper hashes the inbound x-staff-token / x-admin-token header
-- before comparing.
--
-- Wire format (UUID in the header) is unchanged — no client update needed.
-- Existing sessions are wiped on migrate: staff and admins re-login. That is
-- deliberate; every plaintext token that was in the DB must be treated as
-- burned.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REBUILD SESSION TABLES WITH token_hash
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.staff_sessions CASCADE;
DROP TABLE IF EXISTS public.admin_sessions CASCADE;

CREATE TABLE public.staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours',
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX staff_sessions_staff_idx ON public.staff_sessions(staff_id);
CREATE INDEX staff_sessions_dealer_idx ON public.staff_sessions(dealer_id);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_sessions_dealer_all ON public.staff_sessions
  FOR ALL USING (dealer_id = auth.uid());

CREATE TABLE public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours',
  revoked BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_sessions_no_access ON public.admin_sessions
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HEADER → SESSION HELPERS (hash before compare)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_dealer_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token UUID;
  v_hash  TEXT;
  v_dealer UUID;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;
  v_hash := encode(extensions.digest(v_token::text, 'sha256'), 'hex');

  SELECT ss.dealer_id
    INTO v_dealer
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token_hash = v_hash
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN v_dealer;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_can_access_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token UUID;
  v_hash  TEXT;
  v_ok BOOLEAN;
BEGIN
  IF p_branch_id IS NULL THEN
    RETURN true;
  END IF;

  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN false;
  END IF;
  v_hash := encode(extensions.digest(v_token::text, 'sha256'), 'hex');

  SELECT (COALESCE(array_length(sm.branch_ids, 1), 0) = 0 OR p_branch_id = ANY(sm.branch_ids))
    INTO v_ok
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token_hash = v_hash
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN COALESCE(v_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_has_permission(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token UUID;
  v_hash  TEXT;
  v_ok BOOLEAN;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN false;
  END IF;
  v_hash := encode(extensions.digest(v_token::text, 'sha256'), 'hex');

  SELECT COALESCE(sm.permissions ->> p_key, 'hidden') = 'visible'
    INTO v_ok
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token_hash = v_hash
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN COALESCE(v_ok, false);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. STAFF LOGIN & VALIDATE — mint UUID, store hash, return raw once
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTE: signature reconciled with the bcrypt migration (20260710000011).
-- Accepts raw PIN and bcrypt-compares; the SHA-256 client-hash path is dead.
DROP FUNCTION IF EXISTS public.staff_portal_login(TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.staff_portal_login(
  p_shop_slug TEXT,
  p_branch_slug TEXT,
  p_pin TEXT
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
  v_recent_failures INT;
  v_raw_token UUID;
BEGIN
  v_context := public.staff_portal_context(p_shop_slug, p_branch_slug);
  v_dealer_id := (v_context->>'dealerId')::UUID;
  v_branch_id := (v_context->>'branchId')::UUID;

  SELECT count(*)
    INTO v_recent_failures
    FROM staff_login_attempts
   WHERE dealer_id = v_dealer_id
     AND NOT success
     AND attempted_at > now() - interval '15 minutes';

  IF v_recent_failures >= 8 THEN
    RAISE EXCEPTION 'Too many wrong attempts. Please wait 15 minutes and try again.';
  END IF;

  DELETE FROM staff_login_attempts WHERE attempted_at < now() - interval '2 days';

  SELECT *
  INTO v_staff
  FROM public.staff_members
  WHERE dealer_id = v_dealer_id
    AND is_active = true
    AND pin_hash IS NOT NULL
    AND pin_hash = extensions.crypt(p_pin, pin_hash)
    AND (
      COALESCE(array_length(branch_ids, 1), 0) = 0
      OR v_branch_id = ANY(branch_ids)
    )
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO staff_login_attempts (dealer_id, success) VALUES (v_dealer_id, false);
    RAISE EXCEPTION 'Invalid PIN or access denied';
  END IF;

  INSERT INTO staff_login_attempts (dealer_id, success) VALUES (v_dealer_id, true);

  UPDATE public.staff_members
  SET last_login_at = now()
  WHERE id = v_staff.id;

  v_raw_token := gen_random_uuid();

  INSERT INTO staff_sessions (token_hash, staff_id, dealer_id, branch_id)
  VALUES (
    encode(extensions.digest(v_raw_token::text, 'sha256'), 'hex'),
    v_staff.id, v_dealer_id, v_branch_id
  );

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

GRANT EXECUTE ON FUNCTION public.staff_portal_login(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_validate_session(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_row RECORD;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;
  v_hash := encode(extensions.digest(p_token::text, 'sha256'), 'hex');

  SELECT sm.id, sm.name, sm.phone, sm.branch_ids, sm.permissions, ss.dealer_id, ss.branch_id
    INTO v_row
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token_hash = v_hash
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'staffId', v_row.id,
    'name', v_row.name,
    'phone', v_row.phone,
    'dealerId', v_row.dealer_id,
    'branchId', v_row.branch_id,
    'branchIds', to_jsonb(v_row.branch_ids),
    'permissions', v_row.permissions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_validate_session(UUID) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADMIN LOGIN & ACCESS ASSERT — same treatment
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_login(p_email TEXT, p_password TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  two_factor_enabled BOOLEAN,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  session_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_raw_token UUID;
BEGIN
  SELECT *
  INTO v_admin
  FROM admin_users
  WHERE lower(admin_users.email) = lower(trim(p_email))
    AND admin_users.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_admin.password_hash IS NULL OR v_admin.password_hash = '' THEN
    RETURN;
  END IF;

  IF v_admin.password_hash <> extensions.crypt(p_password, v_admin.password_hash) THEN
    RETURN;
  END IF;

  UPDATE admin_users
  SET last_login_at = now()
  WHERE admin_users.id = v_admin.id;

  v_raw_token := gen_random_uuid();

  INSERT INTO admin_sessions (token_hash, admin_id)
  VALUES (
    encode(extensions.digest(v_raw_token::text, 'sha256'), 'hex'),
    v_admin.id
  );

  RETURN QUERY
  SELECT
    v_admin.id,
    v_admin.name,
    v_admin.email,
    v_admin.role,
    v_admin.is_active,
    v_admin.two_factor_enabled,
    now(),
    v_admin.created_at,
    v_raw_token;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_assert_access(p_admin_id UUID)
RETURNS admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_token UUID;
  v_hash TEXT;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin session missing';
  END IF;

  v_token := public.request_header_uuid('x-admin-token');
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Admin session missing. Please sign in again.';
  END IF;
  v_hash := encode(extensions.digest(v_token::text, 'sha256'), 'hex');

  SELECT a.*
    INTO v_admin
    FROM admin_sessions s
    JOIN admin_users a ON a.id = s.admin_id
   WHERE s.token_hash = v_hash
     AND NOT s.revoked
     AND s.expires_at > now()
     AND a.is_active
     AND a.id = p_admin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin access denied';
  END IF;

  RETURN v_admin;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RECREATE TRIGGER (function survived, table was dropped so trigger did too)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_revoke_staff_sessions ON public.staff_members;
CREATE TRIGGER trg_revoke_staff_sessions
AFTER UPDATE ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.revoke_staff_sessions_on_change();

NOTIFY pgrst, 'reload schema';
