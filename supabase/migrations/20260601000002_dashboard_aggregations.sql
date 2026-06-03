-- Dashboard Aggregation RPCs

-- 1. Get Dashboard Core Aggregates (Today Sales, Credit, Cash Received, Dues)
CREATE OR REPLACE FUNCTION get_dashboard_aggregates(p_dealer_id UUID, p_branch_id UUID, p_date_str DATE)
RETURNS JSON AS $$
DECLARE
  v_today_sales NUMERIC := 0;
  v_yesterday_sales NUMERIC := 0;
  v_today_credit NUMERIC := 0;
  v_today_count INTEGER := 0;
  v_yesterday_count INTEGER := 0;
  v_cash_received NUMERIC := 0;
  v_upi_received NUMERIC := 0;
  v_cheque_received NUMERIC := 0;
  v_total_dues NUMERIC := 0;
  v_due_farmers_count INTEGER := 0;
  v_yesterday DATE;
BEGIN
  v_yesterday := p_date_str - INTERVAL '1 day';

  -- Today's Sales & Credit
  SELECT COALESCE(SUM(total), 0), COALESCE(SUM(balance_due), 0), COUNT(*)
  INTO v_today_sales, v_today_credit, v_today_count
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = p_date_str
    AND status = 'active';

  -- Yesterday's Sales
  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_yesterday_sales, v_yesterday_count
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = v_yesterday
    AND status = 'active';

  -- Today's Payment Split
  SELECT 
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash', '') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('upi', 'gpay', 'phonepe', 'paytm') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cheque', 'check') THEN amount ELSE 0 END), 0)
  INTO v_cash_received, v_upi_received, v_cheque_received
  FROM payments
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND payment_date = p_date_str;

  -- Total Outstanding Dues
  SELECT COALESCE(SUM(total_due), 0), COUNT(CASE WHEN total_due > 0 THEN 1 END)
  INTO v_total_dues, v_due_farmers_count
  FROM farmers
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
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


-- 2. Get Sales Series (Last N Days)
CREATE OR REPLACE FUNCTION get_sales_series_rpc(p_dealer_id UUID, p_branch_id UUID, p_days INTEGER, p_end_date DATE)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE;
  v_result JSON;
BEGIN
  v_start_date := p_end_date - (p_days - 1);

  WITH date_series AS (
    SELECT generate_series(v_start_date, p_end_date, '1 day'::interval)::date AS d
  ),
  daily_sales AS (
    SELECT bill_date, SUM(total) as daily_total
    FROM bills
    WHERE dealer_id = p_dealer_id
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND status = 'active'
      AND bill_date >= v_start_date
      AND bill_date <= p_end_date
    GROUP BY bill_date
  )
  SELECT json_agg(COALESCE(s.daily_total, 0) ORDER BY d.d ASC)
  INTO v_result
  FROM date_series d
  LEFT JOIN daily_sales s ON d.d = s.bill_date;

  RETURN COALESCE(v_result, '[]');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Get Cash Summary RPC
CREATE OR REPLACE FUNCTION get_cash_summary_rpc(p_dealer_id UUID, p_branch_id UUID, p_days INTEGER, p_end_date DATE)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE;
  v_opening_balance NUMERIC := 0;
  v_current_balance NUMERIC := 0;
  v_yesterday_balance NUMERIC := 0;
  v_series JSON;
BEGIN
  v_start_date := p_end_date - (p_days - 1);

  -- 1. Calculate opening balance (all entries before v_start_date)
  SELECT COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END), 0)
  INTO v_opening_balance
  FROM cash_book
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND entry_date < v_start_date
    AND deleted_at IS NULL;

  -- 2. Calculate current and yesterday balance
  SELECT 
    v_opening_balance + COALESCE(SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END), 0),
    v_opening_balance + COALESCE(SUM(CASE WHEN entry_date <= (p_end_date - 1) THEN (CASE WHEN entry_type = 'income' THEN amount ELSE -amount END) ELSE 0 END), 0)
  INTO v_current_balance, v_yesterday_balance
  FROM cash_book
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND entry_date >= v_start_date
    AND entry_date <= p_end_date
    AND deleted_at IS NULL;

  -- 3. Build Daily Running Balance Series
  WITH date_series AS (
    SELECT generate_series(v_start_date, p_end_date, '1 day'::interval)::date AS d
  ),
  daily_net AS (
    SELECT entry_date, SUM(CASE WHEN entry_type = 'income' THEN amount ELSE -amount END) as net
    FROM cash_book
    WHERE dealer_id = p_dealer_id
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND entry_date >= v_start_date
      AND entry_date <= p_end_date
      AND deleted_at IS NULL
    GROUP BY entry_date
  ),
  running_balances AS (
    SELECT 
      d.d, 
      COALESCE(n.net, 0) as net,
      v_opening_balance + SUM(COALESCE(n.net, 0)) OVER (ORDER BY d.d ASC ROWS UNBOUNDED PRECEDING) as running_balance
    FROM date_series d
    LEFT JOIN daily_net n ON d.d = n.entry_date
  )
  SELECT json_agg(running_balance ORDER BY d ASC)
  INTO v_series
  FROM running_balances;

  RETURN json_build_object(
    'currentBalance', v_current_balance,
    'previousBalance', v_yesterday_balance,
    'series', COALESCE(v_series, '[]')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
