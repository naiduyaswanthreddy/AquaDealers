import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSubscriptionService } from '../services/adminSubscriptionService';

export const adminSubKeys = {
  all: ['admin-subscriptions'] as const,
  list: (filters?: any) => [...adminSubKeys.all, 'list', filters] as const,
  revenue: () => [...adminSubKeys.all, 'revenue'] as const,
  payments: (dealerId: string) => [...adminSubKeys.all, 'payments', dealerId] as const,
};

export function useAdminSubscriptions(filters?: { status?: string; plan?: string }) {
  return useQuery({
    queryKey: adminSubKeys.list(filters),
    queryFn: () => adminSubscriptionService.getSubscriptions(filters),
  });
}

export function useAdminRevenue() {
  return useQuery({
    queryKey: adminSubKeys.revenue(),
    queryFn: () => adminSubscriptionService.getRevenueMetrics(),
  });
}

export function useExtendSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminSubscriptionService.extendSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSubKeys.all }),
  });
}

export function useBulkExtend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminSubscriptionService.bulkExtend,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminSubKeys.all }),
  });
}
