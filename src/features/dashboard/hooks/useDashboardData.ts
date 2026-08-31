import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import {
  getTodaySales,
  getPaymentSplitForDate,
  getSalesSummaryForDate,
  getSalesSeries,
  getDuesSummary,
  getLowStockSummary,
  getCashSummary,
  getLowStockItems,
  getExpiringMedicines,
  getRecentTransactions,
  getMonthlySalesTrend,
  getTopSoldProducts,
  getCollectTodayFarmers,
  getTodaySoldItems,
  getTopCustomers,
} from '../services/dashboardService';
import { supabase } from '@/lib/supabase';

/**
 * Hook to retrieve all core dashboard statistics aggregated in a single query object.
 */
export function useDashboardStats() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());

  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'stats', dealerId, activeBranchId],
    queryFn: async () => {
      if (!dealerId) {
        return {
          todaySales: 0,
          yesterdaySales: 0,
          todayCredit: 0,
          todayCashReceived: 0,
          todayUpiReceived: 0,
          todayChequeReceived: 0,
          todayCount: 0,
          totalDues: 0,
          dueFarmersCount: 0,
          lowStockCount: 0,
          criticalLowStockCount: 0,
          cashBalance: 0,
          yesterdayCashBalance: 0,
          salesSeries: [0],
          duesSeries: [0],
          lowStockSeries: [0],
          cashSeries: [0],
        };
      }

      const todayDate = new Intl.DateTimeFormat('en-CA').format(new Date());

      const [aggregates, salesSeries, cashSummary, duesSummary, lowStockSummary, expensesResult, returnsResult, invTotal, invOutOfStock, billsWithItems] = await Promise.all([
        supabase.rpc('get_dashboard_aggregates', {
          p_dealer_id: dealerId,
          p_branch_id: activeBranchId || null,
          p_date_str: todayDate
        }).then(res => res.data as any),
        supabase.rpc('get_sales_series_rpc', {
          p_dealer_id: dealerId,
          p_branch_id: activeBranchId || null,
          p_days: 7,
          p_end_date: todayDate
        }).then(res => res.data as number[]),
        supabase.rpc('get_cash_summary_rpc', {
          p_dealer_id: dealerId,
          p_branch_id: activeBranchId || null,
          p_days: 7,
          p_end_date: todayDate
        }).then(res => res.data as any),
        getDuesSummary(dealerId, activeBranchId),
        getLowStockSummary(dealerId, activeBranchId),
        (async () => {
          let q = supabase.from('expenses').select('amount').eq('dealer_id', dealerId).eq('expense_date', todayDate);
          if (activeBranchId) q = q.eq('branch_id', activeBranchId);
          return q.then(r => r.data ?? []);
        })(),
        (async () => {
          let q = supabase.from('bill_returns').select('total_amount').eq('dealer_id', dealerId).eq('return_date', todayDate);
          if (activeBranchId) q = q.eq('branch_id', activeBranchId);
          return q.then(r => r.data ?? []);
        })(),
        supabase.from('inventory').select('id', { count: 'exact', head: true }).eq('dealer_id', dealerId)
          .then(r => r.count ?? 0),
        supabase.from('inventory').select('id', { count: 'exact', head: true }).eq('dealer_id', dealerId)
          .lte('quantity_in_stock', 0).then(r => r.count ?? 0),
        (async () => {
          let q = supabase.from('bills').select('id, bill_items(quantity, unit_price, total_price, inventory_id_snapshot)')
            .eq('dealer_id', dealerId)
            .eq('bill_date', todayDate)
            .eq('status', 'active')
            .eq('is_estimate', false);
          if (activeBranchId) q = q.eq('branch_id', activeBranchId);
          return q.then(r => r.data ?? []);
        })(),
      ]);

      let trueProfit = 0;
      const todayBills = (billsWithItems as any[]) || [];
      const billItems = todayBills.flatMap(b => b.bill_items || []);
      
      if (billItems.length > 0) {
        // Collect unique inventory IDs to fetch their cost prices
        const invIds = [...new Set(billItems.map(item => item.inventory_id_snapshot).filter(Boolean))];
        
        let costMap: Record<string, number> = {};
        if (invIds.length > 0) {
          const { data: invData } = await supabase
            .from('inventory')
            .select('id, cost_price')
            .in('id', invIds);
            
          costMap = (invData || []).reduce((acc: any, inv: any) => {
            acc[inv.id] = Number(inv.cost_price || 0);
            return acc;
          }, {});
        }
        
        // Calculate true profit: (Selling Unit Price - Cost Price) * Quantity
        trueProfit = billItems.reduce((sum, item) => {
          const sellingRevenue = Number(item.unit_price || 0) * Number(item.quantity || 0);
          const costPrice = item.inventory_id_snapshot ? (costMap[item.inventory_id_snapshot] || 0) : 0;
          const totalCost = costPrice * Number(item.quantity || 0);
          return sum + (sellingRevenue - totalCost);
        }, 0);
      }

      const todayExpenses = (expensesResult as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0);
      const todayReturns = (returnsResult as { total_amount: number }[]).reduce((s, r) => s + Number(r.total_amount), 0);

      return {
        todaySales: aggregates?.todaySales || 0,
        yesterdaySales: aggregates?.yesterdaySales || 0,
        todayCredit: aggregates?.todayCredit || 0,
        todayCashReceived: aggregates?.todayCashReceived || 0,
        todayUpiReceived: aggregates?.todayUpiReceived || 0,
        todayChequeReceived: aggregates?.todayChequeReceived || 0,
        todayCount: aggregates?.todayCount || 0,
        totalDues: duesSummary.total,
        dueFarmersCount: duesSummary.dueFarmersCount,
        lowStockCount: lowStockSummary.lowStockCount,
        criticalLowStockCount: lowStockSummary.criticalLowStockCount,
        cashBalance: cashSummary?.currentBalance || 0,
        yesterdayCashBalance: cashSummary?.previousBalance || 0,
        salesSeries: salesSeries || [],
        duesSeries: duesSummary.series,
        lowStockSeries: lowStockSummary.series,
        cashSeries: cashSummary?.series || [],
        todayExpenses,
        todayReturns,
        todayProfit: trueProfit - todayExpenses - todayReturns,
        totalInventoryItems: invTotal as number,
        outOfStockCount: invOutOfStock as number,
      };
    },
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve the list of farmers ready for collection today.
 */
export function useCollectToday() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'collect-today', dealerId, activeBranchId],
    queryFn: () => getCollectTodayFarmers(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve low stock inventory items.
 */
export function useLowStockAlerts() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'low-stock-items', dealerId, activeBranchId],
    queryFn: () => getLowStockItems(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve expiring medicine items.
 */
export function useExpiringMedicinesAlerts() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'expiring-medicines', dealerId, activeBranchId],
    queryFn: () => getExpiringMedicines(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve recent transactions (bills + payments).
 */
export function useRecentTransactionsList(limit: number = 8) {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'recent-transactions', dealerId, activeBranchId, limit],
    queryFn: () => getRecentTransactions(dealerId, activeBranchId, limit),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve items sold today.
 */
export function useTodaySoldItems() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'today-sold-items', dealerId, activeBranchId],
    queryFn: () => getTodaySoldItems(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve monthly sales trend.
 */
export function useMonthlySalesTrend(startDate?: string, endDate?: string) {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'monthly-sales-trend', dealerId, activeBranchId, startDate, endDate],
    queryFn: () => getMonthlySalesTrend(dealerId, activeBranchId, startDate, endDate),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve top sold products.
 */
export function useTopSoldProducts() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'top-sold-products', dealerId, activeBranchId],
    queryFn: () => getTopSoldProducts(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

/**
 * Hook to retrieve top customers by outstanding dues.
 */
export function useTopCustomers() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'top-customers', dealerId, activeBranchId],
    queryFn: () => getTopCustomers(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}
