-- =============================================================================
-- WhatsApp messaging quota
-- Admin creates monthly-limit plans and assigns one (+ an on/off switch) to
-- each dealer. Usage is tracked per calendar-month period so a new month
-- resets for free (no cron job) and switching a dealer's plan deletes the
-- current period row so the new limit applies immediately, not next month.
-- =============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_addon_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  monthly_limit INT NOT NULL CHECK (monthly_limit > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_addon_plan_id UUID REFERENCES whatsapp_addon_plans(id);

CREATE TABLE IF NOT EXISTS whatsapp_message_usage (
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'YYYY-MM'
  sent_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dealer_id, period)
);

-- Atomically checks + increments usage for the dealer that owns p_bill_id, in
-- one statement (no read-then-write race between concurrent bill creations).
-- Trust boundary: p_bill_id is an unguessable UUID capability token, same as
-- the rest of send-bill-whatsapp already assumes for this value.
CREATE OR REPLACE FUNCTION public.check_and_increment_whatsapp_usage(p_bill_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID;
  v_limit INT;
  v_enabled BOOLEAN;
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_allowed BOOLEAN;
BEGIN
  SELECT b.dealer_id INTO v_dealer_id FROM bills b WHERE b.id = p_bill_id;
  IF v_dealer_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT d.whatsapp_enabled, p.monthly_limit
    INTO v_enabled, v_limit
    FROM dealers d
    LEFT JOIN whatsapp_addon_plans p ON p.id = d.whatsapp_addon_plan_id
   WHERE d.id = v_dealer_id;

  IF NOT COALESCE(v_enabled, false) OR v_limit IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO whatsapp_message_usage (dealer_id, period, sent_count)
  VALUES (v_dealer_id, v_period, 1)
  ON CONFLICT (dealer_id, period) DO UPDATE
    SET sent_count = whatsapp_message_usage.sent_count + 1,
        updated_at = now()
    WHERE whatsapp_message_usage.sent_count < v_limit
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_whatsapp_usage(UUID) TO anon, authenticated;

-- Admin: create/edit a plan.
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
  v_id UUID;
BEGIN
  PERFORM admin_assert_access(p_admin_id);

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

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'upsert_whatsapp_plan', 'whatsapp_addon_plan', v_id,
          jsonb_build_object('name', p_name, 'monthly_limit', p_monthly_limit));

  RETURN v_id;
END;
$$;

-- Admin: assign a plan + enabled switch to a dealer. Resets the CURRENT
-- period's usage so the new limit is usable immediately.
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
BEGIN
  PERFORM admin_assert_access(p_admin_id);

  UPDATE dealers
     SET whatsapp_addon_plan_id = p_plan_id,
         whatsapp_enabled = p_enabled
   WHERE id = p_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  DELETE FROM whatsapp_message_usage WHERE dealer_id = p_dealer_id AND period = v_period;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'set_dealer_whatsapp_addon', 'dealer', p_dealer_id,
          jsonb_build_object('plan_id', p_plan_id, 'enabled', p_enabled));
END;
$$;

-- Dealer: read own usage this period (naming follows the existing
-- read-only-RPC convention so impersonation guards allow it through).
CREATE OR REPLACE FUNCTION public.get_my_whatsapp_usage()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_dealer_id UUID := auth.uid();
  v_period TEXT := to_char(now(), 'YYYY-MM');
  v_plan RECORD;
  v_used INT;
BEGIN
  SELECT d.whatsapp_enabled, p.name, p.monthly_limit
    INTO v_plan
    FROM dealers d
    LEFT JOIN whatsapp_addon_plans p ON p.id = d.whatsapp_addon_plan_id
   WHERE d.id = v_dealer_id;

  SELECT sent_count INTO v_used
    FROM whatsapp_message_usage
   WHERE dealer_id = v_dealer_id AND period = v_period;

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_plan.whatsapp_enabled, false),
    'plan_name', v_plan.name,
    'monthly_limit', v_plan.monthly_limit,
    'used', COALESCE(v_used, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_whatsapp_usage() TO authenticated;

-- Expose the new dealer columns in the existing admin dealer list (same
-- function as migration 020, extended rather than duplicated).
CREATE OR REPLACE FUNCTION public.admin_get_dealers(
  p_admin_id UUID,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE((p_filters->>'page')::INT, 1), 1);
  v_limit INT := GREATEST(COALESCE((p_filters->>'limit')::INT, 100), 1);
  v_offset INT := (v_page - 1) * v_limit;
  v_search TEXT := NULLIF(trim(p_filters->>'search'), '');
  v_plan TEXT := NULLIF(trim(p_filters->>'plan'), '');
  v_status TEXT := NULLIF(trim(p_filters->>'status'), '');
  v_district TEXT := NULLIF(trim(p_filters->>'district'), '');
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN (
    WITH filtered AS (
      SELECT d.*
      FROM dealers d
      WHERE
        (v_search IS NULL OR d.name ILIKE '%' || v_search || '%' OR d.shop_name ILIKE '%' || v_search || '%' OR d.phone ILIKE '%' || v_search || '%')
        AND (v_plan IS NULL OR d.plan = v_plan)
        AND (
          v_status IS NULL
          OR (v_status = 'active' AND d.is_active = true)
          OR (v_status = 'suspended' AND d.is_active = false)
        )
        AND (v_district IS NULL OR d.district = v_district)
    ),
    paged AS (
      SELECT *
      FROM filtered
      ORDER BY created_at DESC
      OFFSET v_offset
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'data',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'shop_name', p.shop_name,
            'phone', p.phone,
            'email', p.email,
            'district', p.district,
            'state', p.state,
            'plan', p.plan,
            'plan_expires_at', p.plan_expires_at,
            'is_active', p.is_active,
            'created_at', p.created_at,
            'custom_features', COALESCE(p.custom_features, '[]'::jsonb),
            'whatsapp_enabled', p.whatsapp_enabled,
            'whatsapp_addon_plan_id', p.whatsapp_addon_plan_id
          )
          ORDER BY p.created_at DESC
        )
        FROM paged p
      ), '[]'::JSONB),
      'count', (SELECT COUNT(*) FROM filtered)
    )
  );
END;
$$;
