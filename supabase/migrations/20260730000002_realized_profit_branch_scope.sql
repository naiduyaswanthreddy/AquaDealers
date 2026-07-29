-- Single source of truth for GROSS item margin over a date range — i.e.
-- SUM((unit_price - cost_price) * quantity) across bill items in [p_start,
-- p_end], using the same item-level cost-basis formula
-- useDashboardStats/useProfitReportData already use for their (correct)
-- numbers. This function does NOT subtract expenses or returns for the
-- period — callers (e.g. useBusinessSnapshot.ts) must net those out
-- themselves to match the Dashboard's "todayProfit" formula shape
-- (grossMargin - expenses - returns).
--
-- Cost basis join mirrors useDashboardData.ts's "todayProfit" query exactly:
-- bill_items has no cost_price column (confirmed via src/types/database.ts,
-- BillItem interface) — cost basis comes from bill_items.inventory_id_snapshot
-- joined to inventory.cost_price, same as the dashboard's existing query.
--
-- Optional branch scoping: gross margin can otherwise be computed across ALL
-- of a dealer's branches, but its only caller (useBusinessSnapshot.ts) nets
-- it against totalExpenses/totalReturns which ARE branch-filtered whenever a
-- specific branch is selected — inflating realizedProfit for multi-branch
-- dealers. p_branch_id defaults to NULL (all branches).
--
-- Squashed from the original 20260730000001_realized_profit_rpc.sql +
-- 20260730000002 branch-scoping migration (both unapplied, same branch) into
-- this single file to avoid any confusion about apply order. Also fixes two
-- cross-task review findings caught before either migration was ever applied
-- anywhere:
--   * SECURITY DEFINER + granted to `authenticated` with only a caller-
--     supplied `b.dealer_id = p_dealer_id` filter is a cross-tenant read —
--     any dealer could pass another dealer's UUID. Now asserts access via
--     the repo's established public.assert_dealer_access(p_dealer_id) guard
--     (see 20260710000004_staff_admin_session_security.sql), which also
--     handles staff sessions where auth.uid() is NULL.
--   * Missing `b.deleted_at IS NULL` let soft-deleted bills inflate the
--     "unified" profit number — added, matching the repo-wide bills-query
--     convention (20260721000001.sql, 20260721000007.sql, 20260721000008.sql).

DROP FUNCTION IF EXISTS public.get_realized_profit(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_realized_profit(
  p_dealer_id UUID,
  p_start DATE,
  p_end DATE,
  p_branch_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result NUMERIC;
BEGIN
  PERFORM public.assert_dealer_access(p_dealer_id);

  SELECT COALESCE(SUM(
    (bi.unit_price - COALESCE(inv.cost_price, 0)) * bi.quantity
  ), 0)
  INTO v_result
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  LEFT JOIN inventory inv ON inv.id = bi.inventory_id_snapshot
  WHERE b.dealer_id = p_dealer_id
    AND b.deleted_at IS NULL
    AND b.status != 'cancelled'
    AND b.bill_date >= p_start
    AND b.bill_date <= p_end
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_realized_profit(UUID, DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_realized_profit(UUID, DATE, DATE, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
