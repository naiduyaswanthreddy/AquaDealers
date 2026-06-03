import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../services/inventoryService';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';

export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (dealerId: string, branchId?: string | null) =>
    [...inventoryKeys.lists(), { dealerId, branchId }] as const,
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (dealerId: string, inventoryId: string, branchId?: string | null) =>
    [...inventoryKeys.details(), { dealerId, inventoryId, branchId }] as const,
  products: () => ['products'] as const,
};

export function useInventory() {
  // We no longer use useQuery to fetch ALL inventory immediately.
  // Instead, InventoryPage uses useLoadMoreList with inventoryService.getInventory directly.
  // But we still might want to expose a query for summary statistics (all items) if needed,
  // or we can remove it. For now, we'll keep it as fetching the first 1000 items to power the summary cards,
  // since the summary cards need global totals.
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: inventoryKeys.list(user?.id || '', branchId),
    queryFn: async () => {
      if (!user?.id) throw new Error('No dealer ID');
      // Fetch a large page for the summary cards. Real pagination happens in useLoadMoreList
      const res = await inventoryService.getInventory(user.id, branchId, { limit: 1000 });
      return res.data;
    },
    enabled: !!user?.id,
  });
}

export function useProducts() {
  return useQuery({
    queryKey: inventoryKeys.products(),
    queryFn: () => inventoryService.getProducts(),
  });
}

export function useInventoryDetail(inventoryId: string) {
  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  return useQuery({
    queryKey: inventoryKeys.detail(user?.id || '', inventoryId, branchId),
    queryFn: () => {
      if (!user?.id) throw new Error('No dealer ID');
      return inventoryService.getInventoryDetail(inventoryId, user.id, branchId);
    },
    enabled: !!user?.id && !!inventoryId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: import('@/types/database').ProductInsert) => inventoryService.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.products() });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      inventoryId,
      currentQty,
      adjustmentQty,
      reason,
    }: {
      inventoryId: string;
      currentQty: number;
      adjustmentQty: number;
      reason: string;
    }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return inventoryService.adjustStock(
        inventoryId,
        user.id,
        currentQty,
        adjustmentQty,
        reason
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUpdateAlertThreshold() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      inventoryId,
      minStockAlert,
    }: {
      inventoryId: string;
      minStockAlert: number;
    }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return inventoryService.updateAlertThreshold(inventoryId, user.id, minStockAlert);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: ({
      inventoryId,
      updates,
    }: {
      inventoryId: string;
      updates: {
        selling_price?: number | null;
        cost_price?: number | null;
        min_stock_alert?: number;
        medicine_discount_percentage?: number;
      };
    }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return inventoryService.updateInventory(inventoryId, user.id, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(user?.id || '', variables.inventoryId, null) });
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}
