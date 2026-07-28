-- Extend get_farmer_item_bills_v1 to return the branch name for each row so
-- the FarmerItemsTab per-product table can show a Branch pill.
CREATE OR REPLACE FUNCTION public.get_farmer_item_bills_v1(
  p_dealer_id UUID,
  p_farmer_id UUID,
  p_product_id UUID,
  p_start_date DATE,
  p_end_date DATE
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
      bi.quantity::NUMERIC  AS quantity,
      bi.unit_price::NUMERIC AS unit_price,
      bi.total_price::NUMERIC AS line_total,
      b.balance_due::NUMERIC AS balance_due,
      b.amount_paid::NUMERIC AS amount_paid,
      b.total::NUMERIC AS bill_total,
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
      AND b.dealer_id = p_dealer_id
      AND b.farmer_id = p_farmer_id
      AND b.status = 'active'
      AND b.bill_date BETWEEN p_start_date AND p_end_date
  ) rows;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_farmer_item_bills_v1(UUID, UUID, UUID, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
