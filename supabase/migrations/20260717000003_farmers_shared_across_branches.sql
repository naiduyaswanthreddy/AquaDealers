-- =============================================================================
-- Farmers are shared across all branches (2026-07-17)
--
-- Business change: a farmer added at one branch is visible at every branch.
-- The `farmers.branch_id` column stays as "originally added at" info, but no
-- longer gates visibility. Bills still track their own branch_id so stock
-- reduction is unchanged.
--
-- Only the dashboard aggregates and dues-ageing RPC still filter farmers by
-- branch — this drops that filter, so the "dueFarmersCount" and outstanding
-- totals reflect the whole dealer.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(
  p_dealer_id UUID,
  p_branch_id UUID,
  p_date_str TEXT,
  p_yesterday_str TEXT
)
RETURNS JSON AS $$
DECLARE
  v_today_sales NUMERIC := 0;
  v_yesterday_sales NUMERIC := 0;
  v_today_credit NUMERIC := 0;
  v_today_count INTEGER := 0;
  v_cash_received NUMERIC := 0;
  v_upi_received NUMERIC := 0;
  v_cheque_received NUMERIC := 0;
  v_total_dues NUMERIC := 0;
  v_due_farmers_count INTEGER := 0;
BEGIN
  -- Today sales, credit, count
  SELECT COALESCE(SUM(total), 0),
         COALESCE(SUM(CASE WHEN payment_type = 'credit' OR amount_paid < total THEN (total - amount_paid) ELSE 0 END), 0),
         COUNT(*)
  INTO v_today_sales, v_today_credit, v_today_count
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = p_date_str
    AND deleted_at IS NULL;

  -- Yesterday sales
  SELECT COALESCE(SUM(total), 0)
  INTO v_yesterday_sales
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = p_yesterday_str
    AND deleted_at IS NULL;

  -- Payments split by method (today)
  SELECT
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash', '') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('upi', 'gpay', 'phonepe', 'paytm') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cheque', 'check') THEN amount ELSE 0 END), 0)
  INTO v_cash_received, v_upi_received, v_cheque_received
  FROM payments
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND payment_date = p_date_str;

  -- Total outstanding dues — farmers are dealer-scoped (shared across branches)
  -- so we ignore p_branch_id here even when a specific branch is selected.
  SELECT COALESCE(SUM(total_due), 0), COUNT(CASE WHEN total_due > 0 THEN 1 END)
  INTO v_total_dues, v_due_farmers_count
  FROM farmers
  WHERE dealer_id = p_dealer_id
    AND is_active = true
    AND deleted_at IS NULL;

  RETURN json_build_object(
    'todaySales', v_today_sales,
    'yesterdaySales', v_yesterday_sales,
    'todayCredit', v_today_credit,
    'todayCount', v_today_count,
    'todayCashReceived', v_cash_received,
    'todayUpiReceived', v_upi_received,
    'todayChequeReceived', v_cheque_received,
    'totalDues', v_total_dues,
    'dueFarmersCount', v_due_farmers_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
