-- =============================================================================
-- AquaDealer Security Patch Revert
-- Migration 016: Revert admin_assert_access to allow custom admin login
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
