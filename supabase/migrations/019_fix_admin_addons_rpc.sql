-- =============================================================================
-- AquaDealer Addons Fix
-- Migration 019: Fix RPC type casting for custom_features JSONB and Audit Log
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
  SET custom_features = to_jsonb(p_features)
  WHERE id = p_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  -- Log action correctly using the audit helper function
  PERFORM public.admin_record_audit_event(
    p_admin_id,
    'update_dealer_addons',
    'dealer',
    p_dealer_id,
    NULL,
    jsonb_build_object('new_features', p_features)
  );
END;
$$;
