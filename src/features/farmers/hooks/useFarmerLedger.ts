import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import {
  getFarmerById,
  getFarmerBillsPage,
  getFarmerPaymentsPage,
  getFarmerTransactions,
  getFarmerLedgerPage,
  getFarmerAgeing,
  getOpenBillsForFarmer,
  collectPayment,
  getFarmerStatement,
} from '../services/farmerService';
import { toast } from 'sonner';

const FARMER_LEDGER_PAGE_SIZE = 10;

export function useFarmer(farmerId: string) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => getFarmerById(farmerId),
    enabled: !!farmerId && !!user?.id,
  });
}

export function useFarmerTransactions(farmerId: string, enabled = true) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';
  const { data: farmer } = useFarmer(farmerId);

  return useQuery({
    queryKey: ['farmer', farmerId, 'transactions'],
    queryFn: () => getFarmerTransactions(farmerId, dealerId, farmer?.opening_balance || 0),
    enabled: enabled && !!farmerId && !!dealerId && !!farmer,
  });
}

/**
 * Scalable paginated ledger using the server-side RPC.
 * Use this for the combined transactions view. Falls back to useFarmerTransactions
 * for components that need the running-balance calculation.
 */
export function useFarmerLedgerPage(params: {
  farmerId: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
  pageSize?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';
  const limit = params.pageSize ?? 20;

  return useInfiniteQuery({
    queryKey: ['farmer', params.farmerId, 'ledger-page', dealerId, params.startDate || '', params.endDate || ''],
    queryFn: ({ pageParam }) =>
      getFarmerLedgerPage({
        farmerId: params.farmerId,
        dealerId,
        page: pageParam,
        limit,
        startDate: params.startDate,
        endDate: params.endDate,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const fetched = (lastPage.page - 1) * lastPage.limit + lastPage.data.length;
      return fetched < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: (params.enabled ?? true) && !!dealerId && !!params.farmerId,
  });
}

export function useFarmerBillsPage(params: {
  farmerId: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useInfiniteQuery({
    queryKey: ['farmer', params.farmerId, 'bills-page', dealerId, params.startDate || '', params.endDate || ''],
    queryFn: ({ pageParam }) =>
      getFarmerBillsPage({
        dealerId,
        farmerId: params.farmerId,
        startDate: params.startDate,
        endDate: params.endDate,
        limit: FARMER_LEDGER_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.rows.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: (params.enabled ?? true) && !!dealerId && !!params.farmerId,
  });
}

export function useFarmerPaymentsPage(params: {
  farmerId: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useInfiniteQuery({
    queryKey: ['farmer', params.farmerId, 'payments-page', dealerId, params.startDate || '', params.endDate || ''],
    queryFn: ({ pageParam }) =>
      getFarmerPaymentsPage({
        dealerId,
        farmerId: params.farmerId,
        startDate: params.startDate,
        endDate: params.endDate,
        limit: FARMER_LEDGER_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.rows.length;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    enabled: (params.enabled ?? true) && !!dealerId && !!params.farmerId,
  });
}

export function useFarmerStatement(farmerId: string, startDate: string, endDate: string) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmer', farmerId, 'statement', startDate, endDate],
    queryFn: () => getFarmerStatement(farmerId, dealerId, startDate, endDate),
    enabled: !!farmerId && !!dealerId && !!startDate && !!endDate,
  });
}

export function useFarmerAgeing(farmerId: string) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmer', farmerId, 'ageing'],
    queryFn: () => getFarmerAgeing(farmerId, dealerId),
    enabled: !!farmerId && !!dealerId,
  });
}

export function useFarmerOpenBills(farmerId: string) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmer', farmerId, 'open-bills'],
    queryFn: () => getOpenBillsForFarmer(farmerId, dealerId),
    enabled: !!farmerId && !!dealerId,
  });
}

export function useCollectPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: collectPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmer'] });
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-items'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-item-bills'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to record payment.');
    },
  });
}
