-- =============================================================================
-- AquaDealer Addons Support
-- Migration 017: RPC for admin to update dealer custom_features
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_dealer_addons(
  p_admin_id UUID,
  p_dealer_id UUID,
  p_features TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin access
  PERFORM admin_assert_access(p_admin_id);

  UPDATE dealers
  SET custom_features = p_features
  WHERE id = p_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  -- Log action
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    p_admin_id,
    'update_dealer_addons',
    'dealer',
    p_dealer_id,
    jsonb_build_object('new_features', p_features)
  );
END;
$$;
