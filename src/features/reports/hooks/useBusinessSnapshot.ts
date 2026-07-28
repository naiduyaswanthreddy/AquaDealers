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
  /** Realized profit = totalSales − totalPurchasesForSoldGoods − totalExpenses */
  realizedProfit: number;
  /** Net business worth = currentInventoryValue + cashAvailable + outstandingDues */
  netBusinessWorth: number;
  /** ROI % = realizedProfit / totalInvested × 100 */
  roi: number;
  /** Insight message for the dealer */
  insight: string;
}

export function useBusinessSnapshot() {
  const user = useAuthStore((state) => state.user);
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : (activeBranch?.id || null);
  const dealerId = user?.id || '';

  return useQuery<BusinessSnapshot>({
    queryKey: ['business-snapshot', dealerId, branchId],
    queryFn: async (): Promise<BusinessSnapshot> => {
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

      const [
        { data: purchases },
        { data: inventory },
        { data: bills },
        { data: expenses },
        { data: cashEntries },
        { data: farmers },
      ] = await Promise.all([purchasesQ, inventoryQ, billsQ, expensesQ, cashQ, farmersQ]);

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

      // Realized profit: Sales − Purchases (cost of goods sold) − Expenses
      // We approximate cost of goods sold = totalInvested − currentInventoryValue
      const costOfGoodsSold = Math.max(0, totalInvested - currentInventoryValue);
      const realizedProfit = totalSales - costOfGoodsSold - totalExpenses;

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
