-- Patch three more RPCs that included estimate bills in financial/display output.

-- ── 1. get_dues_ageing ────────────────────────────────────────────────────────
-- Estimates always have balance_due = 0 (enforced by create_bill_v2), so they
-- are naturally excluded by the existing balance_due > 0 predicate. Adding the
-- explicit filter here is defensive and documents the intent clearly.
CREATE OR REPLACE FUNCTION public.get_dues_ageing(
  p_dealer_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  farmer_id      UUID,
  amount_0_30    NUMERIC,
  amount_31_60   NUMERIC,
  amount_61_90   NUMERIC,
  amount_90_plus NUMERIC,
  oldest_due_days INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  RETURN QUERY
  SELECT
    b.farmer_id,
    COALESCE(SUM(b.balance_due) FILTER (WHERE (CURRENT_DATE - b.bill_date::date) <= 30), 0)::NUMERIC,
    COALESCE(SUM(b.balance_due) FILTER (WHERE (CURRENT_DATE - b.bill_date::date) BETWEEN 31 AND 60), 0)::NUMERIC,
    COALESCE(SUM(b.balance_due) FILTER (WHERE (CURRENT_DATE - b.bill_date::date) BETWEEN 61 AND 90), 0)::NUMERIC,
    COALESCE(SUM(b.balance_due) FILTER (WHERE (CURRENT_DATE - b.bill_date::date) > 90), 0)::NUMERIC,
    MAX(GREATEST(CURRENT_DATE - b.bill_date::date, 0))::INT
  FROM bills b
  WHERE b.dealer_id = p_dealer_id
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
    AND b.farmer_id IS NOT NULL
    AND b.deleted_at IS NULL
    AND b.status = 'active'
    AND COALESCE(b.is_estimate, false) = false
    AND b.balance_due > 0
  GROUP BY b.farmer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dues_ageing(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dues_ageing(UUID, UUID) TO authenticated;

-- ── 2. get_farmer_items_v1 ────────────────────────────────────────────────────
-- Estimates have bill_items with real quantities/prices (stock not consumed).
-- Their item amounts inflate total_value, paid_amount, and bill_count per product.
CREATE OR REPLACE FUNCTION public.get_farmer_items_v1(
  p_dealer_id  UUID,
  p_farmer_id  UUID,
  p_start_date DATE,
  p_end_date   DATE,
  p_product_type TEXT DEFAULT NULL,
  p_limit      INTEGER DEFAULT 20,
  p_offset     INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 500);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.farmers
    WHERE id = p_farmer_id AND dealer_id = p_dealer_id
  ) THEN
    RAISE EXCEPTION 'Farmer not found';
  END IF;

  WITH line_rows AS (
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.type AS product_type,
      p.category,
      p.unit,
      b.id AS bill_id,
      b.bill_date,
      bi.quantity::NUMERIC AS quantity,
      bi.total_price::NUMERIC AS line_total,
      CASE
        WHEN COALESCE(b.balance_due, 0) <= 0 THEN bi.total_price::NUMERIC
        WHEN COALESCE(b.amount_paid, 0) <= 0 OR COALESCE(b.total, 0) <= 0 THEN 0::NUMERIC
        ELSE LEAST(
          bi.total_price::NUMERIC,
          ROUND(bi.total_price::NUMERIC * (b.amount_paid::NUMERIC / b.total::NUMERIC), 2)
        )
      END AS paid_value
    FROM public.bill_items bi
    JOIN public.bills b ON b.id = bi.bill_id
    JOIN public.products p ON p.id = bi.product_id
    WHERE b.dealer_id = p_dealer_id
      AND b.farmer_id = p_farmer_id
      AND b.status = 'active'
      AND COALESCE(b.is_estimate, false) = false
      AND b.bill_date BETWEEN p_start_date AND p_end_date
      AND (p_product_type IS NULL OR lower(p.type) = lower(p_product_type))
  ), aggregated AS (
    SELECT
      product_id, product_name, product_type, category, unit,
      SUM(quantity) AS total_quantity,
      ROUND(SUM(line_total), 2) AS total_value,
      ROUND(SUM(paid_value), 2) AS paid_amount,
      ROUND(GREATEST(SUM(line_total) - SUM(paid_value), 0), 2) AS unpaid_amount,
      COUNT(DISTINCT bill_id) AS bill_count,
      MAX(bill_date) AS last_purchased_on
    FROM line_rows
    GROUP BY product_id, product_name, product_type, category, unit
  ), ranked AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY product_type, total_value DESC, product_name) AS row_number
    FROM aggregated
  ), top_product AS (
    SELECT product_id, product_name, last_purchased_on
    FROM aggregated ORDER BY total_value DESC LIMIT 1
  ), purchase_dates AS (
    SELECT DISTINCT product_id, bill_date FROM line_rows
  ), purchase_gaps AS (
    SELECT
      product_id,
      bill_date,
      bill_date - LAG(bill_date) OVER (PARTITION BY product_id ORDER BY bill_date) AS gap_days
    FROM purchase_dates
  ), cadence AS (
    SELECT ROUND(AVG(pg.gap_days))::INTEGER AS average_days
    FROM purchase_gaps pg
    JOIN top_product tp ON tp.product_id = pg.product_id
    WHERE pg.gap_days IS NOT NULL
  ), overdue AS (
    SELECT COALESCE(SUM(bi.total_price), 0)::NUMERIC AS overdue_amount
    FROM public.bill_items bi
    JOIN public.bills b ON b.id = bi.bill_id
    JOIN top_product tp ON tp.product_id = bi.product_id
    WHERE b.dealer_id = p_dealer_id
      AND b.farmer_id = p_farmer_id
      AND b.status = 'active'
      AND COALESCE(b.is_estimate, false) = false
      AND b.balance_due > 0
  )
  SELECT jsonb_build_object(
    'items', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.row_number), '[]'::jsonb)
      FROM (SELECT * FROM ranked LIMIT v_limit OFFSET v_offset) r
    ),
    'totalCount', (SELECT COUNT(*) FROM aggregated),
    'topProduct', (
      SELECT jsonb_build_object(
        'product_id', tp.product_id,
        'product_name', tp.product_name,
        'last_purchased_on', tp.last_purchased_on,
        'average_days_between_purchases', (SELECT average_days FROM cadence),
        'overdue_amount', (SELECT overdue_amount FROM overdue)
      )
      FROM top_product tp
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object('items','[]'::jsonb,'totalCount',0,'topProduct',NULL));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_items_v1(UUID, UUID, DATE, DATE, TEXT, INTEGER, INTEGER) TO authenticated;

-- ── 3. get_farmer_item_bills_v1 ───────────────────────────────────────────────
-- Estimates appear as 'unpaid' bill rows (balance_due = 0 → 'paid' branch, but
-- bill_items exist). Exclude them so only real invoices appear in product drill-down.
CREATE OR REPLACE FUNCTION public.get_farmer_item_bills_v1(
  p_dealer_id  UUID,
  p_farmer_id  UUID,
  p_product_id UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY bill_date, bill_number), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      b.id AS bill_id,
      b.bill_number,
      b.bill_date,
      bi.quantity::NUMERIC   AS quantity,
      bi.unit_price::NUMERIC AS unit_price,
      bi.total_price::NUMERIC AS line_total,
      b.balance_due::NUMERIC  AS balance_due,
      b.amount_paid::NUMERIC  AS amount_paid,
      b.total::NUMERIC        AS bill_total,
      COALESCE(b.branch_name_snapshot, br.name) AS branch_name_snapshot,
      CASE
        WHEN COALESCE(b.balance_due, 0) <= 0 THEN 'paid'
        WHEN COALESCE(b.amount_paid, 0) <= 0 THEN 'unpaid'
        ELSE 'partial'
      END AS payment_status
    FROM public.bill_items bi
    JOIN public.bills b ON b.id = bi.bill_id
    LEFT JOIN public.branches br ON br.id = b.branch_id
    WHERE bi.product_id = p_product_id
      AND b.dealer_id   = p_dealer_id
      AND b.farmer_id   = p_farmer_id
      AND b.status      = 'active'
      AND COALESCE(b.is_estimate, false) = false
      AND b.bill_date BETWEEN p_start_date AND p_end_date
  ) rows;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_item_bills_v1(UUID, UUID, UUID, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
