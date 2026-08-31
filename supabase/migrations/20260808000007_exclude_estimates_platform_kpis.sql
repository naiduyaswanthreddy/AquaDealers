-- Patch admin_get_platform_kpis: billsToday counted estimates as real bills.
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
    'totalDealers',   COALESCE((SELECT COUNT(*) FROM dealers), 0),
    'activeDealers',  COALESCE((SELECT COUNT(*) FROM dealers WHERE is_active = true), 0),
    'trialDealers',   COALESCE((SELECT COUNT(*) FROM dealers WHERE plan = 'trial'), 0),
    'mrr',            COALESCE((SELECT SUM(amount_paid) FROM dealer_subscriptions WHERE status = 'active'), 0),
    'newSignups30d',  COALESCE((SELECT COUNT(*) FROM dealers WHERE created_at >= v_thirty_days_ago), 0),
    'billsToday',     COALESCE((SELECT COUNT(*) FROM bills WHERE created_at::DATE = v_today AND COALESCE(is_estimate, false) = false), 0)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
