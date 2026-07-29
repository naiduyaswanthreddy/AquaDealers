-- Single source of truth for "realized profit" over a date range, using the
-- same item-level cost-basis formula useDashboardStats/useProfitReportData
-- already use for their (correct) numbers. useBusinessSnapshot's own
-- inventory-delta approximation and the monthly finance pack's
-- purchases-in-period approximation both drift from this whenever
-- purchases and sales aren't time-aligned. This function is read-only,
-- additive, and changes no existing table or RPC.
--
-- Cost basis join mirrors useDashboardData.ts's "todayProfit" query exactly:
-- bill_items has no cost_price column (confirmed via src/types/database.ts,
-- BillItem interface) — cost basis comes from bill_items.inventory_id_snapshot
-- joined to inventory.cost_price, same as the dashboard's existing query.

CREATE OR REPLACE FUNCTION public.get_realized_profit(
  p_dealer_id UUID,
  p_start DATE,
  p_end DATE
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
    AND b.bill_date <= p_end;
$$;

REVOKE ALL ON FUNCTION public.get_realized_profit(UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_realized_profit(UUID, DATE, DATE) TO authenticated;
NOTIFY pgrst, 'reload schema';
