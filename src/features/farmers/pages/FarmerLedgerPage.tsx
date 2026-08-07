import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmer, useFarmerBillsPage, useFarmerPaymentsPage, useFarmerTransactions, useFarmerLedgerPage, useFarmerStatement } from '../hooks/useFarmerLedger';
import { Skeleton, Button, DateRangeFilter, FarmerAvatar } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import CollectPaymentModal from '../components/CollectPaymentModal';
import BalanceStatementModal from '../components/BalanceStatementModal';
import LedgerActions from '../components/LedgerActions';
import { ArrowLeft, Edit2, Phone, FileText, User } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, getInitials } from '@/lib/utils';
import { CROP_STATUSES } from '@/lib/constants';
import FarmerHeaderCard from '../components/FarmerHeaderCard';
import FarmerSummaryRow from '../components/FarmerSummaryRow';
import FarmerTabs, { TabType } from '../components/FarmerTabs';
import FarmerLedgerList from '../components/FarmerLedgerList';
import FarmerFooterSummary from '../components/FarmerFooterSummary';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import FarmerProductDiscounts from '../components/FarmerProductDiscounts';
import { useAuthStore } from '@/stores/authStore';
import FarmerItemsTab from '../components/FarmerItemsTab';
import type { FarmerItemBill } from '../types/farmerItems';

interface FarmerTransactionItem {
  id: string;
  type: 'bill' | 'payment' | 'return';
  refNumber: string;
  date: string;
  amount: number;
  runningBalance: number;
  branchName?: string | null;
  isEstimate?: boolean;
}

const toLocalDateString = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
  </div>
);

export const FarmerLedgerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = typeof location.state?.from === 'string' ? location.state.from : '/farmers';
  const { t } = useTranslation();
  const hasFarmerDiscountFeature = useSubscriptionStore((state) => state.hasFeature('farmer_product_discounts'));
  const dealer = useAuthStore((state) => state.user);

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectPreset, setCollectPreset] = useState<FarmerItemBill | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const { data: allTimeStatement } = useFarmerStatement(id || '', '2000-01-01', new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<TabType>('ledger');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toLocalDateString(date);
  });
  const [endDate, setEndDate] = useState(() => toLocalDateString(new Date()));

  // Fallback to ledger tab if resizing to desktop while on details tab
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && activeTab === 'details') {
        setActiveTab('ledger');
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab]);

  const { data: farmer, isLoading: farmerLoading } = useFarmer(id!);
  // Items tab still needs the full transaction list for per-product aggregation.
  // Ledger tab moved to server-paginated fetch to avoid mobile freezes on 10k+ txns.
  const { data: transactions = [], isLoading: txLoading } = useFarmerTransactions(id!, activeTab === 'items');
  const ledgerQuery = useFarmerLedgerPage({
    farmerId: id!,
    startDate,
    endDate,
    enabled: activeTab === 'ledger',
    pageSize: 25,
  });
  const billsQuery = useFarmerBillsPage({
    farmerId: id!,
    startDate,
    endDate,
    enabled: activeTab === 'bills',
  });
  const paymentsQuery = useFarmerPaymentsPage({
    farmerId: id!,
    startDate,
    endDate,
    enabled: activeTab === 'payments',
  });

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (startDate || endDate) {
      result = result.filter((tx) => {
        const txDateStr = tx.date.slice(0, 10);
        return (!startDate || txDateStr >= startDate) && (!endDate || txDateStr <= endDate);
      });
    }

    return result;
  }, [transactions, startDate, endDate]);

  const bills = useMemo(
    () => filteredAndSortedTransactions.filter((tx) => tx.type === 'bill'),
    [filteredAndSortedTransactions]
  );
  const payments = useMemo(
    () => filteredAndSortedTransactions.filter((tx) => tx.type === 'payment'),
    [filteredAndSortedTransactions]
  );
  const pagedBills = useMemo(() => billsQuery.data?.pages.flatMap((page) => page.rows) || [], [billsQuery.data]);
  const pagedBillsTotal = billsQuery.data?.pages[0]?.total || 0;
  const pagedPayments = useMemo(() => paymentsQuery.data?.pages.flatMap((page) => page.rows) || [], [paymentsQuery.data]);
  const pagedPaymentsTotal = paymentsQuery.data?.pages[0]?.total || 0;

  // Paginated ledger — flatten pages and compute per-row running balance walking
  // newest → oldest starting from farmer.total_due. Small caveat: cash-paid bills
  // and bill edits/cancellations aren't reflected in this simple walk (impact is
  // treated as bill=+amount, payment=-amount). Balance number is a running
  // estimate; the footer summary shows the authoritative current due.
  const pagedLedger = useMemo<FarmerTransactionItem[]>(() => {
    const flat = ledgerQuery.data?.pages.flatMap((p) => p.data) || [];
    const currentDue = farmer?.total_due ?? 0;
    let running = currentDue;
    return flat.map((tx, i) => {
      if (i > 0) {
        const prev = flat[i - 1];
        running -= (!prev.is_estimate && prev.type === 'bill') ? Number(prev.amount)
                 : prev.type !== 'bill' ? -Number(prev.amount)
                 : 0;
      }
      return {
        id: tx.id,
        type: tx.type,
        refNumber: tx.ref_number,
        date: tx.date,
        amount: Number(tx.amount),
        runningBalance: running,
        branchName: (tx as any).branch_name || null,
        isEstimate: (tx as any).is_estimate ?? false,
      };
    });
  }, [ledgerQuery.data, farmer?.total_due]);
  const pagedLedgerTotal = ledgerQuery.data?.pages[0]?.total || 0;

  if (farmerLoading) {
    return (
      <div className="space-y-4 px-1 py-5 sm:px-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
          <User className="h-10 w-10 text-slate-400" />
        </div>
        <p className="font-medium text-text-secondary">{t('farmers.farmerNotFound', 'Farmer not found.')}</p>
        <Button onClick={() => navigate(backTo)} variant="outline" className="mt-6">
          {t('common.back', 'Go Back')}
        </Button>
      </div>
    );
  }

  // On the ledger tab the transactions list is server-paginated (pagedLedger),
  // so the footer's debit/credit reflect only the rows loaded so far. Elsewhere
  // fall back to the full transactions dataset (used by items/details tabs).
  const debitCreditSource = activeTab === 'ledger' ? pagedLedger : filteredAndSortedTransactions;
  const totalDebit = debitCreditSource.filter((t) => t.type === 'bill').reduce((acc, t) => acc + t.amount, 0);
  const totalCredit = debitCreditSource.filter((t) => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
  const totalReturns = debitCreditSource.filter((t) => t.type === 'return').reduce((acc, t) => acc + t.amount, 0);
  const cropLabel = CROP_STATUSES.find((crop) => crop.value === farmer.crop_status)?.label || 'Active';
  const riskLabel: 'Low Risk' | 'Medium Risk' | 'High Risk' =
    farmer.risk_status === 'risky'
      ? 'High Risk'
      : farmer.risk_status === 'monitor'
      ? 'Medium Risk'
      : 'Low Risk';



  const detailRows = [
    { label: 'Phone', value: farmer.phone || 'Not added' },
    { label: 'Village', value: farmer.village || 'Not added' },
    { label: 'Mandal', value: farmer.mandal || 'Not added' },
    { label: 'District', value: farmer.district || 'Not added' },
    { label: 'Pond Acres', value: farmer.pond_acres ? `${farmer.pond_acres} acres` : 'Not added' },
    { label: 'Stocking Date', value: farmer.stocking_date ? formatDate(farmer.stocking_date) : 'Not added' },
    {
      label: 'Harvest Estimate',
      value: farmer.estimated_harvest_date ? formatDate(farmer.estimated_harvest_date) : 'Not added',
    },
    { label: 'Crop Status', value: cropLabel },
    { label: 'Risk Status', value: riskLabel },
    { label: 'Credit Limit', value: formatCurrency(farmer.credit_limit) },
    { label: 'Previous Due', value: formatCurrency(farmer.opening_balance || 0) },
    { label: 'Current Due', value: formatCurrency(farmer.total_due) },
  ];

  const detailSections = [
    {
      title: 'Contact & Location',
      items: detailRows.slice(0, 4),
    },
    {
      title: 'Farm Details',
      items: detailRows.slice(4, 9),
    },
    {
      title: 'Financial',
      items: detailRows.slice(9, 12),
    },
  ];

  const renderDateFilter = () => (
    <div className="w-full sm:flex sm:justify-center">
      <div className="w-full max-w-sm animate-fade-in">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(start, end) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      </div>
    </div>
  );

  const renderBills = () => {
    if (billsQuery.isLoading) {
      return <Skeleton className="h-36 w-full rounded-[24px]" />;
    }

    return (
      <>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
          {renderDateFilter()}
        </div>
        <div className="flex flex-col">
        {!pagedBills.length ? (
          <div className="m-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
            No bills found for this farmer.
          </div>
        ) : pagedBills.map((bill, index) => {
          const billDate = new Date(bill.date);
          const day = billDate.getDate();
          const month = billDate.toLocaleDateString('en-US', { month: 'short' });
          const isLast = index === pagedBills.length - 1;

          return (
            <React.Fragment key={bill.id}>
              <button
                type="button"
                onClick={() => navigate(`/bills/${bill.id}`, { state: { from: `/farmers/${farmer.id}` } })}
                className="group flex min-h-[80px] w-full items-center justify-between px-4 py-4 text-left transition-all active:scale-[0.99] hover:bg-slate-50/70 focus-ring"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                    <span className="text-[0.95rem] font-black leading-none text-slate-800">{day}</span>
                    <span className="mt-0.5 text-[0.56rem] font-black uppercase tracking-[0.16em] text-slate-400">{month}</span>
                  </div>

                  <div className="min-w-0">
                    {bill.items.length ? (
                      <div className="truncate text-[0.95rem] font-bold tracking-tight text-slate-900">
                        {bill.items.map(i => i.product_name).join(', ')}
                      </div>
                    ) : (
                      <div className="truncate text-[0.95rem] font-bold tracking-tight text-slate-900">{bill.refNumber}</div>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[0.78rem] font-medium text-slate-500">
                      {bill.items.length ? (
                        bill.items.map(i => (
                          <span key={i.product_name}>{i.quantity} {i.product_name.split(' ')[0]}</span>
                        ))
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-[0.75rem] font-medium text-slate-400">
                      {formatDate(bill.date)} · {bill.refNumber}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <div className="text-[1rem] font-bold tabular-nums text-emerald-600">
                      {formatCurrency(bill.amount)}
                    </div>
                    <div className="mt-0 text-[0.72rem] font-semibold text-slate-400">
                      Tap to open
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
      </div>
      {pagedBillsTotal > pagedBills.length ? (
        <ListLoadMore
          shown={pagedBills.length}
          total={pagedBillsTotal}
          onLoadMore={() => { void billsQuery.fetchNextPage(); }}
          label={billsQuery.isFetchingNextPage ? t('common.loading', 'Loading...') : t('common.loadMore', 'Load more')}
        />
      ) : null}
      </>
    );
  };

  const renderPayments = () => {
    if (paymentsQuery.isLoading) {
      return <Skeleton className="h-36 w-full rounded-[24px]" />;
    }

    return (
      <>
      <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
          {renderDateFilter()}
        </div>
        <div className="flex flex-col">
          {!pagedPayments.length ? (
            <div className="m-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
              No payments recorded for this farmer.
            </div>
          ) : pagedPayments.map((payment, index) => {
            const isLast = index === pagedPayments.length - 1;
            return (
              <React.Fragment key={payment.id}>
                <div className="flex items-center justify-between px-4 py-3.5 bg-emerald-50/20">
                  <div>
                    <div className="text-sm font-black text-slate-900">{payment.refNumber}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">{formatDate(payment.date)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black text-emerald-600">+{formatCurrency(payment.amount)}</div>
                    <div className="text-xs font-semibold text-slate-400">Received payment</div>
                  </div>
                </div>
                {!isLast && <div className="h-px w-full bg-slate-200/80" aria-hidden="true" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {pagedPaymentsTotal > pagedPayments.length ? (
        <ListLoadMore
          shown={pagedPayments.length}
          total={pagedPaymentsTotal}
          onLoadMore={() => { void paymentsQuery.fetchNextPage(); }}
          label={paymentsQuery.isFetchingNextPage ? t('common.loading', 'Loading...') : t('common.loadMore', 'Load more')}
        />
      ) : null}
      </>
    );
  };

  const renderDetails = () => (
    <div className="mt-4 space-y-4">
      <div className="space-y-4">
        {detailSections.map((section) => (
          <div key={section.title} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                {section.title}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                {section.items.length} fields
              </div>
            </div>
            <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
              {section.items.map((item) => (
                <div key={item.label} className="bg-white px-4 py-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {item.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {hasFarmerDiscountFeature && dealer?.farmer_product_discounts_enabled ? (
        <FarmerProductDiscounts
          farmerId={farmer.id}
          farmerName={farmer.name}
          defaultDiscount={Number(farmer.default_medicine_discount_percentage || 0)}
        />
      ) : null}
      <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
          <FileText className="h-4 w-4 text-slate-500" />
          Notes
        </div>
        <p className="text-sm font-medium leading-6 text-slate-600">
          {farmer.notes || 'No notes added for this farmer.'}
        </p>
      </div>
    </div>
  );

  return (
    <PageShell width="wide">
      <PageHeader
        title={farmer.name}
        className="[&_.page-header__title]:text-[clamp(1.5rem,4vw,2rem)]"
        onBack={() => navigate(backTo)}
        avatar={
          <FarmerAvatar 
            imageUrl={farmer.image_url} 
            name={farmer.name} 
            size="xl" 
            className="border-2 border-white/20" 
          />
        }
        action={<div className="flex gap-2"><button type="button" onClick={() => setIsStatementModalOpen(true)} className="px-4 py-2 rounded-full bg-white text-primary transition-all shadow-sm active:scale-95 text-[0.8rem] font-bold uppercase tracking-wider">View Statement</button><button type="button" onClick={() => navigate(`/farmers/${farmer.id}/edit`)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-all ring-1 ring-white/20 hover:ring-white/40 shadow-sm backdrop-blur-sm active:scale-95 text-[0.8rem] font-bold uppercase tracking-wider" aria-label="Edit Farmer"><Edit2 className="h-4 w-4" />Edit</button></div>}
        description={
          <div className="mt-1.5 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold text-white/80">
              <span className="opacity-90">{farmer.village || 'Location not added'}</span>
              <span className="text-white/30">•</span>
              <span className={`inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                riskLabel === 'High Risk' ? 'text-rose-300 bg-rose-500/10' :
                riskLabel === 'Medium Risk' ? 'text-amber-300 bg-amber-500/10' :
                'text-emerald-300 bg-emerald-500/10'
              }`}>
                {riskLabel}
              </span>
            </div>
            
          </div>
        }
      />

      <div className="animate-fade-in pb-14 lg:pb-8 lg:grid lg:grid-cols-[1fr_350px] lg:gap-6 lg:items-start lg:mt-6">
        {/* Left Column (Main Flow) */}
        <div className="space-y-4 min-w-0">
          
          {/* Dashboard KPI Cards (Desktop & Mobile) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 lg:mt-0">
            <div className="rounded-[20px] bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">Total Due</span>
              <span className="mt-1 block text-base sm:text-xl font-black text-slate-900 truncate">{formatCurrency(farmer.total_due)}</span>
            </div>
            <div className="rounded-[20px] bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">Credit Limit</span>
              <span className="mt-1 block text-base sm:text-xl font-black text-slate-700 truncate">{formatCurrency(farmer.credit_limit)}</span>
            </div>
            <div className="rounded-[20px] bg-white p-3 sm:p-4 shadow-sm border border-slate-200 flex flex-col justify-center">
              <span className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400 block">Available</span>
              <span className={`mt-1 block text-base sm:text-xl font-black truncate ${
                (farmer.credit_limit - farmer.total_due) < 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}>
                {formatCurrency(farmer.credit_limit - farmer.total_due)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4 rounded-[20px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-4 shadow-sm sm:grid-cols-5 sm:gap-2 sm:border-slate-200 sm:bg-white sm:p-3">
            {[['Opening Balance', allTimeStatement?.openingBalance ?? (farmer.opening_balance || 0), 'text-slate-800'], ['Total Debit', allTimeStatement?.totalDebit ?? totalDebit, 'text-rose-600'], ['Total Credit', allTimeStatement?.totalCredit ?? totalCredit, 'text-emerald-600'], ['Returned Value', allTimeStatement?.totalReturns ?? totalReturns, 'text-amber-700'], ['Closing Balance', allTimeStatement?.closingBalance ?? farmer.total_due, 'text-primary']].map(([label, value, tone]) => <div key={label as string} className="min-w-0 last:col-span-2 last:rounded-xl last:border last:border-primary/15 last:bg-white/80 last:px-3 last:py-2 sm:last:col-span-1 sm:last:border-0 sm:last:bg-transparent sm:last:px-0 sm:last:py-0"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 truncate text-base font-black sm:text-sm ${tone}`}>{formatCurrency(Number(value))}</div></div>)}
          </div>

          <div className="mt-3 lg:hidden rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Quick Contact</div>
            {farmer.phone ? (
              <div className="hidden items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 sm:flex">
                <Phone className="h-3.5 w-3.5" />
                {farmer.phone}
              </div>
            ) : null}
          </div>
          <LedgerActions
            farmerId={farmer.id}
            farmerName={farmer.name}
            farmerPhone={farmer.phone}
            shareToken={farmer.share_token}
            totalDue={farmer.total_due}
            onCollect={() => {
              setCollectPreset(null);
              setIsCollectModalOpen(true);
            }}
          />
        </div>

        <div className="mt-5">
          <FarmerTabs activeTab={activeTab} onChange={setActiveTab} />

          {/* Date filter is now inside the lists */}

          <div className="py-2">
            {activeTab === 'ledger' ? (
              <>
                <FarmerLedgerList
                  transactions={pagedLedger}
                  isLoading={ledgerQuery.isLoading}
                  backTo={`/farmers/${farmer.id}`}
                  headerComponent={renderDateFilter()}
                  serverPagination={{
                    total: pagedLedgerTotal,
                    hasMore: !!ledgerQuery.hasNextPage,
                    isFetchingMore: ledgerQuery.isFetchingNextPage,
                    onLoadMore: () => ledgerQuery.fetchNextPage(),
                  }}
                />
                <div className="sticky bottom-4 z-20 mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 drop-shadow-2xl">
                  <FarmerFooterSummary
                    hideDetails
                    openingBalance={farmer.opening_balance || 0}
                    totalDebit={totalDebit}
                    totalCredit={totalCredit}
                    currentDue={farmer.total_due}
                    onViewStatement={() => setIsStatementModalOpen(true)}
                  />
                </div>
              </>
            ) : null}
            {activeTab === 'items' ? (
              <FarmerItemsTab
                farmerId={farmer.id}
                farmerName={farmer.name}
                farmerPhone={farmer.phone}
                stockingDate={farmer.stocking_date}
                firstActivityDate={transactions.length ? transactions[transactions.length - 1]?.date : farmer.created_at}
                onCollect={(bill) => {
                  setCollectPreset(bill);
                  setIsCollectModalOpen(true);
                }}
              />
            ) : null}
            {activeTab === 'bills' ? renderBills() : null}
            {activeTab === 'payments' ? renderPayments() : null}
            {activeTab === 'details' ? renderDetails() : null}
          </div>
          </div>
        </div>

        {/* Right Column (Sidebar - Desktop Only) */}
        <div className="hidden lg:block sticky top-24 space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Quick Contact</div>
              {farmer.phone ? (
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  <Phone className="h-3.5 w-3.5" />
                  {farmer.phone}
                </div>
              ) : null}
            </div>
            <LedgerActions
              farmerId={farmer.id}
              farmerName={farmer.name}
              farmerPhone={farmer.phone}
              shareToken={farmer.share_token}
              totalDue={farmer.total_due}
              onCollect={() => {
                setCollectPreset(null);
                setIsCollectModalOpen(true);
              }}
            />
          </div>
          
          {/* Render details content in sidebar */}
          <div className="details-sidebar-container">
            {renderDetails()}
          </div>
        </div>

      </div>

      <CollectPaymentModal
        isOpen={isCollectModalOpen}
        onClose={() => {
          setIsCollectModalOpen(false);
          setCollectPreset(null);
        }}
        farmerId={farmer.id}
        farmerName={farmer.name}
        totalDue={farmer.total_due}
        initialBillId={collectPreset?.bill_id}
        initialAmount={collectPreset?.balance_due}
      />
      {isStatementModalOpen && (
        <BalanceStatementModal
          isOpen={isStatementModalOpen}
          onClose={() => setIsStatementModalOpen(false)}
          farmerId={farmer.id}
        />
      )}
      </PageShell>
  );
};

export default FarmerLedgerPage;
