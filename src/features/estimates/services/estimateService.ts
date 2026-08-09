// src/features/estimates/services/estimateService.ts
import { supabase } from '@/lib/supabase';
import type { EstimatePayload, EstimateListItem, Estimate } from '../types';

export const estimateService = {
  async createEstimate(
    payload: EstimatePayload
  ): Promise<{ estimate_id: string; estimate_number: string }> {
    const { data, error } = await supabase.rpc('create_estimate_v1', {
      p_payload: payload,
    });
    if (error) throw error;
    return data as { estimate_id: string; estimate_number: string };
  },

  async getEstimates(params: {
    dealerId: string;
    farmerId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ estimates: EstimateListItem[]; total_count: number }> {
    const { data, error } = await supabase.rpc('get_estimates', {
      p_dealer_id:  params.dealerId,
      p_farmer_id:  params.farmerId  ?? null,
      p_start_date: params.startDate ?? null,
      p_end_date:   params.endDate   ?? null,
      p_limit:      params.limit     ?? 20,
      p_offset:     params.offset    ?? 0,
      p_search:     params.search    ?? null,
    });
    if (error) throw error;
    return data as { estimates: EstimateListItem[]; total_count: number };
  },

  async getEstimateDetail(dealerId: string, estimateId: string): Promise<Estimate> {
    const { data, error } = await supabase.rpc('get_estimate_detail', {
      p_dealer_id:   dealerId,
      p_estimate_id: estimateId,
    });
    if (error) throw error;
    return data as Estimate;
  },
};
