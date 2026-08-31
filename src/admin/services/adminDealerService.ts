import { supabase } from '@/lib/supabase';
import { AdminDealerListItem } from '../types';
import { Dealer, WhatsappAddonPlan } from '@/types/database';
import { getAdminIdOrThrow } from './adminSession';

export const adminDealerService = {
  async getDealers(params?: {
    search?: string;
    plan?: string;
    status?: string;
    district?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ data: AdminDealerListItem[]; count: number }> {
    const { data, error } = await supabase.rpc('admin_get_dealers', {
      p_admin_id: getAdminIdOrThrow(),
      p_filters: params || {},
    });

    if (error) throw error;
    return {
      data: (data?.data || []) as AdminDealerListItem[],
      count: data?.count || 0,
    };
  },

  async getDealerProfile(dealerId: string): Promise<Dealer & { branches?: any[]; onboarding?: any }> {
    const { data, error } = await supabase.rpc('admin_get_dealer_profile', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
    });

    if (error) throw error;
    return data as Dealer & { branches?: any[]; onboarding?: any };
  },

  async getDealerStats(dealerId: string) {
    const { data, error } = await supabase.rpc('admin_get_dealer_stats', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
    });

    if (error) throw error;
    return data;
  },

  async suspendDealer(dealerId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('admin_set_dealer_status', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
      p_is_active: false,
      p_reason: reason,
    });
    if (error) throw error;
  },

  async unsuspendDealer(dealerId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_set_dealer_status', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
      p_is_active: true,
      p_reason: null,
    });
    if (error) throw error;
  },

  async updateDealerAddons(dealerId: string, features: string[]): Promise<void> {
    const { error } = await supabase.rpc('admin_update_dealer_addons', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
      p_features: features,
    });
    if (error) throw error;
  },

  async getWhatsappPlans(): Promise<WhatsappAddonPlan[]> {
    const { data, error } = await supabase.rpc('admin_get_whatsapp_plans', {
      p_admin_id: getAdminIdOrThrow(),
    });
    if (error) throw error;
    return data || [];
  },

  async upsertWhatsappPlan(plan: { id?: string; name: string; monthlyLimit: number }): Promise<void> {
    const { error } = await supabase.rpc('admin_upsert_whatsapp_plan', {
      p_admin_id: getAdminIdOrThrow(),
      p_id: plan.id || null,
      p_name: plan.name,
      p_monthly_limit: plan.monthlyLimit,
    });
    if (error) throw error;
  },

  async setDealerWhatsappAddon(dealerId: string, planId: string | null, enabled: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_set_dealer_whatsapp_addon', {
      p_admin_id: getAdminIdOrThrow(),
      p_dealer_id: dealerId,
      p_plan_id: planId,
      p_enabled: enabled,
    });
    if (error) throw error;
  },

  async getWhatsappOverview(): Promise<{
    price_per_message: number;
    total_sent_this_month: number;
    total_cost_this_month: number;
    per_dealer: { dealer_id: string; used: number }[];
  }> {
    const { data, error } = await supabase.rpc('admin_get_whatsapp_overview', {
      p_admin_id: getAdminIdOrThrow(),
    });
    if (error) throw error;
    return data;
  },

  async setWhatsappPrice(price: number): Promise<void> {
    const { error } = await supabase.rpc('admin_set_whatsapp_price', {
      p_admin_id: getAdminIdOrThrow(),
      p_price: price,
    });
    if (error) throw error;
  },
};
