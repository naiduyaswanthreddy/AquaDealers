import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '../services/supplierService';
import { useAuthStore } from '@/stores/authStore';
import { SupplierInsert, SupplierUpdate, PurchasePayload } from '../types';

export const supplierKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (dealerId: string) => [...supplierKeys.lists(), { dealerId }] as const,
  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,
  purchases: (id: string) => [...supplierKeys.detail(id), 'purchases'] as const,
  payments: (id: string) => [...supplierKeys.detail(id), 'payments'] as const,
};

export function useSuppliers() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: supplierKeys.list(user?.id || ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('No dealer ID');
      const res = await supplierService.getSuppliers(user.id, undefined, 1, 1000);
      return res.data;
    },
    enabled: !!user?.id,
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: supplierKeys.detail(id),
    queryFn: () => supplierService.getSupplier(id),
    enabled: !!id,
  });
}

export function useSupplierPurchases(id: string) {
  return useQuery({
    queryKey: supplierKeys.purchases(id),
    queryFn: () => supplierService.getSupplierPurchases(id),
    enabled: !!id,
  });
}

export function useSupplierPayments(id: string) {
  return useQuery({
    queryKey: supplierKeys.payments(id),
    queryFn: () => supplierService.getSupplierPayments(id),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SupplierInsert) => supplierService.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SupplierUpdate) => supplierService.updateSupplier(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(data.id) });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: ({ supplierId, amount, method, notes }: { supplierId: string, amount: number, method: string, notes?: string }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return supplierService.recordPayment(user.id, supplierId, amount, method, notes);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      queryClient.invalidateQueries({ queryKey: supplierKeys.payments(variables.supplierId) });
      queryClient.invalidateQueries({ queryKey: ['cash_book'] });
    },
  });
}

export function useRecordPurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PurchasePayload) => supplierService.recordPurchase(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplier_id) });
      queryClient.invalidateQueries({ queryKey: supplierKeys.purchases(variables.supplier_id) });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cash_book'] });
    },
  });
}

export function useRecordSupplierCharge() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  
  return useMutation({
    mutationFn: ({ supplierId, amount, notes }: { supplierId: string, amount: number, notes?: string }) => {
      if (!user?.id) throw new Error('No dealer ID');
      return supplierService.recordSupplierCharge(user.id, supplierId, amount, notes);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supplierKeys.lists() });
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
    },
  });
}
