-- Estimates are draft quotes: no stock deducted, no dues added.
-- They must be invisible to every financial aggregation.
-- This migration patches all RPCs that previously included is_estimate rows.

-- ── 1. get_dashboard_aggregates ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(
  p_dealer_id UUID,
  p_branch_id UUID,
  p_date_str TEXT,
  p_yesterday_str TEXT
)
RETURNS JSON AS $$
DECLARE
  v_today_sales      NUMERIC := 0;
  v_yesterday_sales  NUMERIC := 0;
  v_today_credit     NUMERIC := 0;
  v_today_count      INTEGER := 0;
  v_cash_received    NUMERIC := 0;
  v_upi_received     NUMERIC := 0;
  v_cheque_received  NUMERIC := 0;
  v_total_dues       NUMERIC := 0;
  v_due_farmers_count INTEGER := 0;
  v_today            DATE := p_date_str::date;
  v_yesterday        DATE := p_yesterday_str::date;
BEGIN
  SELECT COALESCE(SUM(total), 0),
         COALESCE(SUM(CASE WHEN payment_type = 'credit' OR amount_paid < total THEN (total - amount_paid) ELSE 0 END), 0),
         COUNT(*)
  INTO v_today_sales, v_today_credit, v_today_count
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = v_today
    AND deleted_at IS NULL
    AND COALESCE(is_estimate, false) = false;

  SELECT COALESCE(SUM(total), 0)
  INTO v_yesterday_sales
  FROM bills
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND bill_date = v_yesterday
    AND deleted_at IS NULL
    AND COALESCE(is_estimate, false) = false;

  SELECT
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cash', '') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('upi', 'gpay', 'phonepe', 'paytm') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN LOWER(method) IN ('cheque', 'check') THEN amount ELSE 0 END), 0)
  INTO v_cash_received, v_upi_received, v_cheque_received
  FROM payments
  WHERE dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
    AND payment_date = v_today;

  SELECT COALESCE(SUM(total_due), 0), COUNT(CASE WHEN total_due > 0 THEN 1 END)
  INTO v_total_dues, v_due_farmers_count
  FROM farmers
  WHERE dealer_id = p_dealer_id
    AND is_active = true
    AND deleted_at IS NULL;

  RETURN json_build_object(
    'todaySales',         v_today_sales,
    'yesterdaySales',     v_yesterday_sales,
    'todayCredit',        v_today_credit,
    'todayCount',         v_today_count,
    'todayCashReceived',  v_cash_received,
    'todayUpiReceived',   v_upi_received,
    'todayChequeReceived',v_cheque_received,
    'totalDues',          v_total_dues,
    'dueFarmersCount',    v_due_farmers_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. get_sales_series_rpc ───────────────────────────────────────────────────
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
      AND COALESCE(is_estimate, false) = false
    GROUP BY bill_date
  )
  SELECT json_agg(COALESCE(s.daily_total, 0) ORDER BY d.d ASC)
  INTO v_result
  FROM date_series d
  LEFT JOIN daily_sales s ON d.d = s.bill_date;

  RETURN COALESCE(v_result, '[]');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. get_top_sold_products_v1 ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_top_sold_products_v1(
  p_dealer_id  uuid,
  p_branch_id  uuid,
  p_start_date date,
  p_limit      int DEFAULT 5
) RETURNS TABLE (
  product_id   uuid,
  product_name text,
  product_type text,
  unit         text,
  total_qty    numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    bi.product_id,
    p.name,
    p.type,
    COALESCE(p.unit, 'units'),
    SUM(bi.quantity)::numeric
  FROM bill_items bi
  JOIN bills b     ON b.id = bi.bill_id
  JOIN products p  ON p.id = bi.product_id
  WHERE b.dealer_id = p_dealer_id
    AND b.status    = 'active'
    AND b.bill_date >= p_start_date
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    AND COALESCE(b.is_estimate, false) = false
  GROUP BY bi.product_id, p.name, p.type, p.unit
  ORDER BY SUM(bi.quantity) DESC
  LIMIT p_limit;
$$;

-- ── 4. get_today_sold_items_v1 ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_today_sold_items_v1(
  p_dealer_id uuid,
  p_branch_id uuid,
  p_date      date
) RETURNS TABLE (
  product_id   uuid,
  product_name text,
  product_type text,
  unit         text,
  total_qty    numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    bi.product_id,
    p.name,
    p.type,
    COALESCE(p.unit, 'units'),
    SUM(bi.quantity)::numeric
  FROM bill_items bi
  JOIN bills b     ON b.id = bi.bill_id
  JOIN products p  ON p.id = bi.product_id
  WHERE b.dealer_id = p_dealer_id
    AND b.status    = 'active'
    AND b.bill_date = p_date
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    AND COALESCE(b.is_estimate, false) = false
  GROUP BY bi.product_id, p.name, p.type, p.unit
  ORDER BY SUM(bi.quantity) DESC;
$$;

-- ── 5. export_bills_chunk ─────────────────────────────────────────────────────
-- Estimates are draft quotes and must not appear in financial CSV exports.
CREATE OR REPLACE FUNCTION export_bills_chunk(
  p_dealer_id     UUID,
  p_branch_id     UUID DEFAULT NULL,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL,
  p_payment_status TEXT DEFAULT 'all',
  p_search        TEXT DEFAULT NULL,
  p_limit         INT  DEFAULT 500,
  p_offset        INT  DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM bills b
  WHERE b.dealer_id = p_dealer_id
    AND b.deleted_at IS NULL
    AND COALESCE(b.is_estimate, false) = false
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    AND (p_start_date IS NULL OR b.bill_date >= p_start_date)
    AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
    AND (
      p_payment_status = 'all'
      OR (p_payment_status = 'paid' AND b.balance_due <= 0)
      OR (p_payment_status = 'unpaid' AND b.balance_due > 0)
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR b.bill_number ILIKE '%' || p_search || '%'
      OR b.farmer_name_snapshot ILIKE '%' || p_search || '%'
    );

  SELECT jsonb_agg(row_to_json(r)) INTO v_rows
  FROM (
    SELECT
      b.bill_number,
      b.bill_date,
      b.farmer_name_snapshot,
      b.total,
      b.subtotal,
      b.discount_amount,
      b.gst_amount,
      b.amount_paid,
      b.balance_due,
      b.payment_type,
      b.type,
      b.created_at
    FROM bills b
    WHERE b.dealer_id = p_dealer_id
      AND b.deleted_at IS NULL
      AND COALESCE(b.is_estimate, false) = false
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_start_date IS NULL OR b.bill_date >= p_start_date)
      AND (p_end_date IS NULL OR b.bill_date <= p_end_date)
      AND (
        p_payment_status = 'all'
        OR (p_payment_status = 'paid' AND b.balance_due <= 0)
        OR (p_payment_status = 'unpaid' AND b.balance_due > 0)
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR b.bill_number ILIKE '%' || p_search || '%'
        OR b.farmer_name_snapshot ILIKE '%' || p_search || '%'
      )
    ORDER BY b.bill_date DESC, b.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN jsonb_build_object(
    'total',  v_total,
    'offset', p_offset,
    'limit',  p_limit,
    'data',   COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION export_bills_chunk(UUID, UUID, DATE, DATE, TEXT, TEXT, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
