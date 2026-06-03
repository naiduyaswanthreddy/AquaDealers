import { supabase } from '@/lib/supabase';
import { getAdminIdOrThrow } from './adminSession';

export const adminMetricsService = {
  async getPlatformKPIs() {
    const { data, error } = await supabase.rpc('admin_get_platform_kpis', {
      p_admin_id: getAdminIdOrThrow(),
    });

    if (error) throw error;
    return data;
  },

  async getExpiringSubscriptions(days: number = 7) {
    const { data, error } = await supabase
      .rpc('admin_get_expiring_subscriptions', {
        p_admin_id: getAdminIdOrThrow(),
        p_days: days,
      });

    if (error) throw error;
    return data || [];
  },

  async getRecentActivity(limit: number = 20) {
    const { data, error } = await supabase
      .rpc('admin_get_recent_activity', {
        p_admin_id: getAdminIdOrThrow(),
        p_limit: limit,
      });

    if (error) throw error;
    return data || [];
  },

  async getStuckOnboarding() {
    const { data, error } = await supabase
      .rpc('admin_get_stuck_onboarding', {
        p_admin_id: getAdminIdOrThrow(),
      });

    if (error) throw error;
    return data || [];
  },
};
