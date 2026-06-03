import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financialService } from '../services/financialService';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { CashBookInsert, CashClosingPayload, ExpenseInsert } from '../types';

export const financialKeys = {
  all: ['financials'] as const,
  expenses: (dealerId: string, branchId?: string | null) => [...financialKeys.all, 'expenses', { dealerId, branchId }] as const,
  cashbook: (dealerId: string, branchId?: string | null, dates?: { start?: string, end?: string }) => 
    [...financialKeys.all, 'cashbook', { dealerId, branchId, dates }] as const,
  dailyCash: (dealerId: string, branchId?: string | null, date?: string) =>
    [...financialKeys.all, 'daily-cash', { dealerId, branchId, date }] as const,
};

export function useExpenses() {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: financialKeys.expenses(user?.id || '', branchId),
    queryFn: async () => {
      if (!user?.id) throw new Error('No dealer ID');
      const res = await financialService.getExpenses(user.id, branchId, undefined, 1, 1000);
      return res.data;
    },
    enabled: !!user?.id,
  });
}

export function useRecordExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseInsert) => financialService.recordExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all });
    },
  });
}

export function useCashBook(startDate?: string, endDate?: string) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: financialKeys.cashbook(user?.id || '', branchId, { start: startDate, end: endDate }),
    queryFn: () => {
      if (!user?.id) throw new Error('No dealer ID');
      return financialService.getCashBookEntries(user.id, branchId, startDate, endDate);
    },
    enabled: !!user?.id,
  });
}

export function useAddCashEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CashBookInsert) => financialService.addManualCashEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all });
    },
  });
}

export function useDailyCashClarity(date: string) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: financialKeys.dailyCash(user?.id || '', branchId, date),
    queryFn: () => {
      if (!user?.id) throw new Error('No dealer ID');
      return financialService.getDailyCashClarity(user.id, branchId, date);
    },
    enabled: !!user?.id && !!date,
  });
}

export function useCloseCashDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CashClosingPayload) => financialService.closeCashDay(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financialKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
