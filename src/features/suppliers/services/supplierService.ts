import { supabase } from '@/lib/supabase';
import {
  SupplierItem,
  SupplierInsert,
  SupplierUpdate,
  PurchasePayload,
  PurchaseItem,
  PaymentItem,
  PurchaseResult,
  SupplierPaymentResult,
} from '../types';

export const supplierService = {
  async getSuppliers(
    dealerId: string,
    search?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: SupplierItem[]; total: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('dealer_id', dealerId)
      .order('name');
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%,alternate_phone.ilike.%${search}%`);
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    
    return {
      data: data as SupplierItem[],
      total: count || 0
    };
  },

  async getSupplier(id: string): Promise<SupplierItem> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as SupplierItem;
  },

  async createSupplier(supplier: SupplierInsert): Promise<SupplierItem> {
    const { data, error } = await supabase
      .from('suppliers')
      .insert(supplier)
      .select()
      .single();
    
    if (error) throw error;
    return data as SupplierItem;
  },

  async updateSupplier(supplier: SupplierUpdate): Promise<SupplierItem> {
    const { id, ...updates } = supplier;
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as SupplierItem;
  },

  async getSupplierPurchases(supplierId: string): Promise<PurchaseItem[]> {
    const { data, error } = await supabase
      .from('stock_purchases')
      .select('*, products(*)')
      .eq('supplier_id', supplierId)
      .order('purchase_date', { ascending: false });
    
    if (error) throw error;
    return data.map((item: any) => ({
      ...item,
      product: item.products,
    })) as PurchaseItem[];
  },

  async getSupplierPayments(supplierId: string): Promise<PaymentItem[]> {
    const { data, error } = await supabase
      .from('supplier_payments')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('payment_date', { ascending: false });
    
    if (error) throw error;
    return data as PaymentItem[];
  },

  async recordPayment(
    dealerId: string,
    supplierId: string,
    amount: number,
    method: string,
    notes?: string
  ): Promise<SupplierPaymentResult> {
    const { data, error } = await supabase.rpc('record_supplier_payment_v2', {
      p_payload: {
        dealer_id: dealerId,
        supplier_id: supplierId,
        amount,
        method,
        notes: notes || null,
      },
    });

    if (error) throw error;
    return data as SupplierPaymentResult;
  },

  async recordPurchase(payload: PurchasePayload): Promise<PurchaseResult> {
    const { data, error } = await supabase.rpc('record_stock_purchase_v2', {
      p_payload: payload,
    });

    if (error) throw error;
    return data as PurchaseResult;
  },

  async recordSupplierCharge(
    dealerId: string,
    supplierId: string,
    amount: number,
    notes?: string
  ): Promise<{ success: boolean }> {
    const { data, error } = await supabase.rpc('record_supplier_charge', {
      p_payload: {
        dealer_id: dealerId,
        supplier_id: supplierId,
        amount,
        notes: notes || null,
      },
    });

    if (error) throw error;
    return data as { success: boolean };
  }
};
