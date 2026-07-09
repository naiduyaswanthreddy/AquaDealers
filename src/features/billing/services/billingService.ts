import { supabase } from '@/lib/supabase';
import { BillingPayload, CreateBillResult, FifoBillPreview } from '../types';
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
      .select('*, bill_items(product_name_snapshot, quantity)', { count: 'exact' })
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
      .select('*, bill_items(*), bill_signatures(*), farmers(*)')
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

  async previewFifoBill(payload: BillingPayload): Promise<FifoBillPreview> {
    const { data, error } = await supabase.rpc('preview_fifo_bill_lines', {
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Failed to preview FIFO bill: ${error.message}`);
    }

    return data as FifoBillPreview;
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
  },

  async editBill(payload: {
    bill_id: string;
    dealer_id: string;
    edits: {
      bill_item_id: string;
      quantity: number;
      unit_price: number;
    }[];
  }): Promise<any> {
    const { data, error } = await supabase.rpc('edit_bill_v1', {
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Failed to edit bill: ${error.message}`);
    }

    return data;
  },

  async getBillAuditLogs(billId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('bill_audit_logs')
      .select('*')
      .eq('bill_id', billId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch bill audit logs: ${error.message}`);
    }

    return data || [];
  }
};
