import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  PackageOpen,
  ReceiptIndianRupee,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Button, DateRangeFilter, Skeleton } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useFarmerItemBills, useFarmerItems } from '../hooks/useFarmerItems';
import { getFarmerItems } from '../services/farmerItemsService';
import { PlanGate } from '@/components/auth/PlanGate';
import type { FarmerItemBill, FarmerItemSummary, FarmerItemsPeriod } from '../types/farmerItems';
import { FARMER_ITEMS_PERIODS, getFarmerItemsPeriodRange } from '../utils/farmerItemsPeriod';
import { generateFarmerItemsPdf } from '../utils/farmerItemsPdf';

interface FarmerItemsTabProps {
  farmerId: string;
  farmerName: string;
  stockingDate?: string | null;
  onCollect: (bill: FarmerItemBill) => void;
}

const getStatus = (paid: number, unpaid: number, t: (key: string, options?: any) => string) => {
  if (unpaid <= 0) return { label: t('farmers.itemsTab.fullyPaid', { defaultValue: 'Fully paid' }), className: 'bg-emerald-50 text-emerald-700', Icon: CheckCircle2 };
  if (paid <= 0) return { label: t('farmers.itemsTab.unpaid', { defaultValue: '{{amount}} unpaid', amount: formatCurrency(unpaid) }), className: 'bg-rose-50 text-rose-700', Icon: AlertTriangle };
  return { label: t('farmers.itemsTab.unpaid', { defaultValue: '{{amount}} unpaid', amount: formatCurrency(unpaid) }), className: 'bg-amber-50 text-amber-700', Icon: AlertTriangle };
};

const ItemBillRows: React.FC<{
  farmerId: string;
  productId: string;
  startDate: string;
  endDate: string;
  onCollect: (bill: FarmerItemBill) => void;
}> = ({ farmerId, productId, startDate, endDate, onCollect }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dealer = useAuthStore(s => s.user);
  const hasProPlus = dealer?.plan === 'pro_plus';
  const { data = [], isLoading, isError, refetch } = useFarmerItemBills({
    farmerId,
    productId,
    startDate,
    endDate,
    enabled: true,
  });

  if (isLoading) return <Skeleton className="m-3 h-20 rounded-lg" />;
  if (isError) {
    return (
      <button type="button" onClick={() => refetch()} className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 py-4 text-sm font-bold text-rose-700">
        <RefreshCw className="h-4 w-4" /> {t('farmers.itemsTab.retryBillDetails', 'Retry bill details')}
      </button>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[650px] text-left text-xs">
          <thead className="text-[10px] font-black uppercase text-slate-400">
            <tr><th className="py-2">{t('farmers.itemsTab.date', 'Date')}</th><th className="text-right">{t('farmers.itemsTab.unitPrice', 'Unit Price')}</th><th className="text-right">{t('farmers.itemsTab.discount', 'Disc. %')}</th><th>{t('farmers.itemsTab.qty', 'Qty')}</th><th className="text-right">{t('farmers.itemsTab.amount', 'Amount')}</th><th className="text-center">{t('farmers.itemsTab.status', 'Status')}</th><th className="text-right">{t('farmers.itemsTab.actions', 'Actions')}</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((bill) => {
              const baseTotal = bill.quantity * bill.unit_price;
              const discountVal = baseTotal > 0 && bill.line_total < baseTotal
                ? Math.round((1 - (bill.line_total / baseTotal)) * 100)
                : 0;

              return (
                <tr key={bill.bill_id}>
                  <td className="py-2.5 font-semibold text-slate-700">{formatDate(bill.bill_date)}</td>
                  <td className="text-right font-semibold text-slate-700">{formatCurrency(bill.unit_price)}</td>
                  <td className="text-right font-semibold text-slate-700">{discountVal > 0 ? `${discountVal}%` : '-'}</td>
                  <td className="font-semibold text-slate-700">{bill.quantity}</td>
                  <td className="text-right font-bold text-slate-900">{formatCurrency(bill.line_total)}</td>
                  <td className="text-center">
                    <span role="status" className={`inline-flex rounded px-2 py-1 font-bold ${bill.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : bill.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                      {bill.payment_status === 'paid' ? t('farmers.itemsTab.paid', 'Paid') : bill.payment_status === 'partial' ? t('farmers.itemsTab.partial', 'Partial') : t('farmers.itemsTab.unpaidStatus', 'Unpaid')}
                    </span>
                  </td>
                  <td className="space-x-2 text-right">
                  <button type="button" onClick={() => navigate(`/bills/${bill.bill_id}`, { state: { from: `/farmers/${farmerId}` } })} className="font-bold text-primary hover:underline">{t('farmers.itemsTab.viewBill', 'View Bill')}</button>
                  {hasProPlus && (
                    <button type="button" onClick={() => navigate(`/bills/${bill.bill_id}?edit=true`, { state: { from: `/farmers/${farmerId}` } })} className="font-bold text-blue-600 hover:underline">Edit</button>
                  )}
                  {bill.payment_status !== 'paid' ? <button type="button" onClick={() => onCollect(bill)} className="font-bold text-emerald-700 hover:underline">{t('farmers.itemsTab.collect', 'Collect')}</button> : null}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ItemCard: React.FC<{
  item: FarmerItemSummary;
  expanded: boolean;
  onToggle: () => void;
  farmerId: string;
  startDate: string;
  endDate: string;
  onCollect: (bill: FarmerItemBill) => void;
}> = ({ item, expanded, onToggle, farmerId, startDate, endDate, onCollect }) => {
  const { t } = useTranslation();
  const status = getStatus(item.paid_amount, item.unpaid_amount, t);
  const paidPercent = item.total_value > 0 ? Math.min(100, (item.paid_amount / item.total_value) * 100) : 0;

  return (
    <article className={`overflow-hidden rounded-[16px] border bg-white transition-all duration-200 ${expanded ? 'border-primary/40 shadow-md ring-1 ring-primary/10' : 'border-slate-200/70 shadow-sm hover:border-slate-300 hover:shadow-md'}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="focus-ring w-full text-left bg-transparent block">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center min-w-0">
               <div className="min-w-0">
                 <h3 className="truncate text-[15px] font-black text-slate-900">{item.product_name}</h3>
                 <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                   <span>{item.total_quantity} {item.unit}</span>
                   <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                   <span className="text-slate-700">{formatCurrency(item.total_value)}</span>
                 </div>
               </div>
            </div>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${expanded ? 'bg-primary/10 text-primary' : 'bg-slate-50 text-slate-400'}`}>
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span role="status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black tracking-wide ${status.className}`}>
              <status.Icon className="h-3.5 w-3.5" />
              {status.label}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {t('farmers.itemsTab.last', 'Last')}: <span className="text-slate-700">{formatDate(item.last_purchased_on)}</span> · {t('farmers.itemsTab.bills', 'Bills')}: <span className="text-slate-700">{item.bill_count}</span>
            </span>
          </div>
          
          <div className="mt-3.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${formatCurrency(item.paid_amount)} paid of ${formatCurrency(item.total_value)} total`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(paidPercent)}>
            <span className={`transition-all duration-500 ease-in-out ${item.unpaid_amount <= 0 ? 'bg-emerald-500' : 'bg-[#0ea5e9]'}`} style={{ width: `${paidPercent}%` }} />
          </div>
        </div>
      </button>
      {expanded ? (
        <div className="border-t border-slate-100 bg-slate-50/40 pb-1">
          <ItemBillRows farmerId={farmerId} productId={item.product_id} startDate={startDate} endDate={endDate} onCollect={onCollect} />
        </div>
      ) : null}
    </article>
  );
};

export const FarmerItemsTab: React.FC<FarmerItemsTabProps> = ({ farmerId, farmerName, stockingDate, onCollect }) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealerId = useAuthStore((state) => state.user?.id || '');
  const computedRange = getFarmerItemsPeriodRange(stockingDate ? 'this-season' : 'last-3-months', stockingDate);
  const startDate = searchParams.get('items_start') || computedRange.startDate;
  const endDate = searchParams.get('items_end') || computedRange.endDate;
  const productType = searchParams.get('items_type') || '';
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const query = useFarmerItems({ farmerId, startDate, endDate, productType: productType || undefined });
  const firstPage = query.data?.pages[0];
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) || [], [query.data]);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace: true });
    setExpandedProductId(null);
  };

  const exportPdf = async () => {
    if (!firstPage) return;
    setIsExporting(true);
    try {
      const result = await getFarmerItems({ dealerId, farmerId, startDate, endDate, productType: productType || undefined, limit: 500 });
      generateFarmerItemsPdf({ farmerName, startDate, endDate, summary: result.summary, items: result.items });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="mt-4 space-y-3" aria-label="Farmer purchased items">
      <div className="flex flex-col gap-3 pb-2">
        <DateRangeFilter startDate={startDate} endDate={endDate} onChange={(start, end) => updateParams({ items_start: start, items_end: end })} />
      </div>

      <div className="mb-2 flex rounded-[14px] bg-slate-100/80 p-1 border border-slate-200/50 shadow-inner" aria-label="Filter products by type">
        {[['', t('farmers.itemsTab.filterAll', 'All')], ['feed', t('farmers.itemsTab.filterFeed', 'Feed')], ['medicine', t('farmers.itemsTab.filterMedicine', 'Medicines')]].map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={productType === value}
            onClick={() => updateParams({ items_type: value || null })}
            className={`flex-1 rounded-[10px] py-2 text-[0.85rem] font-bold transition-all duration-200 ${
              productType === value
                ? 'shadow-md'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
            style={productType === value ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {query.isLoading ? <div className="space-y-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-32 rounded-lg" />)}</div> : null}
      {query.isError ? (
        <div className="border border-rose-200 bg-rose-50 px-4 py-8 text-center">
          <p className="text-sm font-bold text-rose-800">{t('farmers.itemsTab.couldNotLoad', 'Could not load items')}</p>
          <Button variant="outline" onClick={() => query.refetch()} className="mt-3"><RefreshCw className="h-4 w-4" /> {t('farmers.itemsTab.retry', 'Retry')}</Button>
        </div>
      ) : null}

      {firstPage ? (
        <>
          <div className={`grid grid-cols-2 divide-x divide-y divide-slate-200 border border-slate-200 sm:grid-cols-4 sm:divide-y-0 ${firstPage.summary.unpaid_amount <= 0 && items.length ? 'bg-emerald-50' : 'bg-white'}`}>
            {[
              [t('farmers.itemsTab.totalProducts', 'Total Products'), firstPage.summary.total_products, 'totalProducts'],
              [t('farmers.itemsTab.totalQty', 'Total Qty'), firstPage.summary.total_quantity, 'totalQty'],
              [t('farmers.itemsTab.totalValue', 'Total Value'), formatCurrency(firstPage.summary.total_value), 'totalValue'],
              [t('farmers.itemsTab.unpaidAmount', 'Unpaid Amount'), formatCurrency(firstPage.summary.unpaid_amount), 'unpaidAmount'],
            ].map(([label, value, key]) => <div key={key} className="min-w-0 p-3"><div className="text-[10px] font-black uppercase text-slate-500">{label}</div><div className={`mt-1 truncate text-sm font-black ${key === 'unpaidAmount' ? firstPage.summary.unpaid_amount > 0 ? 'text-rose-700' : 'text-emerald-700' : 'text-slate-950'}`}>{value}</div></div>)}
          </div>

          {items.length && firstPage.summary.unpaid_amount <= 0 ? <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{t('farmers.itemsTab.allPaid', 'All purchases in this period are fully paid')}</div> : null}



          {!items.length ? (
            <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center"><PackageOpen className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 text-sm font-black text-slate-800">{t('farmers.itemsTab.noPurchases', 'No purchases in this period')}</p><p className="mt-1 text-xs font-semibold text-slate-500">{t('farmers.itemsTab.tryLongerRange', 'Try selecting a longer time range')}</p></div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => <ItemCard key={item.product_id} item={item} expanded={expandedProductId === item.product_id} onToggle={() => setExpandedProductId((current) => current === item.product_id ? null : item.product_id)} farmerId={farmerId} startDate={startDate} endDate={endDate} onCollect={onCollect} />)}
            </div>
          )}

          {query.hasNextPage ? <Button variant="outline" fullWidth loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}><ReceiptIndianRupee className="h-4 w-4" />{t('farmers.itemsTab.loadMore', 'Load more products')}</Button> : null}
        </>
      ) : null}

      {items.length > 0 && (
        <div className="pt-2">
          <Button variant="outline" fullWidth onClick={exportPdf} disabled={!items.length} loading={isExporting} className="h-11 flex flex-row items-center justify-center gap-2 border-slate-300 font-bold" aria-label="Export purchased items PDF">
            <Download className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap">{t('farmers.itemsTab.export', 'Export')}</span>
          </Button>
        </div>
      )}
    </section>
  );
};

export default FarmerItemsTab;
