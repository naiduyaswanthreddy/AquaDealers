import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { supabase } from '@/lib/supabase';

export interface BusinessSnapshot {
  /** SUM of all stock_purchases.total_amount (all time) */
  totalInvested: number;
  /** SUM(inventory.quantity_in_stock × cost_price) — money locked in unsold stock */
  currentInventoryValue: number;
  /** SUM(inventory.quantity_in_stock × selling_price) — what remaining stock could earn */
  expectedRevenue: number;
  /** Expected profit from remaining stock: expectedRevenue − currentInventoryValue */
  expectedProfit: number;
  /** Cash available = current cash-book closing balance */
  cashAvailable: number;
  /** Outstanding dues = SUM(farmers.total_due) */
  outstandingDues: number;
  /** Total sales (all time) */
  totalSales: number;
  /** Total expenses (all time) */
  totalExpenses: number;
  /** Realized profit = grossMargin(get_realized_profit RPC) − totalExpenses − totalReturns, over the same period, matching the Dashboard's "today's profit" formula shape */
  realizedProfit: number;
  /** Net business worth = currentInventoryValue + cashAvailable + outstandingDues */
  netBusinessWorth: number;
  /** ROI % = realizedProfit / totalInvested × 100 */
  roi: number;
  /** Insight message for the dealer */
  insight: string;
}

// All-time lower bound: this hook has no period selector today, so its whole
// snapshot — including the realized-profit RPC below — is scoped to "all
// time" (this IS the hook's period, matching totalSales/totalInvested/etc).
// get_realized_profit only returns gross item margin for that range; expenses
// and returns for the same range are netted out below, same formula shape as
// the Dashboard's todayProfit (trueProfit − expenses − returns), just over
// this hook's all-time period instead of "today".
const ALL_TIME_START = '2000-01-01';

export function useBusinessSnapshot() {
  const user = useAuthStore((state) => state.user);
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : (activeBranch?.id || null);
  const dealerId = user?.id || '';
  const startDate = ALL_TIME_START;
  const endDate = new Date().toISOString().slice(0, 10);

  return useQuery<BusinessSnapshot>({
    queryKey: ['business-snapshot', dealerId, branchId],
    queryFn: async (): Promise<BusinessSnapshot> => {
      // Realized-profit RPC is folded into this same queryFn (not a separate
      // useQuery) so an RPC failure (e.g. PGRST202 before the migration is
      // applied) propagates through this hook's normal error path instead of
      // being silently swallowed and defaulted to 0 — which would otherwise
      // surface a fabricated negative "profit" to the dealer.
      const realizedProfitP = supabase.rpc('get_realized_profit', {
        p_dealer_id: dealerId,
        p_start: startDate,
        p_end: endDate,
        p_branch_id: branchId,
      });

      // ── 1. All-time purchases (total invested) ─────────────────────────────
      let purchasesQ = supabase
        .from('stock_purchases')
        .select('total_amount')
        .eq('dealer_id', dealerId);
      if (branchId) purchasesQ = purchasesQ.eq('branch_id', branchId);

      // ── 2. Inventory (stock in shop right now) ─────────────────────────────
      let inventoryQ = supabase
        .from('inventory')
        .select('quantity_in_stock, cost_price, selling_price')
        .eq('dealer_id', dealerId)
        .gt('quantity_in_stock', 0);

      // ── 3. All-time sales ───────────────────────────────────────────────────
      let billsQ = supabase
        .from('bills')
        .select('total')
        .eq('dealer_id', dealerId)
        .neq('status', 'cancelled');
      if (branchId) billsQ = billsQ.eq('branch_id', branchId);

      // ── 4. All-time expenses ────────────────────────────────────────────────
      let expensesQ = supabase
        .from('expenses')
        .select('amount')
        .eq('dealer_id', dealerId);
      if (branchId) expensesQ = expensesQ.eq('branch_id', branchId);

      // ── 5. Cash balance from cash_book (all entries) ────────────────────────
      let cashQ = supabase
        .from('cash_book')
        .select('entry_type, amount')
        .eq('dealer_id', dealerId);
      if (branchId) cashQ = cashQ.eq('branch_id', branchId);

      // ── 6. Outstanding dues ─────────────────────────────────────────────────
      const farmersQ = supabase
        .from('farmers')
        .select('total_due')
        .eq('dealer_id', dealerId)
        .eq('is_active', true);

      // ── 7. Returns in period, same table/shape as useDashboardStats' todayReturns ──
      let returnsQ = supabase
        .from('bill_returns')
        .select('total_amount')
        .eq('dealer_id', dealerId)
        .gte('return_date', startDate)
        .lte('return_date', endDate);
      if (branchId) returnsQ = returnsQ.eq('branch_id', branchId);

      const [
        { data: purchases },
        { data: inventory },
        { data: bills },
        { data: expenses },
        { data: cashEntries },
        { data: farmers },
        { data: returns },
        { data: realizedProfitData, error: realizedProfitError },
      ] = await Promise.all([purchasesQ, inventoryQ, billsQ, expensesQ, cashQ, farmersQ, returnsQ, realizedProfitP]);
      if (realizedProfitError) throw realizedProfitError;

      // ── Calculations ────────────────────────────────────────────────────────
      const totalInvested = (purchases || []).reduce((s, p) => s + Number(p.total_amount || 0), 0);

      const inventoryList = inventory || [];
      const currentInventoryValue = inventoryList.reduce(
        (s, i) => s + Number(i.quantity_in_stock || 0) * Number(i.cost_price || 0),
        0
      );
      const expectedRevenue = inventoryList.reduce(
        (s, i) => s + Number(i.quantity_in_stock || 0) * Number(i.selling_price || 0),
        0
      );
      const expectedProfit = expectedRevenue - currentInventoryValue;

      const totalSales = (bills || []).reduce((s, b) => s + Number(b.total || 0), 0);
      const totalExpenses = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      const totalReturns = (returns || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

      // Realized profit = grossMargin − expenses − returns, over this hook's
      // period — same formula shape as useDashboardStats' todayProfit
      // (trueProfit − todayExpenses − todayReturns). grossMargin comes from
      // get_realized_profit RPC (item-level cost basis, same as
      // useDashboardStats/useProfitReportData); it does not itself subtract
      // expenses/returns, so that netting happens here. This replaces the old
      // inventory-delta approximation (totalSales − (totalInvested −
      // currentInventoryValue) − totalExpenses), which drifted whenever
      // purchases and sales weren't time-aligned.
      const grossMargin = Number(realizedProfitData) || 0;
      const realizedProfit = grossMargin - totalExpenses - totalReturns;

      const cashEntryList = cashEntries || [];
      const cashAvailable = cashEntryList.reduce(
        (s, e) => s + (e.entry_type === 'income' ? Number(e.amount || 0) : -Number(e.amount || 0)),
        0
      );

      const outstandingDues = (farmers || []).reduce((s, f) => s + Number(f.total_due || 0), 0);

      const netBusinessWorth = currentInventoryValue + Math.max(0, cashAvailable) + outstandingDues;

      const roi = totalInvested > 0 ? (realizedProfit / totalInvested) * 100 : 0;

      // ── Smart Insight ───────────────────────────────────────────────────────
      let insight = '';
      if (outstandingDues > 100000) {
        const lacs = (outstandingDues / 100000).toFixed(1);
        insight = `You have ₹${lacs}L blocked in overdue payments. Follow up with customers to improve cash flow.`;
      } else if (expectedProfit > 50000) {
        const lacs = (expectedProfit / 100000).toFixed(1);
        insight = `₹${lacs}L potential profit sitting in your current inventory. Focus on moving stock.`;
      } else if (roi < 5 && totalInvested > 0) {
        insight = `Your ROI is ${roi.toFixed(1)}%. Consider reviewing pricing or reducing slow-moving stock.`;
      } else if (cashAvailable < 0) {
        insight = `Cash balance is negative. Review your cash book entries for any missing entries.`;
      } else {
        insight = `Business is running healthy with ${roi.toFixed(1)}% ROI. Keep tracking your stock and dues!`;
      }

      return {
        totalInvested,
        currentInventoryValue,
        expectedRevenue,
        expectedProfit,
        cashAvailable: Math.max(0, cashAvailable),
        outstandingDues,
        totalSales,
        totalExpenses,
        realizedProfit,
        netBusinessWorth,
        roi,
        insight,
      };
    },
    enabled: !!dealerId,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
