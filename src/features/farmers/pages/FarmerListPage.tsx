import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Users, IndianRupee, TrendingUp, TrendingDown, Banknote } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Button, EmptyState, SearchBar, Skeleton } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import FarmerCard from '../components/FarmerCard';
import { getFarmers } from '../services/farmerService';
import { formatCurrency } from '@/lib/utils';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import type { Farmer } from '@/types/database';
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardData';

export const FarmerListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'farmers' | 'walkIn'>('farmers');
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useBranchStore((s) => s.getActiveBranchId());
  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canAddFarmer = getStaffFeatureMode('addFarmer', currentStaff?.permissions, !!currentStaff) === 'visible';

  // Single paginated fetch — total comes from server COUNT, no second query needed.
  // Previously there was a dual-fetch (useFarmers limit:1000 for stats + paginated),
  // which caused 2 DB queries on every page visit. Now we use one query only.
  const hasFilters = useMemo(() => !!search, [search]);

  // Farmers are shared across all branches — don't filter by activeBranchId.
  const fetchFarmersPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No dealer ID');
    return getFarmers({
      dealerId: user.id,
      page,
      limit,
      search: search || undefined,
      isWalkIn: activeTab === 'walkIn',
      sortBy: 'total_due',
    });
  }, [user?.id, search, activeTab]);
  void activeBranchId;

  const pagedFarmers = useLoadMoreList<Farmer>({
    initialLimit: 10,
    step: 10,
    fetchFn: fetchFarmersPage,
    dependencies: [fetchFarmersPage],
  });

  // Total farmer count comes from the server-side COUNT on the paged query
  const totalFarmers = pagedFarmers.totalCount ?? 0;
  const isLoading = pagedFarmers.isLoading;

  // totalDues from dashboard stats cache (staleTime: 5min)
  const { data: dashStats } = useDashboardStats();
  const totalDues = dashStats?.totalDues ?? 0;

  // Extra KPI stats: advance given + this/prev month sales
  const { data: farmerStats } = useQuery({
    queryKey: ['farmerPageStats', user?.id],
    queryFn: async () => {
      const today = new Date();
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const firstOfLast = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lastOfLast = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);
      const [farmersRes, thisRes, prevRes] = await Promise.all([
        supabase.from('farmers').select('opening_balance').eq('dealer_id', user!.id).gt('opening_balance', 0),
        supabase.from('bills').select('total').eq('dealer_id', user!.id).neq('status', 'cancelled').eq('is_estimate', false).gte('bill_date', firstOfMonth),
        supabase.from('bills').select('total').eq('dealer_id', user!.id).neq('status', 'cancelled').eq('is_estimate', false).gte('bill_date', firstOfLast).lte('bill_date', lastOfLast),
      ]);
      const advanceGiven = (farmersRes.data ?? []).reduce((s, f) => s + Number(f.opening_balance), 0);
      const thisMonthSales = (thisRes.data ?? []).reduce((s, b) => s + Number(b.total), 0);
      const prevMonthSales = (prevRes.data ?? []).reduce((s, b) => s + Number(b.total), 0);
      return { advanceGiven, thisMonthSales, prevMonthSales };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const salesPct = farmerStats?.prevMonthSales
    ? Math.round(((( farmerStats.thisMonthSales ?? 0) - farmerStats.prevMonthSales) / farmerStats.prevMonthSales) * 100)
    : null;

  return (
    <PageShell width="full">
      <PageHeader
        title={t('nav.farmers', 'Farmers')}
        action={
          canAddFarmer && (
            <Button onClick={() => navigate('/farmers/new')} leftIcon={<Plus className="h-4.5 w-4.5" />}>
              {t('common.add', 'Add')}
            </Button>
          )
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full mb-6">
        {/* Total Farmers */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">{t('farmers.totalFarmers', 'Total Farmers')}</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-2xl font-black text-slate-900 leading-tight">{totalFarmers}</span>
        </div>

        {/* Total Dues */}
        <div
          onClick={() => navigate('/farmers/dues')}
          className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-2 cursor-pointer hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">{t('farmers.totalDues', 'Total Dues')}</span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <IndianRupee className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-lg font-black text-slate-900 leading-tight break-all">{formatCurrency(totalDues)}</span>
        </div>

        {/* Advance Given */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">Advance Given</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Banknote className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-lg font-black text-slate-900 leading-tight break-all">
            {farmerStats ? formatCurrency(farmerStats.advanceGiven) : '—'}
          </span>
        </div>

        {/* This Month Sales */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">This Month Sales</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <span className="text-lg font-black text-slate-900 leading-tight break-all">
            {farmerStats ? formatCurrency(farmerStats.thisMonthSales) : '—'}
          </span>
          {salesPct !== null && (
            <span className={`flex items-center gap-1 text-[0.68rem] font-bold ${salesPct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {salesPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(salesPct)}% vs last month
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 px-1">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t('farmers.searchPlaceholder', 'Search by name, village or phone')}
          showVoicePlaceholder={true}
        />
      </div>

      <div className="mb-2 mx-1 flex rounded-[14px] bg-slate-100/80 p-1 border border-slate-200/50 shadow-inner">
        <button
          onClick={() => setActiveTab('farmers')}
          className={`flex-1 rounded-[10px] py-2 text-[0.85rem] font-bold transition-all duration-200 ${
            activeTab === 'farmers'
              ? 'shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
          style={activeTab === 'farmers' ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' } : {}}
        >
          Regular Farmers
        </button>
        <button
          onClick={() => setActiveTab('walkIn')}
          className={`flex-1 rounded-[10px] py-2 text-[0.85rem] font-bold transition-all duration-200 ${
            activeTab === 'walkIn'
              ? 'shadow-md'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
          style={activeTab === 'walkIn' ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' } : {}}
        >
          Walk-in Customers
        </button>
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
              !hasFilters && canAddFarmer ? (
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
