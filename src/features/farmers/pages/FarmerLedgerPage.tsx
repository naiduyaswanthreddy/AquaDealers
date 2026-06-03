import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarmer, useFarmerTransactions } from '../hooks/useFarmerLedger';
import { Skeleton, Button, DateRangeFilter, FarmerAvatar } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import CollectPaymentModal from '../components/CollectPaymentModal';
import BalanceStatementModal from '../components/BalanceStatementModal';
import LedgerActions from '../components/LedgerActions';
import { ArrowLeft, Edit2, Phone, FileText, User } from 'lucide-react';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { CROP_STATUSES } from '@/lib/constants';
import FarmerHeaderCard from '../components/FarmerHeaderCard';
import FarmerSummaryRow from '../components/FarmerSummaryRow';
import FarmerTabs, { TabType } from '../components/FarmerTabs';
import FarmerLedgerList from '../components/FarmerLedgerList';
import FarmerFooterSummary from '../components/FarmerFooterSummary';
import { useLoadMoreList } from '@/lib/useLoadMoreList';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

interface FarmerTransactionItem {
  id: string;
  type: 'bill' | 'payment';
  refNumber: string;
  date: string;
  amount: number;
  runningBalance: number;
}

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
  </div>
);

export const FarmerLedgerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const now = useMemo(() => new Date(), []);
  const defaultFirstDay = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), [now]);
  const defaultLastDay = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10), [now]);

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('ledger');
  const [startDate, setStartDate] = useState(defaultFirstDay);
  const [endDate, setEndDate] = useState(defaultLastDay);

  const { data: farmer, isLoading: farmerLoading } = useFarmer(id!);
  const { data: transactions = [], isLoading: txLoading } = useFarmerTransactions(id!);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (startDate && endDate) {
      result = result.filter((tx) => {
        const txDateStr = tx.date.slice(0, 10);
        return txDateStr >= startDate && txDateStr <= endDate;
      });
    }

    return result;
  }, [transactions, startDate, endDate]);

  const bills = useMemo(
    () => filteredAndSortedTransactions.filter((tx): tx is FarmerTransactionItem => tx.type === 'bill'),
    [filteredAndSortedTransactions]
  );
  const payments = useMemo(
    () => filteredAndSortedTransactions.filter((tx): tx is FarmerTransactionItem => tx.type === 'payment'),
    [filteredAndSortedTransactions]
  );
  const pagedBills = useLoadMoreList(bills, {
    initialCount: 10,
    step: 10,
    resetDeps: [bills.length, startDate, endDate],
  });
  const pagedPayments = useLoadMoreList(payments, {
    initialCount: 10,
    step: 10,
    resetDeps: [payments.length, startDate, endDate],
  });

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
        <Button onClick={() => navigate('/farmers')} variant="outline" className="mt-6">
          {t('common.back', 'Go Back')}
        </Button>
      </div>
    );
  }

  const totalDebit = bills.reduce((acc, curr) => acc + curr.amount, 0);
  const totalCredit = payments.reduce((acc, curr) => acc + curr.amount, 0);
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
    { label: 'Opening Balance', value: formatCurrency(farmer.opening_balance || 0) },
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

  const renderBills = () => {
    if (txLoading) {
      return <Skeleton className="h-36 w-full rounded-[24px]" />;
    }

    if (!bills.length) {
      return (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
          No bills found for this farmer.
        </div>
      );
    }

    return (
      <>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        {pagedBills.visibleItems.map((bill, index) => {
          const billDate = new Date(bill.date);
          const day = billDate.getDate();
          const month = billDate.toLocaleDateString('en-US', { month: 'short' });
          const isLast = index === pagedBills.visibleItems.length - 1;

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
                    <div className="truncate text-[1rem] font-bold tracking-tight text-slate-900">Bill</div>
                    <div className="mt-0.5 truncate text-[0.82rem] font-medium text-slate-500">
                      {bill.refNumber}
                    </div>
                    <div className="mt-0.5 truncate text-[0.82rem] font-medium text-slate-500">
                      {formatDate(bill.date)}
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
      <ListLoadMore
        shown={pagedBills.visibleCount}
        total={pagedBills.totalCount}
        onLoadMore={pagedBills.loadMore}
        label={t('common.loadMore', 'Load more')}
      />
      </>
    );
  };

  const renderPayments = () => {
    if (txLoading) {
      return <Skeleton className="h-36 w-full rounded-[24px]" />;
    }

    if (!payments.length) {
      return (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-500">
          No payments recorded for this farmer.
        </div>
      );
    }

    return (
      <>
      <div className="mt-4 space-y-3">
        {pagedPayments.visibleItems.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between rounded-[22px] border border-emerald-100 bg-emerald-50/70 px-4 py-3.5 shadow-sm"
          >
            <div>
              <div className="text-sm font-black text-slate-900">{payment.refNumber}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">{formatDate(payment.date)}</div>
            </div>
            <div className="text-right">
              <div className="text-base font-black text-emerald-600">+{formatCurrency(payment.amount)}</div>
              <div className="text-xs font-semibold text-slate-400">Received payment</div>
            </div>
          </div>
        ))}
      </div>
      <ListLoadMore
        shown={pagedPayments.visibleCount}
        total={pagedPayments.totalCount}
        onLoadMore={pagedPayments.loadMore}
        label={t('common.loadMore', 'Load more')}
      />
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
        eyebrow={t('farmers.farmerDetails', 'Farmer Details')}
        onBack={() => navigate('/farmers')}
        avatar={
          <FarmerAvatar 
            imageUrl={farmer.image_url} 
            name={farmer.name} 
            size="xl" 
            className="border-2 border-white/20" 
          />
        }
        topRightAction={
          <button
            type="button"
            onClick={() => navigate(`/farmers/${farmer.id}/edit`)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white transition-all active:scale-95"
            aria-label="Edit Farmer"
          >
            <Edit2 className="h-4.5 w-4.5" />
          </button>
        }
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
            
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.04] p-3 border border-white/[0.08] backdrop-blur-md shadow-sm">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">Total Due</span>
                <span className="mt-0.5 text-[1rem] font-black text-white">{formatCurrency(farmer.total_due)}</span>
              </div>
              <div className="text-left border-l border-white/[0.08] pl-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">Credit Limit</span>
                <span className="mt-0.5 text-[1rem] font-black text-white/90">{formatCurrency(farmer.credit_limit)}</span>
              </div>
              <div className="text-left border-l border-white/[0.08] pl-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 block">Available</span>
                <span className={`mt-0.5 text-[1rem] font-black ${
                  (farmer.credit_limit - farmer.total_due) < 0 ? 'text-rose-300' : 'text-emerald-300'
                }`}>
                  {formatCurrency(farmer.credit_limit - farmer.total_due)}
                </span>
              </div>
            </div>
          </div>
        }
      />

      <div className="animate-fade-in space-y-4 pb-14">

        <div className="mt-3">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
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
            onCollect={() => setIsCollectModalOpen(true)}
          />
        </div>

        <div className="mt-5">
          <FarmerTabs activeTab={activeTab} onChange={setActiveTab} />

          {activeTab !== 'details' && (
            <div className="mt-3.5 mb-1.5 w-full max-w-sm ml-auto px-1 animate-fade-in">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
              />
            </div>
          )}

          <div className="py-2">
            {activeTab === 'ledger' ? (
              <>
                <FarmerLedgerList transactions={filteredAndSortedTransactions} isLoading={txLoading} backTo={`/farmers/${farmer.id}`} />
                <FarmerFooterSummary
                  openingBalance={farmer.opening_balance || 0}
                  totalDebit={totalDebit}
                  totalCredit={totalCredit}
                  currentDue={farmer.total_due}
                  onViewStatement={() => setIsStatementModalOpen(true)}
                />
              </>
            ) : null}
            {activeTab === 'bills' ? renderBills() : null}
            {activeTab === 'payments' ? renderPayments() : null}
            {activeTab === 'details' ? renderDetails() : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DetailItem label="Village" value={farmer.village || 'Not added'} />
            <DetailItem label="Crop" value={cropLabel} />
            <DetailItem label="Stocking" value={farmer.stocking_date ? formatDate(farmer.stocking_date) : 'Not added'} />
            <DetailItem label="Created" value={formatDate(farmer.created_at)} />
          </div>
        </div>
      </div>

      <CollectPaymentModal
        isOpen={isCollectModalOpen}
        onClose={() => setIsCollectModalOpen(false)}
        farmerId={farmer.id}
        farmerName={farmer.name}
        totalDue={farmer.total_due}
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
