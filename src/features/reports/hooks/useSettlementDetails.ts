import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export interface SettlementRow {
  billId: string;
  billNumber: string;
  billDate: string;
  amount: number;
  reason: string | null;
  farmerId: string;
  farmerName: string;
}

export function useSettlementDetails() {
  const dealerId = useAuthStore((state) => state.user?.id || '');

  return useQuery<SettlementRow[]>({
    queryKey: ['settlement-details', dealerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bills')
        .select('id, bill_number, bill_date, settlement_discount_amount, settlement_discount_reason, farmer_id, farmers(name)')
        .eq('dealer_id', dealerId)
        .neq('status', 'cancelled')
        .is('deleted_at', null)
        .gt('settlement_discount_amount', 0)
        .order('bill_date', { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        billId: row.id,
        billNumber: row.bill_number,
        billDate: row.bill_date,
        amount: Number(row.settlement_discount_amount),
        reason: row.settlement_discount_reason || null,
        farmerId: row.farmer_id,
        farmerName: row.farmers?.name || 'Unknown',
      }));
    },
    enabled: !!dealerId,
    staleTime: 5 * 60 * 1000,
  });
}
