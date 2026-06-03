import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getStockLedgerReport } from '../services/stockReportService';

export function useStockLedgerReport(startDate: string, endDate: string) {
  const user = useAuthStore((s) => s.user);
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['inventory', 'stock-ledger', startDate, endDate],
    queryFn: () => getStockLedgerReport(dealerId, startDate, endDate),
    enabled: !!dealerId && !!startDate && !!endDate,
  });
}
