-- Fix: 20260725000001 sorted jsonb_agg by (r->>'date'), but r is a plain
-- record from the subquery, not jsonb — the ->> operator doesn't exist for
-- records, causing every call to fail with 42883. Sort by the record's own
-- columns instead; row_to_json(r) is only needed for the aggregated value.

CREATE OR REPLACE FUNCTION get_farmer_ledger_page(
  p_farmer_id     UUID,
  p_dealer_id     UUID,
  p_page          INT DEFAULT 1,
  p_limit         INT DEFAULT 20,
  p_start_date    DATE DEFAULT NULL,
  p_end_date      DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total  BIGINT;
  v_rows   JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total FROM (
    SELECT id FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT id FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
  ) t;

  SELECT jsonb_agg(row_to_json(r) ORDER BY r.date DESC, r.created_at DESC)
  INTO v_rows
  FROM (
    SELECT
      id,
      'bill' AS type,
      bill_number AS ref_number,
      bill_date AS date,
      (total - COALESCE(settlement_discount_amount, 0)) AS amount,
      balance_due,
      created_at
    FROM bills
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND status <> 'cancelled'
      AND (p_start_date IS NULL OR bill_date >= p_start_date)
      AND (p_end_date IS NULL OR bill_date <= p_end_date)
    UNION ALL
    SELECT
      id,
      'payment' AS type,
      COALESCE(receipt_number, UPPER(method), 'PAYMENT') AS ref_number,
      payment_date AS date,
      amount,
      NULL AS balance_due,
      created_at
    FROM payments
    WHERE farmer_id = p_farmer_id
      AND dealer_id = p_dealer_id
      AND (p_start_date IS NULL OR payment_date >= p_start_date)
      AND (p_end_date IS NULL OR payment_date <= p_end_date)
    ORDER BY date DESC, created_at DESC
    LIMIT p_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'total', v_total,
    'page', p_page,
    'limit', p_limit,
    'data', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_farmer_ledger_page(UUID, UUID, INT, INT, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
