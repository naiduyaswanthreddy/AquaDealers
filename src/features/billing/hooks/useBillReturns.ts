import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createBillReturn, createFarmerReturn, getReturnsForBill, previewFarmerReturn, replaceFarmerReturn } from '../services/billReturnsService';

export function useBillReturns(billId: string | undefined) {
  return useQuery({
    queryKey: ['bill-returns', billId],
    queryFn: () => getReturnsForBill(billId!),
    enabled: !!billId,
  });
}

export function useCreateBillReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBillReturn,
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ['bill-returns', vars.billId] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['farmer'] });
      qc.invalidateQueries({ queryKey: ['farmers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['financials'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to record return.'),
  });
}

export function useFarmerReturnPreview() {
  return useMutation({ mutationFn: previewFarmerReturn });
}

export function useCreateFarmerReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFarmerReturn,
    onSuccess: () => {
      for (const key of [['bill-returns-list'], ['bills'], ['farmers'], ['farmer'], ['inventory'], ['dashboard'], ['financials'], ['transactions'], ['daily-book']]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to record return.'),
  });
}

export function useReplaceFarmerReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: replaceFarmerReturn,
    onSuccess: () => {
      for (const key of [['bill-returns-list'], ['bill-returns'], ['bills'], ['farmers'], ['farmer'], ['inventory'], ['dashboard'], ['financials'], ['transactions'], ['daily-book']]) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to update return.'),
  });
}
