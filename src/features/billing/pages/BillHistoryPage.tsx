import React, { useMemo, useState, useEffect } from 'react';
import {
  Plus, Receipt, Download, ShieldCheck, ShieldX, CheckCircle2, Clock,
  ArrowRight, X, IndianRupee, TrendingUp, TrendingDown, MoreVertical, Eye, Edit2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { Button, EmptyState, SearchBar, DateRangeFilter } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { billingService } from '../services/billingService';
import { exportAllBills, billsToCsv, downloadCsv } from '../services/billExportService';
import { Bill } from '@/types/database';
import OfflinePendingBanner from '../components/OfflinePendingBanner';
import { toast } from 'sonner';

const BillHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showItems, setShowItems] = useState(() => {
    return localStorage.getItem('aqua_bill_history_show_items') === 'true';
  });

  const handleShowItemsToggle = (checked: boolean) => {
    setShowItems(checked);
    localStorage.setItem('aqua_bill_history_show_items', String(checked));
  };
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const currentStaff = useStaffStore((s) => s.currentStaff);
  const canNewBill = getStaffFeatureMode('newBill', currentStaff?.permissions, !!currentStaff) === 'visible';
  const isInitialMount = React.useRef(true);

  const activeParams = useMemo(() => {
    if (isInitialMount.current && searchParams.toString() === '') {
      const saved = sessionStorage.getItem('billHistoryFilters');
      if (saved) {
        const restored = new URLSearchParams(saved);
        // Always start at today regardless of what was saved
        restored.set('startDate', todayStr);
        restored.set('endDate', todayStr);
        return restored;
      }
    }
    return searchParams;
  }, [searchParams, todayStr]);

  const search = activeParams.get('search') || '';
  const startDate = activeParams.get('startDate') || todayStr;
  const endDate = activeParams.get('endDate') || todayStr;
  const paymentStatus = (activeParams.get('paymentStatus') as 'all' | 'paid' | 'unpaid') || 'all';
  const verifiedStatus = (activeParams.get('verifiedStatus') as 'all' | 'verified' | 'unverified') || 'all';

  useEffect(() => {
    if (isInitialMount.current) {
      if (searchParams.toString() === '') {
        const saved = sessionStorage.getItem('billHistoryFilters');
        if (saved) {
          const restored = new URLSearchParams(saved);
          restored.set('startDate', todayStr);
          restored.set('endDate', todayStr);
          setSearchParams(restored, { replace: true });
        }
      }
      isInitialMount.current = false;
    } else {
      sessionStorage.setItem('billHistoryFilters', searchParams.toString());
    }
  }, [searchParams, setSearchParams, todayStr]);

  const updateParams = (newParams: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(newParams).forEach(([k, v]) => {
        if (v && v !== 'all') next.set(k, v);
        else next.delete(k);
      });
      return next;
    });
  };

  // Close action menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-action-menu]')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenuId]);

  const { user } = useAuthStore();
  const { activeBranch, isAllBranches } = useBranchStore();
  const branchId = isAllBranches ? null : activeBranch?.id;

  // KPI stats — current + previous period for % change
  const { data: billStats } = useQuery({
    queryKey: ['billStats', user?.id, branchId, startDate, endDate],
    queryFn: () => billingService.getBillStats(user!.id, branchId ?? null, startDate, endDate),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const { prevStart, prevEnd } = useMemo(() => {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const rangeDays = Math.ceil((endMs - startMs) / 86400000) + 1;
    return {
      prevStart: new Date(startMs - rangeDays * 86400000).toISOString().slice(0, 10),
      prevEnd: new Date(startMs - 86400000).toISOString().slice(0, 10),
    };
  }, [startDate, endDate]);

  const { data: prevStats } = useQuery({
    queryKey: ['billStats', user?.id, branchId, prevStart, prevEnd],
    queryFn: () => billingService.getBillStats(user!.id, branchId ?? null, prevStart, prevEnd),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const pct = (curr?: number, prev?: number) => {
    if (!prev || prev === 0) return null;
    return Math.round(((( curr ?? 0) - prev) / prev) * 100);
  };

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (!user?.id || isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading('Preparing export… 0%');
    try {
      const rows = await exportAllBills(
        { dealerId: user.id, branchId, startDate, endDate, paymentStatus, search },
        (p) => toast.loading(`Preparing export… ${p}%`, { id: toastId })
      );
      const csv = billsToCsv(rows);
      downloadCsv(csv, `bills_${startDate}_to_${endDate}.csv`);
      toast.success(`Exported ${rows.length} bills`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const fetchBillsPage = React.useCallback(async ({ page, limit }: { page: number; limit: number }) => {
    if (!user?.id) throw new Error('No user id');
    return billingService.getBills(user.id, branchId, {
      page, limit, searchQuery: search, startDate, endDate, paymentStatus, verifiedStatus,
    });
  }, [user?.id, branchId, search, startDate, endDate, paymentStatus, verifiedStatus]);

  const pagedBills = useLoadMoreList<Bill>({
    initialLimit: pageSize,
    step: pageSize,
    fetchFn: fetchBillsPage,
    dependencies: [fetchBillsPage, pageSize],
  });

  if (pagedBills.isLoading && pagedBills.visibleItems.length === 0) {
    return (
      <div className="flex min-h-[18rem] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (pagedBills.error) {
    return <div className="section-card text-danger">{t('common.error', 'Something went wrong.')}</div>;
  }

  const kpiCards = [
    {
      label: 'Total Bills',
      value: billStats?.count ?? pagedBills.totalCount,
      display: String(billStats?.count ?? pagedBills.totalCount),
      icon: <Receipt className="h-5 w-5" />,
      color: '#2563eb', bg: '#eff6ff',
      pct: pct(billStats?.count, prevStats?.count),
    },
    {
      label: 'Total Amount',
      value: billStats?.total,
      display: formatCurrency(billStats?.total ?? 0),
      icon: <IndianRupee className="h-5 w-5" />,
      color: '#7c3aed', bg: '#f5f3ff',
      pct: pct(billStats?.total, prevStats?.total),
    },
    {
      label: 'Paid Amount',
      value: billStats?.paid,
      display: formatCurrency(billStats?.paid ?? 0),
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: '#059669', bg: '#ecfdf5',
      pct: pct(billStats?.paid, prevStats?.paid),
    },
    {
      label: 'Pending Amount',
      value: billStats?.pending,
      display: formatCurrency(billStats?.pending ?? 0),
      icon: <Clock className="h-5 w-5" />,
      color: '#d97706', bg: '#fffbeb',
      pct: pct(billStats?.pending, prevStats?.pending),
    },
  ];

  return (
    <PageShell width="wide">
      <PageHeader
        title="Bills"
        onBack={() => navigate('/more')}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting || !pagedBills.totalCount}
              leftIcon={<Download className="h-4 w-4" />}
            >
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            {canNewBill && (
              <Button onClick={() => navigate('/bills/new')} leftIcon={<Plus className="h-4.5 w-4.5" />}>
                {t('nav.newBill', 'New Bill')}
              </Button>
            )}
          </div>
        }
      />

      <OfflinePendingBanner />

      {/* KPI cards — desktop only */}
      <div className="hidden lg:grid grid-cols-4 gap-4 mb-2">
        {kpiCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
              <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg, color: card.color }}>
                {card.icon}
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 leading-none">{card.display}</div>
            {card.pct !== null && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${card.pct >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {card.pct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(card.pct)}% vs prev period
              </div>
            )}
          </div>
        ))}
      </div>

      <SectionCard>
        <div className="flex flex-col gap-5">
          <SearchBar
            value={search}
            onChange={(v) => updateParams({ search: v })}
            placeholder={t('billing.searchBills', 'Search by bill number or customer name')}
            className="w-full max-w-3xl"
            showVoicePlaceholder
          />

          <div className="flex w-full flex-wrap items-end justify-between gap-4 lg:gap-6">
            {/* Verified Status */}
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Status</span>
              <div className="inline-flex rounded-xl bg-white border border-slate-200/60 p-1 shadow-sm w-fit">
                {(['all', 'verified', 'unverified'] as const).map((v, i) => (
                  <React.Fragment key={v}>
                    {i > 0 && <div className="w-[1px] bg-slate-200 my-1.5 mx-1" />}
                    <button
                      type="button"
                      onClick={() => updateParams({ verifiedStatus: v })}
                      className={`relative flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-[0.8rem] font-semibold transition-all ${
                        verifiedStatus === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {v === 'verified' && <ShieldCheck className="h-4 w-4" />}
                      {v === 'unverified' && <ShieldX className="h-4 w-4" />}
                      {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Payment Status */}
            <div className="flex flex-col gap-2">
              <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Payment Status</span>
              <div className="inline-flex rounded-xl bg-white border border-slate-200/60 p-1 shadow-sm w-fit">
                {([['all', 'All'], ['paid', 'Paid'], ['unpaid', 'Pending']] as const).map(([v, label], i) => (
                  <React.Fragment key={v}>
                    {i > 0 && <div className="w-[1px] bg-slate-200 my-1.5 mx-1" />}
                    <button
                      type="button"
                      onClick={() => updateParams({ paymentStatus: v })}
                      className={`relative flex items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-[0.8rem] font-semibold transition-all ${
                        paymentStatus === v ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {v === 'paid' && <CheckCircle2 className={`h-4 w-4 ${paymentStatus === 'paid' ? 'text-blue-600' : 'text-emerald-500'}`} />}
                      {v === 'unpaid' && <Clock className={`h-4 w-4 ${paymentStatus === 'unpaid' ? 'text-blue-600' : 'text-amber-500'}`} />}
                      {label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="w-full sm:w-auto shrink-0 flex items-end">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => updateParams({ startDate: start, endDate: end })}
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Controls row */}
      <div className="px-1 sm:px-2 flex items-center justify-between gap-3">
        <div className="text-sm font-black tracking-tight text-slate-900">
          {pagedBills.totalCount} {t('billing.billCount', 'bill')}{pagedBills.totalCount === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-3">
          {/* Show N selector */}
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-sm font-medium text-slate-600">Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as 10 | 25 | 50)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          {/* Show Items toggle */}
          <label className="flex items-center gap-2 cursor-pointer ml-auto mr-1 sm:mr-3">
            <span className="text-sm font-medium text-slate-700">Show Items</span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" checked={showItems} onChange={(e) => handleShowItemsToggle(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
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
          {/* Desktop table */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[0.68rem] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">Bill Date</th>
                  <th className="px-4 py-3 text-left">Bill No.</th>
                  <th className="px-4 py-3 text-left">Farmer / Customer</th>
                  {showItems ? (
                    <th className="px-4 py-3 text-left">Items</th>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-center">Type</th>
                      <th className="px-4 py-3 text-left">Payment Status</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedBills.visibleItems.map((bill) => (
                  <tr
                    key={bill.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/bills/${bill.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                      {formatDate(bill.bill_date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.78rem] text-slate-500">{bill.bill_number}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <span className="font-semibold text-slate-900 truncate block">
                        {bill.farmer_name_snapshot || t('billing.walkInCustomer', 'Walk-in Customer')}
                      </span>
                      {(bill as any).branch_name_snapshot && (
                        <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200 mt-0.5">
                          {(bill as any).branch_name_snapshot}
                        </span>
                      )}
                    </td>
                    {showItems ? (
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {(bill as any).bill_items?.length ? (
                          (bill as any).bill_items.map((item: any) => `${item.product_name_snapshot} (${item.quantity})`).join(', ')
                        ) : '—'}
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase ${
                            bill.balance_due > 0
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          }`}>
                            {bill.payment_type || (bill.balance_due > 0 ? 'Credit' : 'Cash')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {bill.balance_due > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span className="text-xs font-semibold text-amber-700">
                                Pending {formatCurrency(bill.balance_due)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="text-xs font-semibold text-emerald-700">Paid in full</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {bill.is_verified !== false ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-600/30">
                              Unverified
                            </span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(bill.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
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
                    className="group flex min-h-[80px] w-full items-start justify-between px-4 py-4 text-left transition-all duration-200 active:scale-[0.99] hover:bg-blue-50/50 hover:shadow-[0_4px_16px_rgba(37,99,235,0.06)] relative z-0 hover:z-10 focus-ring"
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
                        <div className="mt-0.5 text-[0.82rem] font-medium text-slate-500">
                          {showItems ? (
                            Array.isArray((bill as any).bill_items) && (bill as any).bill_items.length > 0 ? (
                              <div className="mt-0.5 text-slate-600 leading-relaxed whitespace-normal">
                                {(bill as any).bill_items.map((item: any) => `${item.product_name_snapshot} (${item.quantity})`).join(', ')}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-slate-400">—</div>
                            )
                          ) : (
                            <div className="truncate">
                              {bill.bill_number} • {formatDateTime(bill.created_at)}
                              {bill.payment_type && (
                                <span className="ml-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">
                                  {bill.payment_type}
                                </span>
                              )}
                              {(bill as any).branch_name_snapshot && (
                                <span className="ml-2 inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                                  {(bill as any).branch_name_snapshot}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                          {bill.is_verified === false ? (
                            <ShieldX className="h-4 w-4 text-amber-500 shrink-0" aria-label="Unverified" />
                          ) : (
                            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" aria-label="Verified" />
                          )}
                          <div className="text-[1rem] font-bold tabular-nums text-emerald-600">
                            {formatCurrency(bill.total)}
                          </div>
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
    </PageShell>
  );
};

export default BillHistoryPage;
