-- Patch admin_get_dealer_stats to exclude estimate bills from all aggregations.
-- totalBills, totalBillingValue, billsLast30Days, and lastBillDate should all
-- reflect real invoices only — estimates are draft price-quotes, not transactions.
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
    'totalFarmers',       COALESCE((SELECT COUNT(*) FROM farmers WHERE dealer_id = p_dealer_id), 0),
    'totalBills',         COALESCE((SELECT COUNT(*) FROM bills WHERE dealer_id = p_dealer_id AND COALESCE(is_estimate, false) = false), 0),
    'totalBillingValue',  COALESCE((SELECT SUM(total) FROM bills WHERE dealer_id = p_dealer_id AND COALESCE(is_estimate, false) = false), 0),
    'billsLast30Days',    COALESCE((SELECT COUNT(*) FROM bills WHERE dealer_id = p_dealer_id AND COALESCE(is_estimate, false) = false AND created_at >= v_thirty_days_ago), 0),
    'farmersWithDues',    COALESCE((SELECT COUNT(*) FROM farmers WHERE dealer_id = p_dealer_id AND total_due > 0), 0),
    'totalOutstandingDues', COALESCE((SELECT SUM(total_due) FROM farmers WHERE dealer_id = p_dealer_id), 0),
    'lastBillDate',       (SELECT MAX(created_at) FROM bills WHERE dealer_id = p_dealer_id AND COALESCE(is_estimate, false) = false)
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
