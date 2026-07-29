-- Adds optional branch scoping to get_realized_profit (introduced in
-- 20260730000001_realized_profit_rpc.sql). That version always computed
-- gross margin across ALL of a dealer's branches, but its only caller
-- (useBusinessSnapshot.ts) nets it against totalExpenses/totalReturns which
-- ARE branch-filtered whenever a specific branch is selected — inflating
-- realizedProfit for multi-branch dealers. p_branch_id defaults to NULL,
-- which preserves the exact prior all-branch query shape (full backward
-- compatibility — no other caller exists yet).

-- CREATE OR REPLACE cannot change a function's argument signature, so the
-- old 3-arg version must be dropped first, or both would coexist as an
-- overload. Existing 3-arg callers keep working because the 4th param below
-- defaults to NULL.
DROP FUNCTION IF EXISTS public.get_realized_profit(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_realized_profit(
  p_dealer_id UUID,
  p_start DATE,
  p_end DATE,
  p_branch_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    (bi.unit_price - COALESCE(inv.cost_price, 0)) * bi.quantity
  ), 0)
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  LEFT JOIN inventory inv ON inv.id = bi.inventory_id_snapshot
  WHERE b.dealer_id = p_dealer_id
    AND b.status != 'cancelled'
    AND b.bill_date >= p_start
    AND b.bill_date <= p_end
    AND (p_branch_id IS NULL OR b.branch_id = p_branch_id);
$$;

REVOKE ALL ON FUNCTION public.get_realized_profit(UUID, DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_realized_profit(UUID, DATE, DATE, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
