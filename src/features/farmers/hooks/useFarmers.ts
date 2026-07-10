import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import {
  getFarmers,
  createFarmer,
  updateFarmer,
  getFarmerProductDiscounts,
  upsertFarmerProductDiscount,
  deleteFarmerProductDiscount,
  getUniqueVillages,
  getDuesAgeing,
} from '../services/farmerService';
import type { FarmerInsert } from '@/types/database';
import { toast } from 'sonner';

export function useFarmers(params?: {
  search?: string;
  sortBy?: 'total_due' | 'name' | 'created_at';
  sortDir?: 'asc' | 'desc';
  cropStatus?: string;
  riskStatus?: string;
  village?: string;
  isWalkIn?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmers', dealerId, activeBranchId, params],
    queryFn: async () => {
      const res = await getFarmers({
        dealerId,
        branchId: activeBranchId,
        limit: 1000,
        ...params,
      });
      return res.data;
    },
    enabled: !!dealerId,
  });
}

export function useDuesAgeing() {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmers', 'dues-ageing', dealerId, activeBranchId],
    queryFn: () => getDuesAgeing(dealerId, activeBranchId),
    enabled: !!dealerId,
  });
}

export function useCreateFarmer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FarmerInsert) => createFarmer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add farmer.');
    },
  });
}

export function useUpdateFarmer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { farmerId: string; data: Partial<FarmerInsert> }) =>
      updateFarmer(params.farmerId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['farmer'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update farmer.');
    },
  });
}

export function useVillages() {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmers', 'villages', dealerId],
    queryFn: () => getUniqueVillages(dealerId),
    enabled: !!dealerId,
  });
}

export function useFarmerProductDiscounts(farmerId?: string | null) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['farmer-product-discounts', dealerId, farmerId],
    queryFn: () => getFarmerProductDiscounts(dealerId, farmerId!),
    enabled: !!dealerId && !!farmerId,
  });
}

export function useUpsertFarmerProductDiscount() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (params: { farmerId: string; productId: string; discountPercentage: number }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return upsertFarmerProductDiscount({
        dealerId: user.id,
        farmerId: params.farmerId,
        productId: params.productId,
        discountPercentage: params.discountPercentage,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['farmer-product-discounts', user?.id, variables.farmerId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save product discount.');
    },
  });
}

export function useDeleteFarmerProductDiscount() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (params: { farmerId: string; discountId: string }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return deleteFarmerProductDiscount({ dealerId: user.id, discountId: params.discountId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['farmer-product-discounts', user?.id, variables.farmerId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete product discount.');
    },
  });
}
