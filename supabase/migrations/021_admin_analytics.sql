-- =============================================================================
-- AquaDealer Admin Analytics
-- Migration 021: Create Analytics RPC for charts
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_analytics(
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_dist JSONB;
  v_dealer_growth JSONB;
  v_mrr NUMERIC;
  v_yrr NUMERIC;
BEGIN
  -- Verify admin access
  PERFORM public.admin_assert_access(p_admin_id);

  -- 1. Plan Distribution
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', plan, 'value', count)), '[]'::jsonb)
  INTO v_plan_dist
  FROM (
    SELECT COALESCE(plan, 'trial') as plan, COUNT(*) as count
    FROM dealers
    GROUP BY plan
  ) p;

  -- 2. Dealer Growth (Last 30 Days)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', date_trunc('day', created_at)::date, 'dealers', count)), '[]'::jsonb)
  INTO v_dealer_growth
  FROM (
    SELECT date_trunc('day', created_at) as created_at, COUNT(*) as count
    FROM dealers
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY date_trunc('day', created_at)
    ORDER BY date_trunc('day', created_at)
  ) g;

  -- 3. Revenue Metrics
  SELECT 
    COALESCE(SUM(amount_paid), 0) INTO v_mrr
  FROM dealer_subscriptions 
  WHERE status = 'active';

  -- For YRR, we can estimate it as MRR * 12 + annual plans, but for simplicity we'll do MRR * 12
  v_yrr := v_mrr * 12;

  RETURN jsonb_build_object(
    'planDistribution', v_plan_dist,
    'dealerGrowth', v_dealer_growth,
    'mrr', v_mrr,
    'yrr', v_yrr
  );
END;
$$;
