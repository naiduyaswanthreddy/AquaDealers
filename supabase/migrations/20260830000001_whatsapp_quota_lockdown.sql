-- =============================================================================
-- Lock down the WhatsApp quota tables added in 20260830000000.
-- They were created without RLS — on this project every other table gets
-- RLS explicitly (see 002_rls.sql), and Supabase's default grants otherwise
-- leave new tables fully readable/writable by anon+authenticated. Also closes
-- a direct hole: dealers already have blanket UPDATE on their own `dealers`
-- row (self profile-edit), which let them silently self-assign any plan by
-- editing whatsapp_addon_plan_id/whatsapp_enabled directly via REST.
-- =============================================================================

ALTER TABLE whatsapp_addon_plans ENABLE ROW LEVEL SECURITY;

-- Same convention as plan_definitions: shared read-only catalog, no direct
-- write policy — all writes go through the SECURITY DEFINER admin RPC.
CREATE POLICY whatsapp_addon_plans_select ON whatsapp_addon_plans
  FOR SELECT TO authenticated USING (true);

ALTER TABLE whatsapp_message_usage ENABLE ROW LEVEL SECURITY;

-- No direct access at all — read via get_my_whatsapp_usage(), write via
-- check_and_increment_whatsapp_usage()/admin_set_dealer_whatsapp_addon(),
-- both SECURITY DEFINER (same pattern as admin_sessions/staff_login_attempts).
CREATE POLICY whatsapp_message_usage_no_access ON whatsapp_message_usage
  FOR ALL USING (false);

-- Dealers can update their own `dealers` row (profile edit), but must not be
-- able to grant themselves a plan or flip the enabled switch directly.
-- A column-level REVOKE would be a no-op here: dealers already hold a
-- table-level UPDATE grant (self profile-edit), and Postgres OR's table-level
-- and column-level ACLs, so the broader grant would still let it through.
-- A trigger that only lets a privileged (SECURITY DEFINER) caller change
-- these two columns is what actually enforces it.
CREATE OR REPLACE FUNCTION public.protect_whatsapp_addon_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.whatsapp_enabled := OLD.whatsapp_enabled;
    NEW.whatsapp_addon_plan_id := OLD.whatsapp_addon_plan_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_whatsapp_addon_columns ON dealers;
CREATE TRIGGER trg_protect_whatsapp_addon_columns
BEFORE UPDATE ON dealers
FOR EACH ROW
EXECUTE FUNCTION public.protect_whatsapp_addon_columns();

-- Bug fix: the original version deleted the current period's usage row on
-- EVERY call, so toggling `enabled` off/on without changing the plan reset
-- the dealer's count for free. Reset should only follow an actual plan swap.
CREATE OR REPLACE FUNCTION public.admin_set_dealer_whatsapp_addon(
  p_admin_id UUID,
  p_dealer_id UUID,
  p_plan_id UUID,
  p_enabled BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_old_plan_id UUID;
BEGIN
  PERFORM admin_assert_access(p_admin_id);

  SELECT whatsapp_addon_plan_id INTO v_old_plan_id FROM dealers WHERE id = p_dealer_id;

  UPDATE dealers
     SET whatsapp_addon_plan_id = p_plan_id,
         whatsapp_enabled = p_enabled
   WHERE id = p_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  IF v_old_plan_id IS DISTINCT FROM p_plan_id THEN
    DELETE FROM whatsapp_message_usage WHERE dealer_id = p_dealer_id AND period = v_period;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'set_dealer_whatsapp_addon', 'dealer', p_dealer_id,
          jsonb_build_object('plan_id', p_plan_id, 'enabled', p_enabled));
END;
$$;
