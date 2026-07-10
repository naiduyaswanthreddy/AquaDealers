-- =============================================================================
-- STAFF & ADMIN SESSION SECURITY
--
-- Fixes the two critical findings from the staff/security audit:
--
-- 1. Staff had no database identity: with no dealer logged in, RLS blocked
--    everything (staff mode non-functional standalone); with a dealer logged
--    in on the same device, staff inherited the dealer's FULL privileges and
--    could write into the wrong shop. Staff logins were also brute-forceable
--    (4-digit PIN, anon RPC, no rate limit) and never revocable.
--
-- 2. admin_assert_access (since migration 016) trusted any caller who knew an
--    admin UUID — every admin RPC was effectively open to anonymous users.
--
-- Mechanism: real server-side sessions. Login RPCs mint a session token; the
-- client sends it on every request via the x-staff-token / x-admin-token
-- header; SECURITY DEFINER helpers resolve the header to a validated session,
-- and RLS policies + assert functions enforce it.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SESSION TABLES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours',
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS staff_sessions_staff_idx ON public.staff_sessions(staff_id);
CREATE INDEX IF NOT EXISTS staff_sessions_dealer_idx ON public.staff_sessions(dealer_id);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_sessions_dealer_all ON public.staff_sessions;
CREATE POLICY staff_sessions_dealer_all ON public.staff_sessions
  FOR ALL USING (dealer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours',
  revoked BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_sessions_no_access ON public.admin_sessions;
CREATE POLICY admin_sessions_no_access ON public.admin_sessions
  FOR ALL USING (false);

-- Failed staff-login throttling (per shop).
CREATE TABLE IF NOT EXISTS public.staff_login_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dealer_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_login_attempts_dealer_time_idx
  ON public.staff_login_attempts(dealer_id, attempted_at);

ALTER TABLE public.staff_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_login_attempts_no_access ON public.staff_login_attempts;
CREATE POLICY staff_login_attempts_no_access ON public.staff_login_attempts
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HEADER → SESSION RESOLUTION HELPERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_header_uuid(p_header TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_raw TEXT;
BEGIN
  v_raw := NULLIF(current_setting('request.headers', true), '');
  IF v_raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN NULLIF(v_raw::json ->> p_header, '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Resolves the x-staff-token header to the staff's dealer id, or NULL when no
-- valid (unexpired, unrevoked, active-staff) session is presented.
CREATE OR REPLACE FUNCTION public.staff_dealer_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_dealer UUID;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ss.dealer_id
    INTO v_dealer
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token = v_token
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN v_dealer;
END;
$$;

-- True when the presented staff session may work in the given branch
-- (empty branch_ids on the staff record = all branches).
CREATE OR REPLACE FUNCTION public.staff_can_access_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_ok BOOLEAN;
BEGIN
  IF p_branch_id IS NULL THEN
    RETURN true;
  END IF;

  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT (COALESCE(array_length(sm.branch_ids, 1), 0) = 0 OR p_branch_id = ANY(sm.branch_ids))
    INTO v_ok
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token = v_token
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN COALESCE(v_ok, false);
END;
$$;

-- Permission check for direct table writes gated by a staff module permission.
CREATE OR REPLACE FUNCTION public.staff_has_permission(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID;
  v_ok BOOLEAN;
BEGIN
  v_token := public.request_header_uuid('x-staff-token');
  IF v_token IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(sm.permissions ->> p_key, 'hidden') = 'visible'
    INTO v_ok
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token = v_token
     AND NOT ss.revoked
     AND ss.expires_at > now()
     AND sm.is_active;

  RETURN COALESCE(v_ok, false);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. DEALER ACCESS ASSERTION NOW ACCEPTS VALID STAFF SESSIONS
--    (all billing/purchase/report RPCs call this)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assert_dealer_access(p_dealer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = p_dealer_id THEN
    RETURN;
  END IF;

  IF public.staff_dealer_id() = p_dealer_id THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Dealer access denied';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. STAFF LOGIN v2 — rate limited, mints a session token
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.staff_portal_login(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.staff_portal_login(
  p_shop_slug TEXT,
  p_branch_slug TEXT,
  p_pin_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_context JSONB;
  v_dealer_id UUID;
  v_branch_id UUID;
  v_staff public.staff_members%ROWTYPE;
  v_recent_failures INT;
  v_session_token UUID;
BEGIN
  v_context := public.staff_portal_context(p_shop_slug, p_branch_slug);
  v_dealer_id := (v_context->>'dealerId')::UUID;
  v_branch_id := (v_context->>'branchId')::UUID;

  -- Throttle: max 8 failed attempts per shop per 15 minutes.
  SELECT count(*)
    INTO v_recent_failures
    FROM staff_login_attempts
   WHERE dealer_id = v_dealer_id
     AND NOT success
     AND attempted_at > now() - interval '15 minutes';

  IF v_recent_failures >= 8 THEN
    RAISE EXCEPTION 'Too many wrong attempts. Please wait 15 minutes and try again.';
  END IF;

  -- Opportunistic cleanup of old attempt rows.
  DELETE FROM staff_login_attempts WHERE attempted_at < now() - interval '2 days';

  SELECT *
  INTO v_staff
  FROM public.staff_members
  WHERE dealer_id = v_dealer_id
    AND is_active = true
    AND pin_hash = p_pin_hash
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

  INSERT INTO staff_sessions (staff_id, dealer_id, branch_id)
  VALUES (v_staff.id, v_dealer_id, v_branch_id)
  RETURNING token INTO v_session_token;

  RETURN v_context || jsonb_build_object(
    'sessionToken', v_session_token,
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

-- Session revalidation for the client (app start / tab focus).
CREATE OR REPLACE FUNCTION public.staff_validate_session(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT sm.id, sm.name, sm.phone, sm.branch_ids, sm.permissions, ss.dealer_id, ss.branch_id
    INTO v_row
    FROM staff_sessions ss
    JOIN staff_members sm ON sm.id = ss.staff_id
   WHERE ss.token = p_token
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

-- Auto-revoke sessions when a staff member is deactivated or their PIN resets.
CREATE OR REPLACE FUNCTION public.revoke_staff_sessions_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.is_active AND NOT NEW.is_active) OR (NEW.pin_hash IS DISTINCT FROM OLD.pin_hash) THEN
    UPDATE staff_sessions
       SET revoked = true
     WHERE staff_id = NEW.id
       AND NOT revoked;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_staff_sessions ON public.staff_members;
CREATE TRIGGER trg_revoke_staff_sessions
AFTER UPDATE ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.revoke_staff_sessions_on_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STAFF RLS POLICIES (additive — OR'ed with the dealer policies)
--    Shop-scoped reads for the data the staff UI uses; branch-checked writes.
--    Cash book & expense writes additionally require the module permission.
-- ─────────────────────────────────────────────────────────────────────────────

-- Branches (read: needed for branch selector)
DROP POLICY IF EXISTS branches_staff_select ON branches;
CREATE POLICY branches_staff_select ON branches
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Farmers
DROP POLICY IF EXISTS farmers_staff_select ON farmers;
CREATE POLICY farmers_staff_select ON farmers
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS farmers_staff_insert ON farmers;
CREATE POLICY farmers_staff_insert ON farmers
  FOR INSERT WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS farmers_staff_update ON farmers;
CREATE POLICY farmers_staff_update ON farmers
  FOR UPDATE USING (dealer_id = public.staff_dealer_id());

-- Products (catalog is readable by any valid staff session)
DROP POLICY IF EXISTS products_staff_select ON products;
CREATE POLICY products_staff_select ON products
  FOR SELECT USING (public.staff_dealer_id() IS NOT NULL);

-- Plan definitions (needed by plan gates in the staff UI shell)
DROP POLICY IF EXISTS plan_definitions_staff_select ON plan_definitions;
CREATE POLICY plan_definitions_staff_select ON plan_definitions
  FOR SELECT USING (public.staff_dealer_id() IS NOT NULL);

-- Suppliers
DROP POLICY IF EXISTS suppliers_staff_select ON suppliers;
CREATE POLICY suppliers_staff_select ON suppliers
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Inventory + lots + movements
DROP POLICY IF EXISTS inventory_staff_select ON inventory;
CREATE POLICY inventory_staff_select ON inventory
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS inventory_lots_staff_select ON inventory_lots;
CREATE POLICY inventory_lots_staff_select ON inventory_lots
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS inventory_movements_staff_select ON inventory_movements;
CREATE POLICY inventory_movements_staff_select ON inventory_movements
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Bills + items + signatures + payments (reads; writes go through RPCs)
DROP POLICY IF EXISTS bills_staff_select ON bills;
CREATE POLICY bills_staff_select ON bills
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS bill_items_staff_select ON bill_items;
CREATE POLICY bill_items_staff_select ON bill_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_items.bill_id
        AND bills.dealer_id = public.staff_dealer_id()
    )
  );

DROP POLICY IF EXISTS bill_signatures_staff_select ON bill_signatures;
CREATE POLICY bill_signatures_staff_select ON bill_signatures
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS bill_signatures_staff_insert ON bill_signatures;
CREATE POLICY bill_signatures_staff_insert ON bill_signatures
  FOR INSERT WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS payments_staff_select ON payments;
CREATE POLICY payments_staff_select ON payments
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Purchases & supplier payments (reads)
DROP POLICY IF EXISTS stock_purchases_staff_select ON stock_purchases;
CREATE POLICY stock_purchases_staff_select ON stock_purchases
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

DROP POLICY IF EXISTS supplier_payments_staff_select ON supplier_payments;
CREATE POLICY supplier_payments_staff_select ON supplier_payments
  FOR SELECT USING (dealer_id = public.staff_dealer_id());

-- Cash book & expenses: reads shop-scoped; writes require the module permission
DROP POLICY IF EXISTS cash_book_staff_select ON cash_book;
CREATE POLICY cash_book_staff_select ON cash_book
  FOR SELECT USING (
    dealer_id = public.staff_dealer_id()
    AND public.staff_has_permission('cashbook')
  );

DROP POLICY IF EXISTS cash_book_staff_insert ON cash_book;
CREATE POLICY cash_book_staff_insert ON cash_book
  FOR INSERT WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_has_permission('cashbook')
    AND public.staff_can_access_branch(branch_id)
  );

DROP POLICY IF EXISTS expenses_staff_select ON expenses;
CREATE POLICY expenses_staff_select ON expenses
  FOR SELECT USING (
    dealer_id = public.staff_dealer_id()
    AND public.staff_has_permission('expenses')
  );

DROP POLICY IF EXISTS expenses_staff_insert ON expenses;
CREATE POLICY expenses_staff_insert ON expenses
  FOR INSERT WITH CHECK (
    dealer_id = public.staff_dealer_id()
    AND public.staff_has_permission('expenses')
    AND public.staff_can_access_branch(branch_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADMIN SESSIONS — close the anon-admin hole from migration 016
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_login(TEXT, TEXT);

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
  v_token UUID;
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

  INSERT INTO admin_sessions (admin_id)
  VALUES (v_admin.id)
  RETURNING token INTO v_token;

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
    v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon, authenticated, service_role;

-- admin_assert_access now requires a valid admin session token whose admin
-- matches the p_admin_id every admin RPC already passes.
CREATE OR REPLACE FUNCTION public.admin_assert_access(p_admin_id UUID)
RETURNS admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_token UUID;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin session missing';
  END IF;

  v_token := public.request_header_uuid('x-admin-token');
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Admin session missing. Please sign in again.';
  END IF;

  SELECT a.*
    INTO v_admin
    FROM admin_sessions s
    JOIN admin_users a ON a.id = s.admin_id
   WHERE s.token = v_token
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

NOTIFY pgrst, 'reload schema';
