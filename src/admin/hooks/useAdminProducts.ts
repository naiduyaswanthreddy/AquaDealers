import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProductService } from '../services/adminProductService';
import { Product } from '@/types/database';

export const adminProductKeys = {
  all: ['admin-products'] as const,
  list: (type?: string) => [...adminProductKeys.all, 'list', type] as const,
};

export function useAdminProducts(type?: string) {
  return useQuery({
    queryKey: adminProductKeys.list(type),
    queryFn: () => adminProductService.getProducts(type),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (product: Partial<Product>) => adminProductService.createProduct(product),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminProductKeys.all }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Product> }) =>
      adminProductService.updateProduct(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminProductKeys.all }),
  });
}

export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminProductService.toggleProductActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminProductKeys.all }),
  });
}
