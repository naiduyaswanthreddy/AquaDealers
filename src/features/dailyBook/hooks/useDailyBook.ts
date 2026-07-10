import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { getLocalDateString } from '@/lib/utils';
import { dailyBookService } from '../services/dailyBookService';

const shiftDate = (date: string, days: number): string => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function useDealerContext() {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  return { dealerId: user?.id || '', branchId: activeBranchId };
}

export function useDailyBook(date: string) {
  const { dealerId, branchId } = useDealerContext();
  const queryClient = useQueryClient();
  const isToday = date === getLocalDateString();

  const query = useQuery({
    queryKey: ['daily-book', dealerId, branchId, date],
    queryFn: () => dailyBookService.getDailyBook(dealerId, branchId, date),
    enabled: !!dealerId && !!date,
    staleTime: isToday ? 30_000 : 10 * 60_000,
  });

  // Prefetch adjacent days so turning the page back/forward feels instant.
  useEffect(() => {
    if (!dealerId || !date || query.isLoading) return;
    for (const adjacent of [shiftDate(date, -1), shiftDate(date, 1)]) {
      if (adjacent > getLocalDateString()) continue;
      queryClient.prefetchQuery({
        queryKey: ['daily-book', dealerId, branchId, adjacent],
        queryFn: () => dailyBookService.getDailyBook(dealerId, branchId, adjacent),
        staleTime: 10 * 60_000,
      });
    }
  }, [dealerId, branchId, date, query.isLoading, queryClient]);

  return query;
}

export function useFarmerDayView(farmerId: string | undefined, date: string) {
  const { dealerId } = useDealerContext();
  return useQuery({
    queryKey: ['daily-book-farmer', dealerId, farmerId, date],
    queryFn: () => dailyBookService.getFarmerDayView(dealerId, farmerId!, date),
    enabled: !!dealerId && !!farmerId && !!date,
    staleTime: 30_000,
  });
}

export function useStockPosition(date: string) {
  const { dealerId, branchId } = useDealerContext();
  const isToday = date === getLocalDateString();
  return useQuery({
    queryKey: ['daily-book-stock-position', dealerId, branchId, date],
    queryFn: () => dailyBookService.getStockPosition(dealerId, branchId, date),
    enabled: !!dealerId && !!date,
    staleTime: isToday ? 30_000 : 10 * 60_000,
  });
}

export function useBookBill(billId: string | undefined) {
  const { dealerId } = useDealerContext();
  return useQuery({
    queryKey: ['daily-book-bill', dealerId, billId],
    queryFn: () => dailyBookService.getBill(dealerId, billId!),
    enabled: !!dealerId && !!billId,
    staleTime: 30_000,
  });
}

export { shiftDate };
