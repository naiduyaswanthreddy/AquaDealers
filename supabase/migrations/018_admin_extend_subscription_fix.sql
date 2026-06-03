-- =============================================================================
-- AquaDealer Admin Subscription Fix
-- Migration 018: Fix overlapping subscriptions
-- =============================================================================

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

  -- Archive existing active subscriptions for this dealer
  UPDATE dealer_subscriptions
  SET status = 'expired'
  WHERE dealer_id = v_dealer_id AND status = 'active';

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

  -- Add payment history if an amount was paid
  IF v_amount_paid > 0 THEN
    INSERT INTO subscription_payment_history (
      dealer_id,
      subscription_id,
      amount,
      currency,
      payment_date,
      payment_method,
      status,
      notes,
      recorded_by
    ) VALUES (
      v_dealer_id,
      v_subscription_id,
      v_amount_paid,
      'INR',
      CURRENT_DATE,
      COALESCE(v_payment_method, 'manual'),
      'success',
      v_notes,
      v_admin.id
    );
  END IF;

  -- Update dealer's current plan and expiry
  UPDATE dealers
  SET 
    plan = v_plan_name,
    plan_expires_at = v_end_date::timestamp
  WHERE id = v_dealer_id;

  -- Log action
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    v_admin.id,
    'extend_subscription',
    'dealer',
    v_dealer_id,
    jsonb_build_object(
      'plan_name', v_plan_name,
      'days', v_days,
      'amount_paid', v_amount_paid,
      'subscription_id', v_subscription_id,
      'archived_old_subs', true
    )
  );

  RETURN jsonb_build_object(
    'subscription_id', v_subscription_id,
    'status', 'success'
  );
END;
$$;
