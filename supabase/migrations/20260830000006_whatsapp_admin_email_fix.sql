-- admin_audit_log.admin_email is NOT NULL (see 019_admin_extend_subscription_audit_fix.sql,
-- which already fixed this exact bug once for a different RPC). My three
-- WhatsApp admin RPCs discarded admin_assert_access's return value instead of
-- capturing it, so none of them supplied admin_email. Fixing all three.

CREATE OR REPLACE FUNCTION public.admin_upsert_whatsapp_plan(
  p_admin_id UUID,
  p_id UUID,
  p_name TEXT,
  p_monthly_limit INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_id UUID;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  IF p_id IS NULL THEN
    INSERT INTO whatsapp_addon_plans (name, monthly_limit)
    VALUES (p_name, p_monthly_limit)
    RETURNING id INTO v_id;
  ELSE
    UPDATE whatsapp_addon_plans SET name = p_name, monthly_limit = p_monthly_limit
     WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Plan not found';
    END IF;
  END IF;

  INSERT INTO admin_audit_log (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (v_admin.id, v_admin.email, 'upsert_whatsapp_plan', 'whatsapp_addon_plan', v_id,
          jsonb_build_object('name', p_name, 'monthly_limit', p_monthly_limit));

  RETURN v_id;
END;
$$;

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
  v_admin admin_users%ROWTYPE;
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_old_plan_id UUID;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

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

  INSERT INTO admin_audit_log (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (v_admin.id, v_admin.email, 'set_dealer_whatsapp_addon', 'dealer', p_dealer_id,
          jsonb_build_object('plan_id', p_plan_id, 'enabled', p_enabled));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_whatsapp_price(p_admin_id UUID, p_price NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);
  UPDATE whatsapp_platform_settings SET price_per_message = p_price, updated_at = now() WHERE id = true;

  INSERT INTO admin_audit_log (admin_id, admin_email, action, target_type, target_id, details)
  VALUES (v_admin.id, v_admin.email, 'set_whatsapp_price', 'whatsapp_platform_settings', NULL,
          jsonb_build_object('price_per_message', p_price));
END;
$$;
