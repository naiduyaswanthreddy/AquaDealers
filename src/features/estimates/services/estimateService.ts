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

  async updateEstimate(estimateId: string, payload: EstimatePayload): Promise<void> {
    const { error: headerErr } = await supabase
      .from('estimates')
      .update({
        estimate_date:   payload.estimate_date,
        subtotal:        payload.subtotal,
        gst_amount:      payload.gst_amount,
        discount_amount: payload.discount_amount,
        total:           payload.total,
        notes:           payload.notes ?? null,
      })
      .eq('id', estimateId);
    if (headerErr) throw headerErr;

    const { error: delErr } = await supabase
      .from('estimate_items')
      .delete()
      .eq('estimate_id', estimateId);
    if (delErr) throw delErr;

    const { error: insErr } = await supabase.from('estimate_items').insert(
      payload.items.map(item => ({
        estimate_id:         estimateId,
        product_id:          item.product_id,
        product_name:        item.product_name,
        hsn_code:            item.hsn_code ?? null,
        quantity:            item.quantity,
        unit_price:          item.unit_price,
        discount_percentage: item.discount_percentage,
        gst_rate:            item.gst_rate,
        total_price:         item.total_price,
      }))
    );
    if (insErr) throw insErr;
  },
};
