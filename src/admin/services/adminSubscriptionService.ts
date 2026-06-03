import { supabase } from '@/lib/supabase';
import { DealerSubscription, SubscriptionPayment } from '../types';
import { getAdminIdOrThrow } from './adminSession';

export const adminSubscriptionService = {
  async getSubscriptions(filters?: {
    status?: string;
    plan?: string;
  }): Promise<any[]> {
    const { data, error } = await supabase.rpc('admin_get_subscriptions', {
      p_admin_id: getAdminIdOrThrow(),
      p_filters: filters || {},
    });

    if (error) throw error;
    return data || [];
  },

  async extendSubscription(params: {
    dealerId: string;
    planName: string;
    days: number;
    amountPaid: number;
    paymentMethod: string;
    notes?: string;
    grantedBy?: string;
  }): Promise<void> {
    const { error } = await supabase.rpc('admin_extend_subscription', {
      p_admin_id: params.grantedBy || getAdminIdOrThrow(),
      p_payload: params,
    });

    if (error) throw error;
  },

  async bulkExtend(params: {
    dealerIds: string[];
    days: number;
    reason: string;
    grantedBy?: string;
  }): Promise<number> {
    let successCount = 0;
    for (const dealerId of params.dealerIds) {
      try {
        await this.extendSubscription({
          dealerId,
          planName: 'basic', // default for bulk
          days: params.days,
          amountPaid: 0,
          paymentMethod: 'complimentary',
          notes: params.reason,
          grantedBy: params.grantedBy,
        });
        successCount++;
      } catch {
        // Log error but continue
      }
    }
    return successCount;
  },

  async getPaymentHistory(dealerId: string): Promise<SubscriptionPayment[]> {
    const { data, error } = await supabase
      .rpc('admin_get_subscription_payments', {
        p_admin_id: getAdminIdOrThrow(),
        p_dealer_id: dealerId,
      });

    if (error) throw error;
    return (data || []) as SubscriptionPayment[];
  },

  async getRevenueMetrics() {
    const { data: subs } = await supabase
      .rpc('admin_get_revenue_metrics', {
        p_admin_id: getAdminIdOrThrow(),
      });

    return subs || { mrr: 0, arr: 0, activePaid: 0, trialCount: 0 };
  },
};
