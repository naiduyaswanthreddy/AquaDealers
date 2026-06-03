-- =============================================================================
-- AquaDealer Security Patch
-- Migration 015: Patch admin_assert_access to enforce auth.uid() matching
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_assert_access(p_admin_id UUID)
RETURNS admin_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin session missing';
  END IF;

  -- CRITICAL SECURITY FIX: Ensure the requested admin ID matches the authenticated user's JWT
  IF auth.uid() IS NULL OR auth.uid() != p_admin_id THEN
    RAISE EXCEPTION 'Unauthorized: Admin session mismatch or missing JWT';
  END IF;

  SELECT *
  INTO v_admin
  FROM admin_users
  WHERE id = p_admin_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin access denied';
  END IF;

  RETURN v_admin;
END;
$$;
