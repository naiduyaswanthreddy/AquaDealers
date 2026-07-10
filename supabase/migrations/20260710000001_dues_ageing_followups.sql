-- =============================================================================
-- DUES AGEING + COLLECTION FOLLOW-UPS
-- 1. Follow-up fields on farmers so dealers can run collections like a CRM:
--    promised-to-pay date, promised amount, and a follow-up note.
-- 2. get_dues_ageing RPC: per-farmer receivables ageing buckets computed from
--    open bills, powering the in-app ageing view on the Dues page.
-- =============================================================================

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_note TEXT,
  ADD COLUMN IF NOT EXISTS promised_amount NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS farmers_follow_up_date_idx
  ON farmers (dealer_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_dues_ageing(
  p_dealer_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  farmer_id UUID,
  amount_0_30 NUMERIC,
  amount_31_60 NUMERIC,
  amount_61_90 NUMERIC,
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
    AND b.balance_due > 0
  GROUP BY b.farmer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dues_ageing(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dues_ageing(UUID, UUID) TO authenticated;
