-- Migration 20260808000004 accidentally replaced get_farmer_items_v1 with a
-- completely different response structure (items/totalCount/topProduct) instead
-- of just adding the estimate-exclusion filter. This restores the original
-- summary/insights/items/total_count/limit/offset shape with the filter in place.

CREATE OR REPLACE FUNCTION public.get_farmer_items_v1(
  p_dealer_id UUID,
  p_farmer_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_product_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 500);
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
      product_id,
      product_name,
      product_type,
      category,
      unit,
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
    FROM aggregated
    ORDER BY total_value DESC
    LIMIT 1
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
    SELECT COALESCE(jsonb_agg(product_name ORDER BY product_name), '[]'::JSONB) AS product_names
    FROM (
      SELECT DISTINCT product_name
      FROM line_rows
      WHERE line_total - paid_value > 0
        AND bill_date < current_date - 30
    ) overdue_products
  )
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_products', COUNT(*),
      'total_quantity', COALESCE(SUM(total_quantity), 0),
      'total_value', COALESCE(ROUND(SUM(total_value), 2), 0),
      'paid_amount', COALESCE(ROUND(SUM(paid_amount), 2), 0),
      'unpaid_amount', COALESCE(ROUND(SUM(unpaid_amount), 2), 0)
    ),
    'insights', jsonb_build_object(
      'top_product_name', (SELECT product_name FROM top_product),
      'average_days_between_purchases', (SELECT average_days FROM cadence),
      'predicted_next_purchase_date', (
        SELECT CASE
          WHEN c.average_days IS NULL THEN NULL
          ELSE (tp.last_purchased_on + c.average_days)::TEXT
        END
        FROM top_product tp CROSS JOIN cadence c
      ),
      'overdue_product_names', (SELECT product_names FROM overdue)
    ),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(page_rows) - 'row_number' ORDER BY product_type, total_value DESC, product_name)
      FROM ranked page_rows
      WHERE row_number > v_offset AND row_number <= v_offset + v_limit
    ), '[]'::JSONB),
    'total_count', COUNT(*),
    'limit', v_limit,
    'offset', v_offset
  )
  INTO v_result
  FROM aggregated;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_items_v1(UUID, UUID, DATE, DATE, TEXT, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
