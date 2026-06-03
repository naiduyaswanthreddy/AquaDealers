import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, SearchBar, Skeleton } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { PageShell } from '@/components/layout/PageShell';
import FarmerCard from '../components/FarmerCard';
import { useFarmers } from '../hooks/useFarmers';
import { getFarmers } from '../services/farmerService';
import { formatCurrency } from '@/lib/utils';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import type { Farmer } from '@/types/database';

export const FarmerListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());

  // We still fetch a limited set for the global stats if needed, or we can use an aggregate endpoint.
  // For now, we rely on useFarmers fetching top 1000 for total stats, while paged uses infinite scroll.
  const { data: allFarmersForStats = [], isLoading: statsLoading } = useFarmers({
    search: search || undefined,
  });

  const hasFilters = useMemo(() => !!search, [search]);

  // Dynamic statistics calculations
  const totalFarmers = allFarmersForStats.length;
  const totalDues = useMemo(() => {
    return allFarmersForStats.reduce((sum, f) => sum + Number(f.total_due || 0), 0);
  }, [allFarmersForStats]);

  const fetchFarmersPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No dealer ID');
    return getFarmers({
      dealerId: user.id,
      branchId: activeBranchId,
      page,
      limit,
      search: search || undefined,
      sortBy: 'total_due',
    });
  }, [user?.id, activeBranchId, search]);

  const pagedFarmers = useLoadMoreList<Farmer>({
    initialLimit: 10,
    step: 10,
    fetchFn: fetchFarmersPage,
    dependencies: [fetchFarmersPage],
  });

  const isLoading = statsLoading || pagedFarmers.isLoading;

  const formatCompactDues = (value: number) => {
    if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}k`;
    }
    return formatCurrency(value);
  };

  return (
    <PageShell width="full">
      {/* Redesigned Hero Background */}
      <section className="dashboard-hero flex flex-col gap-4 pb-14">
        <div className="flex w-full items-start justify-between">
          <div className="dashboard-hero__content">
            <h1 className="dashboard-hero__title mt-1">{t('nav.farmers', 'Farmers')}</h1>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate('/farmers/new')}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[24px] border border-solid border-white/22 px-5 text-[0.82rem] font-semibold text-white backdrop-blur-md transition-all duration-200 hover:bg-white/25 active:scale-[0.98]"
              style={{ background: 'rgba(255, 255, 255, 0.18)', border: '1px solid rgba(255, 255, 255, 0.22)' }}
            >
              <Plus className="h-4 w-4 stroke-[2.8] text-white" />
              <span className="pr-1">{t('common.add', 'Add')}</span>
            </button>
          </div>
        </div>

        {/* Side-by-side translucent summary cards */}
        <div className="flex gap-4 w-full mt-2">
          <div className="bg-white/10 border border-white/14 rounded-2xl p-4 flex-1 backdrop-blur-md shadow-inner flex flex-col">
            <span className="text-[10px] font-extrabold tracking-wider text-white/70 uppercase">
              {t('farmers.totalFarmers', 'TOTAL FARMERS')}
            </span>
            <span className="text-2xl font-black text-white mt-1">
              {totalFarmers}
            </span>
          </div>
          <div className="bg-white/10 border border-white/14 rounded-2xl p-4 flex-1 backdrop-blur-md shadow-inner flex flex-col">
            <span className="text-[10px] font-extrabold tracking-wider text-white/70 uppercase">
              {t('farmers.totalDues', 'TOTAL DUES')}
            </span>
            <span className="text-2xl font-black text-white mt-1">
              {formatCompactDues(totalDues)}
            </span>
          </div>
        </div>
      </section>

      {/* Floating search pill */}
      <div className="relative z-10 -mt-13 mb-1.5 px-1">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('farmers.searchPlaceholder', 'Search by name, village or phone')}
          showVoicePlaceholder={true}
        />
      </div>

      {isLoading ? (
        <div className="rounded-[26px] border border-slate-200/70 bg-white p-3 shadow-[0_12px_32px_rgba(148,163,184,0.12)]">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 text-sky-800">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            <div>
              <div className="text-sm font-black">Loading farmers</div>
              <div className="text-xs font-semibold text-sky-700/75">Fetching names, villages, phone numbers, and dues.</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex min-w-0 w-full items-center gap-3 pr-4">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-40 rounded-md" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-3 w-14 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !pagedFarmers.visibleItems.length ? (
        <div className="rounded-[28px] border border-white/80 bg-white p-8 shadow-[0_20px_50px_rgba(148,163,184,0.14)]">
          <EmptyState
            icon={Users}
            title={hasFilters ? t('common.noMatches', 'No matches found') : t('farmers.noFarmersYet', 'No farmers yet')}
            description={
              hasFilters
                ? t('farmers.tryChangingSearch', 'Try changing your search or filters.')
                : t('farmers.addFirstFarmer', 'Add your first farmer to start billing and tracking dues.')
            }
            action={
              !hasFilters ? (
                <Button onClick={() => navigate('/farmers/new')} leftIcon={<Plus className="h-4.5 w-4.5" />}>
                  {t('common.add', 'Add')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
            {pagedFarmers.visibleItems.map((farmer, index) => (
              <React.Fragment key={farmer.id}>
                <FarmerCard farmer={farmer} variant="list" />
                {index < pagedFarmers.visibleItems.length - 1 && (
                  <div className="h-px w-full bg-slate-200/80" aria-hidden="true" />
                )}
              </React.Fragment>
            ))}
          </div>
          <ListLoadMore
            shown={pagedFarmers.visibleCount}
            total={pagedFarmers.totalCount}
            onLoadMore={pagedFarmers.loadMore}
            label={t('common.loadMore', 'Load more')}
          />
        </>
      )}
    </PageShell>
  );
};

export default FarmerListPage;
