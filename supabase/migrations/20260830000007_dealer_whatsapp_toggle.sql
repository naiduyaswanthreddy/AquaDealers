-- Dealer-facing mute/unmute: the dealer can pause and resume notifications
-- themselves, but only admin can change the PLAN (that's what stops a dealer
-- from self-resetting their quota by switching plans, per the earlier fix in
-- 20260830000001). This RPC only ever touches `whatsapp_enabled`, scoped to
-- the caller's own dealer_id — the plan_id column is untouched.
CREATE OR REPLACE FUNCTION public.set_my_whatsapp_enabled(p_enabled BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  UPDATE dealers SET whatsapp_enabled = p_enabled WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_whatsapp_enabled(BOOLEAN) TO authenticated;
