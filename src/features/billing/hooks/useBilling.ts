import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingService } from '../services/billingService';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { BillingPayload } from '../types';

export const billingKeys = {
  all: ['bills'] as const,
  lists: () => [...billingKeys.all, 'list'] as const,
  list: (dealerId: string, branchId?: string | null) =>
    [...billingKeys.lists(), { dealerId, branchId }] as const,
  details: () => [...billingKeys.all, 'detail'] as const,
  detail: (id: string) => [...billingKeys.details(), id] as const,
};

export function useBills() {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: billingKeys.list(user?.id || '', branchId),
    queryFn: async () => {
      if (!user?.id) throw new Error('No dealer ID');
      const res = await billingService.getBills(user.id, branchId, { limit: 100 });
      return res.data;
    },
    enabled: !!user?.id,
  });
}

export function useBillDetails(billId: string) {
  return useQuery({
    queryKey: billingKeys.detail(billId),
    queryFn: () => billingService.getBillDetails(billId),
    enabled: !!billId,
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BillingPayload) => billingService.createBill(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-items'] });
    },
  });
}
