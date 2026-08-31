import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export interface SettlementSummary {
  total: number;
  byFarmer: Array<{ farmerId: string; farmerName: string; amount: number }>;
}

/** All-time settlement discount total, broken down per farmer. */
export function useSettlementSummary() {
  const dealerId = useAuthStore((state) => state.user?.id || '');

  return useQuery<SettlementSummary>({
    queryKey: ['settlement-summary', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('farmer_id, settlement_discount_amount, farmers(name)')
        .eq('dealer_id', dealerId)
        .neq('status', 'cancelled')
        .eq('is_estimate', false)
        .gt('settlement_discount_amount', 0);
      if (error) throw error;

      const byFarmerMap = new Map<string, { farmerName: string; amount: number }>();
      for (const row of data || []) {
        const amount = Number(row.settlement_discount_amount || 0);
        const farmerId = row.farmer_id as string | null;
        if (!farmerId || amount <= 0) continue;
        const farmerName = (row as any).farmers?.name || 'Unknown farmer';
        const existing = byFarmerMap.get(farmerId);
        byFarmerMap.set(farmerId, { farmerName, amount: (existing?.amount || 0) + amount });
      }

      const byFarmer = Array.from(byFarmerMap.entries())
        .map(([farmerId, v]) => ({ farmerId, ...v }))
        .sort((a, b) => b.amount - a.amount);

      return { total: byFarmer.reduce((sum, f) => sum + f.amount, 0), byFarmer };
    },
    enabled: !!dealerId,
    staleTime: 5 * 60 * 1000,
  });
}
