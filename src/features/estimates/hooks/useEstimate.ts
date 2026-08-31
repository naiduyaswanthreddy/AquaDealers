// src/features/estimates/hooks/useEstimate.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimateService } from '../services/estimateService';
import type { EstimatePayload } from '../types';

interface UseEstimatesParams {
  dealerId: string;
  farmerId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export function useEstimates(params: UseEstimatesParams) {
  return useQuery({
    queryKey: ['estimates', params],
    queryFn: () => estimateService.getEstimates(params),
    enabled: !!params.dealerId,
    staleTime: 60_000,
  });
}

export function useEstimateDetail(dealerId: string, estimateId: string) {
  return useQuery({
    queryKey: ['estimate', estimateId],
    queryFn: () => estimateService.getEstimateDetail(dealerId, estimateId),
    enabled: !!dealerId && !!estimateId,
    staleTime: 60_000,
  });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EstimatePayload) =>
      estimateService.createEstimate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });
}

export function useUpdateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, payload }: { estimateId: string; payload: EstimatePayload }) =>
      estimateService.updateEstimate(estimateId, payload),
    onSuccess: (_data, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate', estimateId] });
    },
  });
}
