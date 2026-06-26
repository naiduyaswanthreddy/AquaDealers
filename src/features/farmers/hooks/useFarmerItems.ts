import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getFarmerItemBills, getFarmerItems } from '../services/farmerItemsService';

const PAGE_SIZE = 20;

export function useFarmerItems(params: {
  farmerId: string;
  startDate: string;
  endDate: string;
  productType?: string;
}) {
  const dealerId = useAuthStore((state) => state.user?.id || '');

  return useInfiniteQuery({
    queryKey: ['farmer-items', params.farmerId, params.startDate, params.endDate, params.productType || 'all'],
    queryFn: ({ pageParam }) => getFarmerItems({
      ...params,
      dealerId,
      limit: PAGE_SIZE,
      offset: pageParam,
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.items.length;
      return nextOffset < lastPage.total_count ? nextOffset : undefined;
    },
    enabled: Boolean(dealerId && params.farmerId && params.startDate && params.endDate),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useFarmerItemBills(params: {
  farmerId: string;
  productId: string;
  startDate: string;
  endDate: string;
  enabled: boolean;
}) {
  const dealerId = useAuthStore((state) => state.user?.id || '');

  return useQuery({
    queryKey: ['farmer-item-bills', params.farmerId, params.productId, params.startDate, params.endDate],
    queryFn: () => getFarmerItemBills({
      dealerId,
      farmerId: params.farmerId,
      productId: params.productId,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
    enabled: params.enabled && Boolean(dealerId && params.productId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
