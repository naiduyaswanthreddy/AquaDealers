import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

export function useSubscriptionLimits() {
  const user = useAuthStore(state => state.user);
  const planDefinitions = useSubscriptionStore(state => state.planDefinitions);

  return useQuery({
    queryKey: ['subscription-limits', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const [farmersCountResult, billsCountResult] = await Promise.all([
        supabase
          .from('farmers')
          .select('id', { count: 'exact', head: true })
          .eq('dealer_id', user.id),
        supabase
          .from('bills')
          .select('id', { count: 'exact', head: true })
          .eq('dealer_id', user.id)
      ]);

      const planDef = planDefinitions[user.plan];
      const maxFarmers = planDef?.farmer_limit || null; // null means unlimited
      const maxBills = planDef?.bill_limit || null;

      const currentFarmers = farmersCountResult.count || 0;
      const currentBills = billsCountResult.count || 0;

      return {
        currentFarmers,
        currentBills,
        maxFarmers,
        maxBills,
        canAddFarmer: maxFarmers === null || currentFarmers < maxFarmers,
        canAddBill: maxBills === null || currentBills < maxBills,
      };
    },
    enabled: !!user && Object.keys(planDefinitions).length > 0,
  });
}
