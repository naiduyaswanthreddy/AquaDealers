import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import {
  getFarmerById,
  getFarmerTransactions,
  getFarmerAgeing,
  getOpenBillsForFarmer,
  collectPayment,
  getFarmerStatement,
} from '../services/farmerService';
import { toast } from 'sonner';

export function useFarmer(farmerId: string) {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => getFarmerById(farmerId),
    enabled: !!farmerId && !!user?.id,
  });
}

export function useFarmerTransactions(farmerId: string) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';
  const { data: farmer } = useFarmer(farmerId);

  return useQuery({
    queryKey: ['farmer', farmerId, 'transactions'],
    queryFn: () => getFarmerTransactions(farmerId, dealerId, farmer?.opening_balance || 0),
    enabled: !!farmerId && !!dealerId && !!farmer,
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
