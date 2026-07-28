-- =============================================================================
-- STAFF PIN → SERVER-SIDE BCRYPT
--
-- Before: client SHA-256(pin) → sent as p_pin_hash → RPC compared to
-- staff_members.pin_hash. Two failures:
--   1. Anyone with SELECT on staff_members could replay the stored hash and
--      log in — no cracking required.
--   2. A 4-digit PIN space has 10k entries; an unsalted SHA-256 rainbow
--      table recovers every PIN instantly even without DB access.
--
-- After: client sends raw PIN over TLS; server bcrypt-hashes on write and
-- compares with crypt() on login (same pattern already used by admin_login).
-- All existing hashes are nulled and MUST be re-set by the dealer before the
-- staff can log in again.
--
-- Coupled deploy: this migration + the matching src/features/staff/services
-- change must ship together. Old client (SHA-256 hex) against new RPC = every
-- staff login fails; new client (raw PIN) against old RPC = staff PINs leak
-- into staff_login_attempts logs in cleartext.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Column shape: allow NULL to signal "PIN needs reset by dealer".
--    Drop the uniqueness index — bcrypt's random salt makes two hashes of the
--    same PIN differ, so the constraint no longer catches duplicates.
--    Duplicate-PIN rejection moves into the write trigger below.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_members
  ALTER COLUMN pin_hash DROP NOT NULL;

DROP INDEX IF EXISTS public.uq_staff_members_dealer_pin_hash;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Null every existing hash. All old SHA-256 values are unusable now.
--    The trg_revoke_staff_sessions trigger (migration 20260710000004) sees
--    pin_hash change from OLD to NEW and revokes every live staff session for
--    that staff member. Dealers must re-set each staff PIN from their staff
--    management UI.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.staff_members SET pin_hash = NULL WHERE pin_hash IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BEFORE-write trigger: bcrypt-hash raw PINs and reject sibling duplicates.
--    A value that already looks like a bcrypt hash ($2a/$2b/$2y) passes
--    through unchanged so migration-time rewrites or manual admin edits are
--    idempotent. NULL passes through (means "PIN cleared / needs reset").
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_hash_pin_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.pin_hash IS NULL THEN
    RETURN NEW;
  END IF;

  -- Already bcrypt-formatted → pass through unchanged.
  IF NEW.pin_hash ~ '^\$2[aby]\$' THEN
    RETURN NEW;
  END IF;

  -- Raw PIN: reject if it matches any sibling staff's stored hash for the
  -- same dealer. Preserves the 23505 code so the frontend's friendly-error
  -- mapping ("This PIN is already used by another staff member...") still
  -- fires.
  IF EXISTS (
    SELECT 1
      FROM public.staff_members sm
     WHERE sm.dealer_id = NEW.dealer_id
       AND sm.id IS DISTINCT FROM NEW.id
       AND sm.pin_hash IS NOT NULL
       AND sm.pin_hash = extensions.crypt(NEW.pin_hash, sm.pin_hash)
  ) THEN
    RAISE EXCEPTION 'This PIN is already used by another staff member.'
      USING ERRCODE = '23505';
  END IF;

  NEW.pin_hash := extensions.crypt(NEW.pin_hash, extensions.gen_salt('bf'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_hash_pin ON public.staff_members;
CREATE TRIGGER trg_staff_hash_pin
BEFORE INSERT OR UPDATE OF pin_hash ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.staff_hash_pin_on_write();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Replace staff_portal_login: raw PIN in, bcrypt compare server-side.
--    Keeps the rate-limit and session-mint behaviour from migration
--    20260710000004. NULL pin_hash rows can never match (crypt() with a NULL
--    salt returns NULL).
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_session_token UUID;
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

  -- Iterate candidates for this shop/branch and bcrypt-compare each.
  -- Set is small (staff per shop), so the per-row crypt() cost is negligible.
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

NOTIFY pgrst, 'reload schema';
