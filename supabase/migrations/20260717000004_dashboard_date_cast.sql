-- Fix long-standing implicit-cast bug in get_dashboard_aggregates: comparing
-- DATE columns with a TEXT parameter fails on Postgres 17 ("date = text: No
-- operator matches"). Explicit ::date cast keeps the wire signature stable
-- while making the comparison type-safe.

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
  v_today DATE := p_date_str::date;
  v_yesterday DATE := p_yesterday_str::date;
BEGIN
  SELECT COALESCE(SUM(total), 0),
         COALESCE(SUM(CASE WHEN payment_type = 'credit' OR amount_paid < total THEN (total - amount_paid) ELSE 0 END), 0),
         COUNT(*)
  INTO v_today_sales, v_today_credit, v_today_count
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = v_today
    AND deleted_at IS NULL;

  SELECT COALESCE(SUM(total), 0)
  INTO v_yesterday_sales
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = v_yesterday
    AND deleted_at IS NULL;

  SELECT
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash', '') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('upi', 'gpay', 'phonepe', 'paytm') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cheque', 'check') THEN amount ELSE 0 END), 0)
  INTO v_cash_received, v_upi_received, v_cheque_received
  FROM payments
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND payment_date = v_today;

  -- Farmers shared across branches — dealer-scoped only.
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
