import { supabase } from '@/lib/supabase';
import { BillingPayload, CreateBillResult } from '../types';
import { Bill, BillSignature, SignatureStroke } from '@/types/database';

export const billingService = {
  /**
   * Fetch all bills for a dealer
   */
  async getBills(
    dealerId: string, 
    branchId?: string | null,
    options?: {
      page?: number;
      limit?: number;
      searchQuery?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ data: Bill[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('bills')
      .select('*', { count: 'exact' })
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (options?.searchQuery) {
      const search = options.searchQuery.toLowerCase();
      query = query.or(`bill_number.ilike.%${search}%,farmer_name_snapshot.ilike.%${search}%`);
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.startDate) {
      query = query.gte('bill_date', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('bill_date', options.endDate);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      data: data as Bill[],
      total: count || 0
    };
  },

  /**
   * Fetch a specific bill with its items
   */
  async getBillDetails(billId: string) {
    const { data, error } = await supabase
      .from('bills')
      .select('*, bill_items(*), bill_signatures(*)')
      .eq('id', billId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new bill (sequential MVP implementation)
   */
  async createBill(payload: BillingPayload): Promise<CreateBillResult> {
    const { data, error } = await supabase.rpc('create_bill_v2', {
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Failed to create bill: ${error.message}`);
    }

    return data as CreateBillResult;
  },

  async saveBillSignature(params: {
    dealerId: string;
    branchId?: string | null;
    billId: string;
    signerName?: string | null;
    signatureData: SignatureStroke[];
  }): Promise<BillSignature> {
    const { data, error } = await supabase
      .from('bill_signatures')
      .upsert({
        dealer_id: params.dealerId,
        branch_id: params.branchId ?? null,
        bill_id: params.billId,
        storage_path: null,
        signature_data: params.signatureData,
        canvas_width: 600,
        canvas_height: 220,
        signer_name: params.signerName ?? null,
        captured_at: new Date().toISOString(),
      }, { onConflict: 'bill_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save signature record: ${error.message}`);
    }

    return data as BillSignature;
  }
};
