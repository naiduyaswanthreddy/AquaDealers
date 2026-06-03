-- =============================================================================
-- AquaDealer Admin Client RPCs + Inventory Adjustment Compatibility
-- Migration 008: Expose browser-friendly admin RPCs for the current admin UI
-- and keep manual stock adjustments aligned with inventory lots/movements.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS admin_reply TEXT;

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

CREATE OR REPLACE FUNCTION public.admin_record_audit_event(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_target_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_log_id BIGINT;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  INSERT INTO admin_audit_log (
    admin_id,
    admin_email,
    action,
    target_type,
    target_id,
    target_name,
    details
  ) VALUES (
    v_admin.id,
    v_admin.email,
    p_action,
    p_target_type,
    p_target_id,
    p_target_name,
    COALESCE(p_details, '{}'::JSONB)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_current_user(p_admin_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  is_active BOOLEAN,
  two_factor_enabled BOOLEAN,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  created_at TIMESTAMPTZ,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  RETURN QUERY
  SELECT
    v_admin.id,
    v_admin.name,
    v_admin.email,
    v_admin.role,
    v_admin.is_active,
    v_admin.two_factor_enabled,
    v_admin.last_login_at,
    v_admin.last_login_ip,
    v_admin.created_at,
    v_admin.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', au.id,
        'name', au.name,
        'email', au.email,
        'role', au.role,
        'is_active', au.is_active,
        'two_factor_enabled', au.two_factor_enabled,
        'last_login_at', au.last_login_at,
        'last_login_ip', au.last_login_ip,
        'created_at', au.created_at,
        'created_by', au.created_by
      )
      ORDER BY au.created_at DESC
    )
    FROM admin_users au
  ), '[]'::JSONB);
END;
$$;

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
            'created_at', p.created_at
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

CREATE OR REPLACE FUNCTION public.admin_get_dealer_profile(
  p_admin_id UUID,
  p_dealer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer dealers%ROWTYPE;
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  SELECT *
  INTO v_dealer
  FROM dealers
  WHERE id = p_dealer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_dealer.id,
    'name', v_dealer.name,
    'shop_name', v_dealer.shop_name,
    'phone', v_dealer.phone,
    'email', v_dealer.email,
    'address', v_dealer.address,
    'district', v_dealer.district,
    'state', v_dealer.state,
    'gstin', v_dealer.gstin,
    'drug_license_no', v_dealer.drug_license_no,
    'language', v_dealer.language,
    'plan', v_dealer.plan,
    'plan_expires_at', v_dealer.plan_expires_at,
    'is_active', v_dealer.is_active,
    'gst_billing_enabled', v_dealer.gst_billing_enabled,
    'pin_hash', v_dealer.pin_hash,
    'pin_timeout_minutes', v_dealer.pin_timeout_minutes,
    'avatar_url', v_dealer.avatar_url,
    'created_at', v_dealer.created_at,
    'branches',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.is_main DESC, b.created_at ASC)
      FROM branches b
      WHERE b.dealer_id = p_dealer_id
    ), '[]'::JSONB),
    'onboarding',
    (
      SELECT to_jsonb(op)
      FROM onboarding_progress op
      WHERE op.dealer_id = p_dealer_id
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_dealer_stats(
  p_admin_id UUID,
  p_dealer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thirty_days_ago TIMESTAMPTZ := now() - interval '30 days';
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN jsonb_build_object(
    'totalFarmers', COALESCE((SELECT COUNT(*) FROM farmers WHERE dealer_id = p_dealer_id), 0),
    'totalBills', COALESCE((SELECT COUNT(*) FROM bills WHERE dealer_id = p_dealer_id), 0),
    'totalBillingValue', COALESCE((SELECT SUM(total) FROM bills WHERE dealer_id = p_dealer_id), 0),
    'billsLast30Days', COALESCE((SELECT COUNT(*) FROM bills WHERE dealer_id = p_dealer_id AND created_at >= v_thirty_days_ago), 0),
    'farmersWithDues', COALESCE((SELECT COUNT(*) FROM farmers WHERE dealer_id = p_dealer_id AND total_due > 0), 0),
    'totalOutstandingDues', COALESCE((SELECT SUM(total_due) FROM farmers WHERE dealer_id = p_dealer_id), 0),
    'lastBillDate', (SELECT MAX(created_at) FROM bills WHERE dealer_id = p_dealer_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_dealer_status(
  p_admin_id UUID,
  p_dealer_id UUID,
  p_is_active BOOLEAN,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer dealers%ROWTYPE;
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  UPDATE dealers
  SET is_active = p_is_active
  WHERE id = p_dealer_id
  RETURNING * INTO v_dealer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dealer not found';
  END IF;

  PERFORM public.admin_record_audit_event(
    p_admin_id,
    CASE WHEN p_is_active THEN 'unsuspend_dealer' ELSE 'suspend_dealer' END,
    'dealer',
    p_dealer_id,
    v_dealer.shop_name,
    jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object(
    'dealer_id', v_dealer.id,
    'is_active', v_dealer.is_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_subscriptions(
  p_admin_id UUID,
  p_filters JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := NULLIF(trim(p_filters->>'status'), '');
  v_plan TEXT := NULLIF(trim(p_filters->>'plan'), '');
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ds.id,
        'dealer_id', ds.dealer_id,
        'plan_id', ds.plan_id,
        'plan_name', ds.plan_name,
        'start_date', ds.start_date,
        'end_date', ds.end_date,
        'status', ds.status,
        'billing_cycle', ds.billing_cycle,
        'amount_paid', ds.amount_paid,
        'payment_method', ds.payment_method,
        'razorpay_payment_id', ds.razorpay_payment_id,
        'notes', ds.notes,
        'auto_renew', ds.auto_renew,
        'granted_by', ds.granted_by,
        'created_at', ds.created_at,
        'updated_at', ds.updated_at,
        'dealers', jsonb_build_object(
          'name', d.name,
          'shop_name', d.shop_name,
          'phone', d.phone
        )
      )
      ORDER BY ds.end_date ASC
    )
    FROM dealer_subscriptions ds
    JOIN dealers d ON d.id = ds.dealer_id
    WHERE (v_status IS NULL OR ds.status = v_status)
      AND (v_plan IS NULL OR ds.plan_name = v_plan)
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_extend_subscription(
  p_admin_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_dealer_id UUID := (p_payload->>'dealerId')::UUID;
  v_plan_name TEXT := COALESCE(NULLIF(p_payload->>'planName', ''), 'basic');
  v_days INT := GREATEST(COALESCE((p_payload->>'days')::INT, 0), 0);
  v_amount_paid NUMERIC(8,2) := COALESCE((p_payload->>'amountPaid')::NUMERIC, 0);
  v_payment_method TEXT := NULLIF(p_payload->>'paymentMethod', '');
  v_notes TEXT := NULLIF(p_payload->>'notes', '');
  v_start_date DATE := CURRENT_DATE;
  v_end_date DATE := CURRENT_DATE + v_days;
  v_plan_id UUID;
  v_subscription_id UUID;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  SELECT id
  INTO v_plan_id
  FROM plan_definitions
  WHERE name = v_plan_name
  LIMIT 1;

  INSERT INTO dealer_subscriptions (
    dealer_id,
    plan_id,
    plan_name,
    start_date,
    end_date,
    status,
    billing_cycle,
    amount_paid,
    payment_method,
    notes,
    granted_by
  ) VALUES (
    v_dealer_id,
    v_plan_id,
    v_plan_name,
    v_start_date,
    v_end_date,
    'active',
    'manual',
    v_amount_paid,
    v_payment_method,
    v_notes,
    v_admin.id
  )
  RETURNING id INTO v_subscription_id;

  IF v_amount_paid > 0 THEN
    INSERT INTO subscription_payment_history (
      dealer_id,
      subscription_id,
      amount,
      payment_date,
      payment_method,
      status,
      notes,
      recorded_by
    ) VALUES (
      v_dealer_id,
      v_subscription_id,
      v_amount_paid,
      v_start_date,
      COALESCE(v_payment_method, 'manual'),
      'success',
      v_notes,
      v_admin.id
    );
  END IF;

  UPDATE dealers
  SET plan = v_plan_name,
      plan_expires_at = v_end_date::TIMESTAMPTZ
  WHERE id = v_dealer_id;

  PERFORM public.admin_record_audit_event(
    p_admin_id,
    'extend_subscription',
    'dealer',
    v_dealer_id,
    NULL,
    jsonb_build_object(
      'plan_name', v_plan_name,
      'days', v_days,
      'amount_paid', v_amount_paid
    )
  );

  RETURN jsonb_build_object(
    'subscription_id', v_subscription_id,
    'dealer_id', v_dealer_id,
    'plan_name', v_plan_name,
    'end_date', v_end_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_subscription_payments(
  p_admin_id UUID,
  p_dealer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(sph) ORDER BY sph.payment_date DESC, sph.created_at DESC)
    FROM subscription_payment_history sph
    WHERE sph.dealer_id = p_dealer_id
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_revenue_metrics(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN (
    WITH active_subs AS (
      SELECT *
      FROM dealer_subscriptions
      WHERE status = 'active'
    )
    SELECT jsonb_build_object(
      'mrr', COALESCE(SUM(amount_paid), 0),
      'arr', COALESCE(SUM(amount_paid), 0) * 12,
      'activePaid', COUNT(*) FILTER (WHERE COALESCE(amount_paid, 0) > 0),
      'trialCount', COUNT(*) FILTER (WHERE plan_name = 'trial')
    )
    FROM active_subs
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_platform_kpis(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_thirty_days_ago TIMESTAMPTZ := now() - interval '30 days';
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN jsonb_build_object(
    'totalDealers', COALESCE((SELECT COUNT(*) FROM dealers), 0),
    'activeDealers', COALESCE((SELECT COUNT(*) FROM dealers WHERE is_active = true), 0),
    'trialDealers', COALESCE((SELECT COUNT(*) FROM dealers WHERE plan = 'trial'), 0),
    'mrr', COALESCE((SELECT SUM(amount_paid) FROM dealer_subscriptions WHERE status = 'active'), 0),
    'newSignups30d', COALESCE((SELECT COUNT(*) FROM dealers WHERE created_at >= v_thirty_days_ago), 0),
    'billsToday', COALESCE((SELECT COUNT(*) FROM bills WHERE created_at::DATE = v_today), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_expiring_subscriptions(
  p_admin_id UUID,
  p_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end_date DATE := CURRENT_DATE + GREATEST(p_days, 0);
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ds.id,
        'dealer_id', ds.dealer_id,
        'plan_name', ds.plan_name,
        'start_date', ds.start_date,
        'end_date', ds.end_date,
        'status', ds.status,
        'amount_paid', ds.amount_paid,
        'dealers', jsonb_build_object(
          'name', d.name,
          'shop_name', d.shop_name,
          'phone', d.phone
        )
      )
      ORDER BY ds.end_date ASC
    )
    FROM dealer_subscriptions ds
    JOIN dealers d ON d.id = ds.dealer_id
    WHERE ds.status = 'active'
      AND ds.end_date BETWEEN CURRENT_DATE AND v_end_date
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_recent_activity(
  p_admin_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', dal.id,
        'dealer_id', dal.dealer_id,
        'event_type', dal.event_type,
        'metadata', dal.metadata,
        'ip_address', dal.ip_address,
        'device_info', dal.device_info,
        'created_at', dal.created_at,
        'dealers', jsonb_build_object('name', d.name)
      )
      ORDER BY dal.created_at DESC
    )
    FROM (
      SELECT *
      FROM dealer_activity_log
      ORDER BY created_at DESC
      LIMIT GREATEST(p_limit, 1)
    ) dal
    LEFT JOIN dealers d ON d.id = dal.dealer_id
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_stuck_onboarding(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', op.id,
        'dealer_id', op.dealer_id,
        'step_1_shop_details_at', op.step_1_shop_details_at,
        'step_2_language_at', op.step_2_language_at,
        'step_3_first_product_at', op.step_3_first_product_at,
        'step_4_first_farmer_at', op.step_4_first_farmer_at,
        'step_5_first_bill_at', op.step_5_first_bill_at,
        'step_5_set_pin_at', op.step_5_set_pin_at,
        'completed_at', op.completed_at,
        'nudge_sent_at', op.nudge_sent_at,
        'nudge_count', op.nudge_count,
        'stuck_since', op.stuck_since,
        'assigned_to', op.assigned_to,
        'notes', op.notes,
        'created_at', op.created_at,
        'dealers', jsonb_build_object(
          'name', d.name,
          'phone', d.phone,
          'created_at', d.created_at
        )
      )
      ORDER BY op.created_at ASC
    )
    FROM onboarding_progress op
    JOIN dealers d ON d.id = op.dealer_id
    WHERE op.completed_at IS NULL
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tickets(
  p_admin_id UUID,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', st.id,
        'dealer_id', st.dealer_id,
        'dealer_phone', st.dealer_phone,
        'dealer_name', st.dealer_name,
        'subject', st.subject,
        'message', st.message,
        'category', st.category,
        'priority', st.priority,
        'status', st.status,
        'admin_reply', st.admin_reply,
        'assigned_to', st.assigned_to,
        'first_response_at', st.first_response_at,
        'resolved_at', st.resolved_at,
        'resolved_by', st.resolved_by,
        'satisfaction_score', st.satisfaction_score,
        'created_at', st.created_at,
        'updated_at', st.updated_at,
        'dealers', jsonb_build_object(
          'name', d.name,
          'shop_name', d.shop_name,
          'phone', d.phone
        )
      )
      ORDER BY st.created_at DESC
    )
    FROM support_tickets st
    LEFT JOIN dealers d ON d.id = st.dealer_id
    WHERE p_status IS NULL OR st.status = p_status
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_ticket(
  p_admin_id UUID,
  p_ticket_id UUID,
  p_reply TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_ticket support_tickets%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  UPDATE support_tickets
  SET status = 'resolved',
      admin_reply = p_reply,
      resolved_by = v_admin.id,
      resolved_at = now(),
      updated_at = now(),
      first_response_at = COALESCE(first_response_at, now())
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found';
  END IF;

  INSERT INTO ticket_messages (
    ticket_id,
    sender_type,
    sender_id,
    sender_name,
    message
  ) VALUES (
    v_ticket.id,
    'admin',
    v_admin.id,
    v_admin.name,
    p_reply
  );

  PERFORM public.admin_record_audit_event(
    p_admin_id,
    'resolve_ticket',
    'support_ticket',
    v_ticket.id,
    v_ticket.subject,
    jsonb_build_object('dealer_id', v_ticket.dealer_id)
  );

  RETURN jsonb_build_object(
    'ticket_id', v_ticket.id,
    'status', v_ticket.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_broadcasts(p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.admin_assert_access(p_admin_id);

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', bm.id,
        'admin_id', bm.admin_id,
        'title', bm.title,
        'message', bm.message,
        'message_te', bm.message_te,
        'message_hi', bm.message_hi,
        'target_segment', bm.target_segment,
        'target_dealer_ids', bm.target_dealer_ids,
        'target_district', bm.target_district,
        'target_state', bm.target_state,
        'channel', bm.channel,
        'scheduled_at', bm.scheduled_at,
        'sent_at', bm.sent_at,
        'delivery_count', bm.delivery_count,
        'read_count', bm.read_count,
        'status', bm.status,
        'created_at', bm.created_at,
        'admin', jsonb_build_object('name', au.name)
      )
      ORDER BY bm.sent_at DESC NULLS LAST, bm.created_at DESC
    )
    FROM broadcast_messages bm
    LEFT JOIN admin_users au ON au.id = bm.admin_id
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(
  p_admin_id UUID,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_broadcast_id UUID;
  v_title TEXT := COALESCE(NULLIF(trim(p_payload->>'title'), ''), left(COALESCE(p_payload->>'message', ''), 60));
  v_message TEXT := COALESCE(NULLIF(trim(p_payload->>'message'), ''), '');
  v_target_segment TEXT := COALESCE(NULLIF(trim(p_payload->>'targetSegment'), ''), 'all');
  v_channel TEXT := COALESCE(NULLIF(trim(p_payload->>'channel'), ''), 'in_app');
  v_delivery_count INT := 0;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  IF v_message = '' THEN
    RAISE EXCEPTION 'Broadcast message is required';
  END IF;

  IF v_target_segment NOT IN ('all', 'trial', 'basic', 'pro', 'expiring_7days', 'inactive_30days', 'onboarding_stuck', 'specific_dealers', 'district', 'state') THEN
    RAISE EXCEPTION 'Unsupported target segment';
  END IF;

  IF v_channel NOT IN ('in_app', 'whatsapp', 'both') THEN
    RAISE EXCEPTION 'Unsupported broadcast channel';
  END IF;

  IF v_target_segment = 'all' THEN
    SELECT COUNT(*) INTO v_delivery_count FROM dealers;
  ELSIF v_target_segment IN ('trial', 'basic', 'pro') THEN
    SELECT COUNT(*) INTO v_delivery_count FROM dealers WHERE plan = v_target_segment;
  ELSE
    v_delivery_count := 0;
  END IF;

  INSERT INTO broadcast_messages (
    admin_id,
    title,
    message,
    target_segment,
    channel,
    sent_at,
    delivery_count,
    status
  ) VALUES (
    v_admin.id,
    v_title,
    v_message,
    v_target_segment,
    v_channel,
    now(),
    v_delivery_count,
    'sent'
  )
  RETURNING id INTO v_broadcast_id;

  PERFORM public.admin_record_audit_event(
    p_admin_id,
    'send_broadcast',
    'broadcast',
    v_broadcast_id,
    v_title,
    jsonb_build_object(
      'target_segment', v_target_segment,
      'channel', v_channel,
      'delivery_count', v_delivery_count
    )
  );

  RETURN jsonb_build_object(
    'broadcast_id', v_broadcast_id,
    'delivery_count', v_delivery_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(
  p_admin_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  IF v_admin.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Audit log access denied';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', aal.id,
        'admin_id', aal.admin_id,
        'admin_email', aal.admin_email,
        'action', aal.action,
        'target_type', aal.target_type,
        'target_id', aal.target_id,
        'target_name', aal.target_name,
        'details', aal.details,
        'ip_address', aal.ip_address,
        'user_agent', aal.user_agent,
        'performed_at', aal.performed_at,
        'admin', jsonb_build_object(
          'name', au.name,
          'email', au.email
        )
      )
      ORDER BY aal.performed_at DESC
    )
    FROM (
      SELECT *
      FROM admin_audit_log
      ORDER BY performed_at DESC
      LIMIT GREATEST(p_limit, 1)
    ) aal
    LEFT JOIN admin_users au ON au.id = aal.admin_id
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_plan_definition(
  p_admin_id UUID,
  p_plan_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_plan plan_definitions%ROWTYPE;
BEGIN
  v_admin := public.admin_assert_access(p_admin_id);

  IF v_admin.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Plan update access denied';
  END IF;

  UPDATE plan_definitions
  SET
    display_name = COALESCE(NULLIF(p_updates->>'display_name', ''), display_name),
    price_monthly = COALESCE((p_updates->>'price_monthly')::NUMERIC, price_monthly),
    price_annual = COALESCE((p_updates->>'price_annual')::NUMERIC, price_annual),
    farmer_limit = COALESCE((p_updates->>'farmer_limit')::INT, farmer_limit),
    bill_limit = COALESCE((p_updates->>'bill_limit')::INT, bill_limit),
    branch_limit = COALESCE((p_updates->>'branch_limit')::INT, branch_limit),
    staff_login_limit = COALESCE((p_updates->>'staff_login_limit')::INT, staff_login_limit),
    features = COALESCE((p_updates->'features')::JSONB, features),
    is_active = COALESCE((p_updates->>'is_active')::BOOLEAN, is_active),
    sort_order = COALESCE((p_updates->>'sort_order')::INT, sort_order)
  WHERE id = p_plan_id
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan definition not found';
  END IF;

  PERFORM public.admin_record_audit_event(
    p_admin_id,
    'update_plan_definition',
    'plan_definition',
    v_plan.id,
    v_plan.name,
    p_updates
  );

  RETURN to_jsonb(v_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealer_id UUID := (p_payload->>'dealer_id')::UUID;
  v_inventory_id UUID := (p_payload->>'inventory_id')::UUID;
  v_adjustment NUMERIC(10,2) := COALESCE((p_payload->>'adjustment_qty')::NUMERIC, 0);
  v_reason TEXT := COALESCE(NULLIF(trim(p_payload->>'reason'), ''), 'Manual stock adjustment');
  v_inventory inventory%ROWTYPE;
  v_new_qty NUMERIC(10,2);
  v_lot inventory_lots%ROWTYPE;
  v_remaining NUMERIC(10,2);
  v_consumed NUMERIC(10,2);
  v_adjustment_id UUID := gen_random_uuid();
BEGIN
  PERFORM public.assert_dealer_access(v_dealer_id);

  IF v_adjustment = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity cannot be zero';
  END IF;

  SELECT *
  INTO v_inventory
  FROM inventory
  WHERE id = v_inventory_id
    AND dealer_id = v_dealer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found';
  END IF;

  v_new_qty := COALESCE(v_inventory.quantity_in_stock, 0) + v_adjustment;

  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Stock quantity cannot be less than zero';
  END IF;

  UPDATE inventory
  SET quantity_in_stock = v_new_qty,
      updated_at = now()
  WHERE id = v_inventory.id;

  IF v_adjustment > 0 THEN
    INSERT INTO inventory_lots (
      dealer_id,
      branch_id,
      inventory_id,
      stock_purchase_id,
      product_id,
      supplier_id,
      batch_number,
      expiry_date,
      quantity_received,
      remaining_quantity,
      cost_price
    ) VALUES (
      v_inventory.dealer_id,
      v_inventory.branch_id,
      v_inventory.id,
      NULL,
      v_inventory.product_id,
      NULL,
      v_inventory.batch_number,
      v_inventory.expiry_date,
      v_adjustment,
      v_adjustment,
      v_inventory.cost_price
    )
    RETURNING * INTO v_lot;

    INSERT INTO inventory_movements (
      dealer_id,
      branch_id,
      inventory_id,
      product_id,
      lot_id,
      reference_type,
      reference_id,
      quantity_change,
      notes
    ) VALUES (
      v_inventory.dealer_id,
      v_inventory.branch_id,
      v_inventory.id,
      v_inventory.product_id,
      v_lot.id,
      'manual_adjustment',
      v_adjustment_id,
      v_adjustment,
      v_reason
    );
  ELSE
    v_remaining := abs(v_adjustment);

    FOR v_lot IN
      SELECT *
      FROM inventory_lots
      WHERE dealer_id = v_inventory.dealer_id
        AND inventory_id = v_inventory.id
        AND remaining_quantity > 0
      ORDER BY expiry_date NULLS LAST, received_at, created_at
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_consumed := LEAST(v_lot.remaining_quantity, v_remaining);

      UPDATE inventory_lots
      SET remaining_quantity = remaining_quantity - v_consumed
      WHERE id = v_lot.id;

      INSERT INTO inventory_movements (
        dealer_id,
        branch_id,
        inventory_id,
        product_id,
        lot_id,
        reference_type,
        reference_id,
        quantity_change,
        notes
      ) VALUES (
        v_inventory.dealer_id,
        v_inventory.branch_id,
        v_inventory.id,
        v_inventory.product_id,
        v_lot.id,
        'manual_adjustment',
        v_adjustment_id,
        -v_consumed,
        v_reason
      );

      v_remaining := v_remaining - v_consumed;
    END LOOP;

    IF v_remaining > 0 THEN
      INSERT INTO inventory_movements (
        dealer_id,
        branch_id,
        inventory_id,
        product_id,
        lot_id,
        reference_type,
        reference_id,
        quantity_change,
        notes
      ) VALUES (
        v_inventory.dealer_id,
        v_inventory.branch_id,
        v_inventory.id,
        v_inventory.product_id,
        NULL,
        'manual_adjustment',
        v_adjustment_id,
        -v_remaining,
        v_reason || ' (legacy stock)'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'inventory_id', v_inventory.id,
    'new_quantity', v_new_qty,
    'adjustment_id', v_adjustment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_record_audit_event(UUID, TEXT, TEXT, UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_current_user(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_users(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_dealers(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_dealer_profile(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_dealer_stats(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_dealer_status(UUID, UUID, BOOLEAN, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_subscriptions(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_subscription_payments(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_revenue_metrics(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_kpis(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_expiring_subscriptions(UUID, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_recent_activity(UUID, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_stuck_onboarding(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_tickets(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_ticket(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_broadcasts(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_send_broadcast(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(UUID, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_plan_definition(UUID, UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock_v1(JSONB) TO authenticated;
