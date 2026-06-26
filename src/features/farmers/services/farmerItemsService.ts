import { supabase } from '@/lib/supabase';
import type { FarmerItemBill, FarmerItemsResponse } from '../types/farmerItems';

export async function getFarmerItems(params: {
  dealerId: string;
  farmerId: string;
  startDate: string;
  endDate: string;
  productType?: string;
  limit?: number;
  offset?: number;
}): Promise<FarmerItemsResponse> {
  const { data, error } = await supabase.rpc('get_farmer_items_v1', {
    p_dealer_id: params.dealerId,
    p_farmer_id: params.farmerId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_product_type: params.productType || null,
    p_limit: params.limit || 20,
    p_offset: params.offset || 0,
  });

  if (error) throw error;
  return data as FarmerItemsResponse;
}

export async function getFarmerItemBills(params: {
  dealerId: string;
  farmerId: string;
  productId: string;
  startDate: string;
  endDate: string;
}): Promise<FarmerItemBill[]> {
  const { data, error } = await supabase.rpc('get_farmer_item_bills_v1', {
    p_dealer_id: params.dealerId,
    p_farmer_id: params.farmerId,
    p_product_id: params.productId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
  });

  if (error) throw error;
  return (data || []) as FarmerItemBill[];
}
