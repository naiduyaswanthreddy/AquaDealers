import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getAdminIdOrThrow } from '../services/adminSession';

export const adminAnalyticsKeys = {
  all: ['admin-analytics'] as const,
};

export function useAdminAnalytics() {
  return useQuery({
    queryKey: adminAnalyticsKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_analytics', {
        p_admin_id: getAdminIdOrThrow(),
      });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
