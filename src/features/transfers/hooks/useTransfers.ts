import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createStockTransfer, getStockTransfer, listStockTransfers } from '../services/transferService';

export function useStockTransfers(branchId?: string | null) {
  return useQuery({
    queryKey: ['stock-transfers', branchId ?? null],
    queryFn: () => listStockTransfers({ branchId, limit: 100 }),
  });
}

export function useStockTransfer(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-transfer', id],
    queryFn: () => getStockTransfer(id!),
    enabled: !!id,
  });
}

export function useCreateStockTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStockTransfer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create transfer.'),
  });
}
