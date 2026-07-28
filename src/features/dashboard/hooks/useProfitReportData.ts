import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';

export interface ProfitReportItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  revenue: number;
  cost: number;
  profit: number;
  bill_number?: string;
  bill_id?: string;
}

export interface Top5Product {
  product_name: string;
  profit: number;
  revenue: number;
  quantity: number;
}

export interface ProfitReportData {
  items: ProfitReportItem[];
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  expenses: number;
  returns: number;
  netProfit: number;
  dailyProfits: { date: string; profit: number }[];
  top5Products: Top5Product[];
  totalItems: number;
  totalPages: number;
  missingCostCount: number;
}

export const PAGE_SIZE = 15;

export type SortBy = 'profit' | 'revenue' | 'quantity' | 'margin';
export type SortDir = 'asc' | 'desc';

export function useProfitReportData(
  startDate?: string,
  endDate?: string,
  page: number = 1,
  sortBy: SortBy = 'profit',
  sortDir: SortDir = 'desc',
  search: string = ''
) {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  const defaultDate = new Intl.DateTimeFormat('en-CA').format(new Date());
  const queryStart = startDate || defaultDate;
  const queryEnd = endDate || defaultDate;

  return useQuery({
    queryKey: ['profit-report', dealerId, activeBranchId, queryStart, queryEnd, page, sortBy, sortDir, search],
    queryFn: async (): Promise<ProfitReportData> => {
      const { data, error } = await supabase.rpc('get_profit_report_data', {
        p_dealer_id:  dealerId,
        p_branch_id:  activeBranchId || null,
        p_start_date: queryStart,
        p_end_date:   queryEnd,
        p_page:       page,
        p_page_size:  PAGE_SIZE,
        p_sort_by:    sortBy,
        p_sort_dir:   sortDir,
        p_search:     search,
      });
      if (error) throw error;
      const r = data as any;
      return {
        items:            (r.items ?? []) as ProfitReportItem[],
        totalRevenue:     Number(r.totalRevenue ?? 0),
        totalCost:        Number(r.totalCost ?? 0),
        grossProfit:      Number(r.grossProfit ?? 0),
        expenses:         Number(r.expenses ?? 0),
        returns:          Number(r.returns ?? 0),
        netProfit:        Number(r.netProfit ?? 0),
        dailyProfits:     (r.dailyProfits ?? []) as { date: string; profit: number }[],
        top5Products:     (r.top5Products ?? []) as Top5Product[],
        totalItems:       Number(r.totalItems ?? 0),
        totalPages:       Number(r.totalPages ?? 1),
        missingCostCount: Number(r.missingCostCount ?? 0),
      };
    },
    enabled: !!dealerId,
    placeholderData: (prev) => prev,
  });
}

/** Lightweight hook: fetches only netProfit for a date range (for period comparison). */
export function usePeriodNetProfit(startDate: string, endDate: string) {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  return useQuery({
    queryKey: ['profit-summary', dealerId, activeBranchId, startDate, endDate],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_profit_report_data', {
        p_dealer_id:  dealerId,
        p_branch_id:  activeBranchId || null,
        p_start_date: startDate,
        p_end_date:   endDate,
        p_page:       1,
        p_page_size:  1,
        p_sort_by:    'profit',
        p_sort_dir:   'desc',
        p_search:     '',
      });
      if (error) throw error;
      return Number((data as any)?.netProfit ?? 0);
    },
    enabled: !!dealerId && !!startDate && !!endDate,
  });
}
