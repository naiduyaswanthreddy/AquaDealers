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

      const [aggregates, salesSeries, cashSummary, duesSummary, lowStockSummary] = await Promise.all([
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
      ]);

      return {
        todaySales: aggregates?.todaySales || 0,
        yesterdaySales: aggregates?.yesterdaySales || 0,
        todayCredit: aggregates?.todayCredit || 0,
        todayCashReceived: aggregates?.todayCashReceived || 0,
        todayUpiReceived: aggregates?.todayUpiReceived || 0,
        todayChequeReceived: aggregates?.todayChequeReceived || 0,
        todayCount: aggregates?.todayCount || 0,
        totalDues: aggregates?.totalDues || 0,
        dueFarmersCount: aggregates?.dueFarmersCount || 0,
        lowStockCount: lowStockSummary.lowStockCount,
        criticalLowStockCount: lowStockSummary.criticalLowStockCount,
        cashBalance: cashSummary?.currentBalance || 0,
        yesterdayCashBalance: cashSummary?.previousBalance || 0,
        salesSeries: salesSeries || [],
        duesSeries: duesSummary.series,
        lowStockSeries: lowStockSummary.series,
        cashSeries: cashSummary?.series || [],
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
 * Hook to retrieve monthly sales trend.
 */
export function useMonthlySalesTrend() {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['dashboard', 'monthly-sales-trend', dealerId, activeBranchId],
    queryFn: () => getMonthlySalesTrend(dealerId, activeBranchId),
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
