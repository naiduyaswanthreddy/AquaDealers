import { supabase } from '@/lib/supabase';
import { sanitizeSearchTerm } from '@/lib/utils';
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
      paymentStatus?: 'all' | 'paid' | 'unpaid';
      verifiedStatus?: 'all' | 'verified' | 'unverified';
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
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (options?.searchQuery) {
      const search = sanitizeSearchTerm(options.searchQuery.toLowerCase());
      if (search) {
        query = query.or(`bill_number.ilike.%${search}%,farmer_name_snapshot.ilike.%${search}%`);
      }
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('status', options.status);
    }

    if (options?.paymentStatus && options.paymentStatus !== 'all') {
      if (options.paymentStatus === 'paid') {
        query = query.eq('balance_due', 0);
      } else {
        query = query.gt('balance_due', 0);
      }
    }

    const hasVerifiedFilter = !!(options?.verifiedStatus && options.verifiedStatus !== 'all');

    if (options?.verifiedStatus && options.verifiedStatus !== 'all') {
      if (options.verifiedStatus === 'verified') {
        query = query.eq('is_verified', true);
      } else {
        query = query.eq('is_verified', false);
      }
    }

    if (options?.startDate) {
      query = query.gte('bill_date', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('bill_date', options.endDate);
    }

    query = query.range(from, to);

    let { data, count, error } = await query;

    // If column doesn't exist yet in DB, retry without the verified filter
    if (error && hasVerifiedFilter && (error.code === '42703' || error.message?.includes('is_verified'))) {
      let fallback = supabase
        .from('bills')
        .select('*, bill_items(product_name_snapshot, quantity)', { count: 'exact' })
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });

      if (branchId) fallback = fallback.eq('branch_id', branchId);
      if (options?.searchQuery) {
        const search = sanitizeSearchTerm(options.searchQuery.toLowerCase());
        if (search) fallback = fallback.or(`bill_number.ilike.%${search}%,farmer_name_snapshot.ilike.%${search}%`);
      }
      if (options?.status && options.status !== 'all') fallback = fallback.eq('status', options.status);
      if (options?.paymentStatus && options.paymentStatus !== 'all') {
        if (options.paymentStatus === 'paid') fallback = fallback.eq('balance_due', 0);
        else fallback = fallback.gt('balance_due', 0);
      }
      if (options?.startDate) fallback = fallback.gte('bill_date', options.startDate);
      if (options?.endDate) fallback = fallback.lte('bill_date', options.endDate);
      fallback = fallback.range(from, to);

      const result = await fallback;
      data = result.data;
      count = result.count;
      error = result.error;
    }

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
    const { data: result, error: rpcError } = await supabase.rpc('create_bill_v2', {
      p_payload: payload
    });

    if (rpcError) throw rpcError;
    return result as CreateBillResult;
  },

  /**
   * Verify delivery using a PIN
   */
  async verifyDeliveryPin(billId: string, dealerId: string, pin: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_bill_delivery', {
      p_bill_id: billId,
      p_dealer_id: dealerId,
      p_pin: pin
    });

    if (error) throw error;
    return data as boolean;
  },

  async previewFifoBill(payload: BillingPayload): Promise<FifoBillPreview> {
    const { data, error } = await supabase.rpc('preview_fifo_bill_lines', {
      p_payload: payload,
    });

    if (error) throw error;

    return data as FifoBillPreview;
  },

  async saveBillSignature(params: {
    dealerId: string;
    branchId?: string | null;
    billId: string;
    signerName?: string | null;
    signatureData: SignatureStroke[];
    canvasWidth?: number;
    canvasHeight?: number;
  }): Promise<BillSignature> {
    const { data, error } = await supabase
      .from('bill_signatures')
      .upsert({
        dealer_id: params.dealerId,
        branch_id: params.branchId ?? null,
        bill_id: params.billId,
        storage_path: null,
        signature_data: params.signatureData,
        canvas_width: params.canvasWidth ?? 600,
        canvas_height: params.canvasHeight ?? 220,
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
    bill_date?: string;
    edits: {
      bill_item_id: string;
      quantity: number;
      unit_price: number;
    }[];
  }): Promise<any> {
    if (payload.edits.length === 0 && payload.bill_date) {
      const { error } = await supabase
        .from('bills')
        .update({ bill_date: payload.bill_date, is_edited: true })
        .eq('id', payload.bill_id)
        .eq('dealer_id', payload.dealer_id);
      if (error) throw new Error(`Failed to edit bill date: ${error.message}`);
      return { bill_id: payload.bill_id, bill_date: payload.bill_date };
    }

    const { data, error } = await supabase.rpc('edit_bill_v1', {
      p_payload: payload,
    });

    if (error) {
      throw new Error(`Failed to edit bill: ${error.message}`);
    }

    return data;
  },

  async editBillPayment(payload: { bill_id: string; amount_paid: number; payment_type: string | null }): Promise<any> {
    const { data, error } = await supabase.rpc('edit_bill_payment_v1', { p_payload: payload });
    if (error) throw new Error(`Failed to edit bill payment: ${error.message}`);
    return data;
  },

  async applySettlementDiscount(payload: {
    dealer_id: string;
    bill_id: string;
    amount: number;
    reason?: string | null;
  }): Promise<{ bill_id: string; settlement_discount_amount: number; balance_due: number }> {
    const { data, error } = await supabase.rpc('apply_settlement_discount_v1', {
      p_payload: payload,
    });
    if (error) throw new Error(`Failed to apply settlement discount: ${error.message}`);
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
  },

  async getBillStats(
    dealerId: string,
    branchId: string | null,
    startDate: string,
    endDate: string,
  ): Promise<{ count: number; total: number; paid: number; pending: number }> {
    let query = supabase
      .from('bills')
      .select('total, balance_due')
      .eq('dealer_id', dealerId)
      .neq('status', 'cancelled')
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);
    if (branchId) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;
    const bills = data ?? [];
    const total = bills.reduce((s, b) => s + Number(b.total), 0);
    const pending = bills.reduce((s, b) => s + Number(b.balance_due), 0);
    return { count: bills.length, total, paid: total - pending, pending };
  },
};
