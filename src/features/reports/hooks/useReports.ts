import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { reportsService } from '../services/reportsService';
import { MonthlyFinancePackFilters } from '../types';

export const reportKeys = {
  all: ['reports'] as const,
  dashboard: (dealerId: string, branchId?: string | null, dates?: { start?: string, end?: string }) =>
    [...reportKeys.all, 'dashboard', { dealerId, branchId, dates }] as const,
  gst: (dealerId: string, branchId?: string | null, period?: { month: number, year: number }) =>
    [...reportKeys.all, 'gst', { dealerId, branchId, period }] as const,
  financePack: (dealerId: string, branchId?: string | null, period?: MonthlyFinancePackFilters) =>
    [...reportKeys.all, 'finance-pack', { dealerId, branchId, period }] as const,
};

export function useMonthlyFinancePack(month: number, year: number) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : (activeBranch?.id || null);

  return useQuery({
    queryKey: reportKeys.financePack(user?.id || '', branchId, { month, year }),
    queryFn: async () => {
      if (!user) throw new Error('User not found');
      return reportsService.getMonthlyFinancePack(user.id, branchId, month, year);
    },
    enabled: !!user?.id,
  });
}

export function useDashboardMetrics(startDate?: string, endDate?: string) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : (activeBranch?.id || null);

  return useQuery({
    queryKey: reportKeys.dashboard(user?.id || '', branchId, { start: startDate, end: endDate }),
    queryFn: async () => {
      if (!user) throw new Error('User not found');
      return reportsService.getDashboardMetrics(user.id, branchId, startDate, endDate);
    },
    enabled: !!user?.id,
  });
}

export function useGSTReport(month: number, year: number) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : (activeBranch?.id || null);

  return useQuery({
    queryKey: reportKeys.gst(user?.id || '', branchId, { month, year }),
    queryFn: async () => {
      if (!user) throw new Error('User not found');
      return reportsService.getGSTReport(user.id, branchId, month, year);
    },
    enabled: !!user?.id,
  });
}
