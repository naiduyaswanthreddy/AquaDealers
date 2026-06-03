import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminDealerService } from '../services/adminDealerService';

export const adminDealerKeys = {
  all: ['admin-dealers'] as const,
  list: (params?: any) => [...adminDealerKeys.all, 'list', params] as const,
  profile: (id: string) => [...adminDealerKeys.all, 'profile', id] as const,
  stats: (id: string) => [...adminDealerKeys.all, 'stats', id] as const,
};

export function useAdminDealers(params?: {
  search?: string;
  plan?: string;
  status?: string;
  district?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: adminDealerKeys.list(params),
    queryFn: () => adminDealerService.getDealers(params),
    staleTime: 0, // Always fetch fresh data for the list
  });
}

export function useAdminDealerProfile(dealerId: string) {
  return useQuery({
    queryKey: adminDealerKeys.profile(dealerId),
    queryFn: () => adminDealerService.getDealerProfile(dealerId),
    enabled: !!dealerId,
  });
}

export function useAdminDealerStats(dealerId: string) {
  return useQuery({
    queryKey: adminDealerKeys.stats(dealerId),
    queryFn: () => adminDealerService.getDealerStats(dealerId),
    enabled: !!dealerId,
  });
}

export function useSuspendDealer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealerId, reason }: { dealerId: string; reason: string }) =>
      adminDealerService.suspendDealer(dealerId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminDealerKeys.all }),
  });
}

export function useUnsuspendDealer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealerId: string) => adminDealerService.unsuspendDealer(dealerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminDealerKeys.all }),
  });
}

export function useUpdateDealerAddons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dealerId, features }: { dealerId: string; features: string[] }) =>
      adminDealerService.updateDealerAddons(dealerId, features),
    onMutate: async ({ dealerId, features }) => {
      await queryClient.cancelQueries({ queryKey: adminDealerKeys.list() });
      
      const queryCache = queryClient.getQueryCache();
      const listQueries = queryCache.findAll({ queryKey: adminDealerKeys.all });
      const previousDataMap = new Map();

      listQueries.forEach((query) => {
        if (query.queryKey[1] === 'list') {
          const previousData = queryClient.getQueryData(query.queryKey);
          previousDataMap.set(query.queryKey, previousData);
          
          if (previousData && (previousData as any).data) {
            queryClient.setQueryData(query.queryKey, (old: any) => {
              if (!old || !old.data) return old;
              return {
                ...old,
                data: old.data.map((dealer: any) =>
                  dealer.id === dealerId ? { ...dealer, custom_features: features } : dealer
                ),
              };
            });
          }
        }
      });

      return { previousDataMap };
    },
    onError: (err, variables, context: any) => {
      if (context?.previousDataMap) {
        context.previousDataMap.forEach((data: any, queryKey: any) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: (_, __, { dealerId }) => {
      queryClient.invalidateQueries({ queryKey: adminDealerKeys.profile(dealerId) });
      queryClient.invalidateQueries({ queryKey: adminDealerKeys.list() });
    },
  });
}
