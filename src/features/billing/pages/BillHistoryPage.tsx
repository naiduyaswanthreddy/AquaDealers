import React, { useMemo, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { Button, EmptyState, SearchBar, DateRangeFilter } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useBills } from '../hooks/useBilling';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { billingService } from '../services/billingService';
import { Bill } from '@/types/database';

const BillHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: bills = [], isLoading, error } = useBills();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showItems, setShowItems] = useState(false);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate') || todayStr;
  const endDate = searchParams.get('endDate') || todayStr;

  const updateParams = (newParams: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      return next;
    });
  };

  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  const fetchBillsPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No user id');
    return billingService.getBills(user.id, branchId, {
      page,
      limit,
      searchQuery: search,
      startDate,
      endDate,
    });
  }, [user?.id, branchId, search, startDate, endDate]);

  const pagedBills = useLoadMoreList<Bill>({
    initialLimit: 12,
    step: 12,
    fetchFn: fetchBillsPage,
    dependencies: [fetchBillsPage],
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="section-card text-danger">{t('common.error', 'Something went wrong.')}</div>;
  }

  return (
    <PageShell width="wide">
      <PageHeader
        title={t('nav.billHistory', 'Bill History')}
        onBack={() => navigate('/more')}
        action={(
          <Button onClick={() => navigate('/bills/new')} leftIcon={<Plus className="h-4.5 w-4.5" />}>
            {t('nav.newBill', 'New Bill')}
          </Button>
        )}
      />

      <SectionCard>
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SearchBar
            value={search}
            onChange={(v) => updateParams({ search: v })}
            placeholder={t('billing.searchBills', 'Search by bill number or customer name')}
            className="max-w-xl flex-1"
            showVoicePlaceholder
          />

          <div className="w-full sm:max-w-sm">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => updateParams({ startDate: start, endDate: end })}
            />
          </div>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <div className="px-1 sm:px-2 flex items-center justify-between">
          <div className="text-sm font-black tracking-tight text-slate-900">
            {pagedBills.totalCount} {t('billing.billCount', 'bill')}{pagedBills.totalCount === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Show Items</span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" checked={showItems} onChange={(e) => setShowItems(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {!pagedBills.totalCount ? (
          <EmptyState
            icon={Receipt}
            title={t('common.noResults', 'No results found')}
            description={t('billing.noBillsFound', 'No bills match your search criteria.')}
          />
        ) : (
          <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
            {pagedBills.visibleItems.map((bill, index) => {
              const billDate = new Date(bill.bill_date);
              const day = billDate.getDate();
              const month = billDate.toLocaleDateString('en-US', { month: 'short' });
              const isLast = index === pagedBills.visibleItems.length - 1;

              return (
                <React.Fragment key={bill.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/bills/${bill.id}`)}
                    className="group flex min-h-[80px] w-full items-center justify-between px-4 py-4 text-left transition-all active:scale-[0.99] hover:bg-slate-50/70 focus-ring"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                        <span className="text-[0.95rem] font-black leading-none text-slate-800">{day}</span>
                        <span className="mt-0.5 text-[0.56rem] font-black uppercase tracking-[0.16em] text-slate-400">{month}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[1rem] font-bold tracking-tight text-slate-900 flex items-center gap-2">
                          {bill.farmer_name_snapshot || t('billing.walkInCustomer', 'Walk-in Customer')}
                          {bill.type === 'adjustment' && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              Rate Adjustment
                            </span>
                          )}
                        </div>
                        <div className={`mt-0.5 text-[0.82rem] font-medium text-slate-500 ${showItems ? 'whitespace-normal' : 'truncate'}`}>
                          {showItems && (bill as any).bill_items?.length ? (
                            <span className="text-slate-600 block leading-relaxed mt-1">
                              {(bill as any).bill_items.map((item: any) => `${item.product_name_snapshot} (${item.quantity})`).join(', ')}
                            </span>
                          ) : (
                            <>{bill.bill_number} • {formatDateTime(bill.created_at)}</>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <div className="text-[1rem] font-bold tabular-nums text-emerald-600">
                          {formatCurrency(bill.total)}
                        </div>
                        <div className={`mt-0 text-[0.72rem] font-semibold whitespace-nowrap text-right ${bill.balance_due > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {bill.balance_due > 0
                            ? `${t('billing.balance', 'Balance')} ${formatCurrency(bill.balance_due)}`
                            : t('billing.paidInFull', 'Paid in full')}
                        </div>
                      </div>
                      <svg className="h-4.5 w-4.5 text-slate-200 transition-colors group-hover:text-slate-300" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>
                  {!isLast && <div className="h-px w-full bg-slate-200/80" aria-hidden="true" />}
                </React.Fragment>
              );
            })}
          </div>
          <ListLoadMore
            shown={pagedBills.visibleCount}
            total={pagedBills.totalCount}
            onLoadMore={pagedBills.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
          </>
        )}
      </div>
    </PageShell>
  );
};

export default BillHistoryPage;
