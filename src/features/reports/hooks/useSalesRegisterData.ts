import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';

export interface SalesRegisterItem {
  id: string;
  date: string;
  invoiceNo: string;
  customerName: string;
  taxableValue: number;
  gstAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMode: string;
  itemsString: string | null;
  totalQty: number;
}

export interface SalesRegisterSummary {
  totalBills: number;
  totalRevenue: number;
  totalGst: number;
  totalQty: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  totalOutstanding: number;
}

export interface SalesRegisterCharts {
  dailyRevenue: { date: string; revenue: number }[];
  paymentSplit: { mode: string; amount: number }[];
}

export interface SalesRegisterPagination {
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

export interface SalesRegisterData {
  items: SalesRegisterItem[];
  summary: SalesRegisterSummary;
  charts: SalesRegisterCharts;
  pagination: SalesRegisterPagination;
}

export const PAGE_SIZE = 20;

export type SalesSortBy = 'date' | 'amount' | 'customer';
export type SortDir = 'asc' | 'desc';
export type PaymentStatusFilter = 'all' | 'paid' | 'unpaid' | 'partial';
export type PaymentModeFilter = 'all' | 'cash' | 'upi' | 'credit';

export function useSalesRegisterData(
  startDate?: string,
  endDate?: string,
  page: number = 1,
  sortBy: SalesSortBy = 'date',
  sortDir: SortDir = 'desc',
  search: string = '',
  paymentStatus: PaymentStatusFilter = 'all',
  paymentMode: PaymentModeFilter = 'all'
) {
  const user = useAuthStore((state) => state.user);
  const activeBranchId = useBranchStore((state) => state.getActiveBranchId());
  const dealerId = user?.id || '';

  const defaultDate = new Intl.DateTimeFormat('en-CA').format(new Date());
  const queryStart = startDate || defaultDate;
  const queryEnd = endDate || defaultDate;

  return useQuery({
    queryKey: [
      'sales-register',
      dealerId,
      activeBranchId,
      queryStart,
      queryEnd,
      page,
      sortBy,
      sortDir,
      search,
      paymentStatus,
      paymentMode,
    ],
    queryFn: async (): Promise<SalesRegisterData> => {
      const { data, error } = await supabase.rpc('get_sales_register_data', {
        p_dealer_id: dealerId,
        p_branch_id: activeBranchId || null,
        p_start_date: queryStart,
        p_end_date: queryEnd,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_search: search,
        p_payment_status: paymentStatus,
        p_payment_mode: paymentMode,
      });

      if (error) throw error;
      const r = data as any;

      return {
        items: (r.items ?? []) as SalesRegisterItem[],
        summary: {
          totalBills: Number(r.summary?.totalBills ?? 0),
          totalRevenue: Number(r.summary?.totalRevenue ?? 0),
          totalGst: Number(r.summary?.totalGst ?? 0),
          totalQty: Number(r.summary?.totalQty ?? 0),
          paidCount: Number(r.summary?.paidCount ?? 0),
          unpaidCount: Number(r.summary?.unpaidCount ?? 0),
          partialCount: Number(r.summary?.partialCount ?? 0),
          totalOutstanding: Number(r.summary?.totalOutstanding ?? 0),
        },
        charts: {
          dailyRevenue: (r.charts?.dailyRevenue ?? []),
          paymentSplit: (r.charts?.paymentSplit ?? []),
        },
        pagination: {
          totalItems: Number(r.pagination?.totalItems ?? 0),
          totalPages: Number(r.pagination?.totalPages ?? 1),
          currentPage: Number(r.pagination?.currentPage ?? page),
        },
      };
    },
    enabled: !!dealerId,
    placeholderData: (prev) => prev,
  });
}
