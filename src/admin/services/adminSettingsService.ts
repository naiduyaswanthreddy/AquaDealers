import { supabase } from '@/lib/supabase';
import { getAdminIdOrThrow } from './adminSession';

export const adminSettingsService = {
  async getPlanDefinitions() {
    const { data, error } = await supabase
      .from('plan_definitions')
      .select('*')
      .order('price_monthly', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async updatePlanDefinition(id: string, updates: any) {
    const { error } = await supabase.rpc('admin_update_plan_definition', {
      p_admin_id: getAdminIdOrThrow(),
      p_plan_id: id,
      p_updates: updates,
    });

    if (error) throw error;
  },

  async getAuditLogs(limit = 100) {
    const { data, error } = await supabase
      .rpc('admin_get_audit_logs', {
        p_admin_id: getAdminIdOrThrow(),
        p_limit: limit,
      });

    if (error) throw error;
    return data || [];
  }
};
