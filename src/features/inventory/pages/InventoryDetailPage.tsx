import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Link2,
  MoreVertical,
  Package2,
  PackagePlus,
  Pencil,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, EmptyState, Skeleton, Modal, Input } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useInventoryDetail } from '../hooks/useInventory';
import StockAdjustmentModal from '../components/StockAdjustmentModal';
import EditInventoryModal from '../components/EditInventoryModal';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

/* ────────────────────────────────────────────── */
/*  Helpers                                       */
/* ────────────────────────────────────────────── */

const getHealthTone = (quantity: number, minStockAlert: number) => {
  if (quantity <= 0) {
    return {
      label: 'Out of Stock',
      badge: 'danger' as const,
      cardClass: 'border-rose-200 bg-rose-50 text-rose-700',
      icon: AlertTriangle,
    };
  }

  if (quantity <= minStockAlert) {
    return {
      label: 'Low Stock',
      badge: 'warning' as const,
      cardClass: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: AlertTriangle,
    };
  }

  return {
    label: 'Healthy',
    badge: 'success' as const,
    cardClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: ShieldCheck,
  };
};

const getMovementLabel = (referenceType: string, quantityChange: number) => {
  if (referenceType === 'purchase') return 'Purchase Received';
  if (referenceType === 'bill') return 'Sale';
  if (referenceType === 'bill_cancellation') return 'Bill Cancelled';
  if (referenceType === 'manual_adjustment') {
    return quantityChange >= 0 ? 'Manual Increase' : 'Manual Reduction';
  }
  return 'Stock Movement';
};

const getProductArt = (type?: string | null) => {
  const normalized = (type || '').toLowerCase();
  if (normalized.includes('feed')) return new URL('../../../../feed.svg', import.meta.url).href;
  if (normalized.includes('medicine') || normalized.includes('medic')) {
    return new URL('../../../../medicine_.svg', import.meta.url).href;
  }
  return null;
};

const parseMonthLabelToInputVal = (monthLabel: string) => {
  const [monthName, year] = monthLabel.split(' ');
  const date = new Date(`${monthName} 1, ${year}`);
  if (isNaN(date.getTime())) return '';
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${monthNum}`;
};

/* ────────────────────────────────────────────── */
/*  Stats card config                             */
/* ────────────────────────────────────────────── */

const buildStatCards = (
  summary: {
    currentStock: number;
    totalReceived: number;
    totalIssued: number;
    availableLots: number;
    totalAdjustedIn: number;
    totalAdjustedOut: number;
    lowStockThreshold: number | null;
    lastMovementAt: string | null;
  },
  stockUnit: string
) => [
  { label: 'Current Stock', value: `${summary.currentStock} ${stockUnit}`, icon: Boxes, tone: 'bg-sky-50 text-sky-600' },
  { label: 'Total Received', value: `${summary.totalReceived} ${stockUnit}`, icon: TrendingDown, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Total Issued', value: `${summary.totalIssued} ${stockUnit}`, icon: TrendingUp, tone: 'bg-rose-50 text-rose-600' },
  { label: 'Available Lots', value: String(summary.availableLots), icon: ReceiptText, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Manual Added', value: `${summary.totalAdjustedIn} ${stockUnit}`, icon: TrendingUp, tone: 'bg-teal-50 text-teal-600' },
  { label: 'Manual Reduced', value: `${summary.totalAdjustedOut} ${stockUnit}`, icon: TrendingDown, tone: 'bg-orange-50 text-orange-600' },
  { label: 'Low Stock Alert', value: `${summary.lowStockThreshold ?? 0} ${stockUnit}`, icon: AlertTriangle, tone: 'bg-red-50 text-red-500' },
  { label: 'Last Movement', value: summary.lastMovementAt ? formatDate(summary.lastMovementAt) : '—', icon: CalendarRange, tone: 'bg-slate-100 text-slate-600' },
];

/* ────────────────────────────────────────────── */
/*  Component                                     */
/* ────────────────────────────────────────────── */

const InventoryDetailPage: React.FC = () => {
  const { inventoryId = '' } = useParams<{ inventoryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, error } = useInventoryDetail(inventoryId);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [transactionModalType, setTransactionModalType] = useState<'in' | 'out' | 'net' | null>(null);
  const [isEditInventoryOpen, setIsEditInventoryOpen] = useState(false);
  const [dailyMovementDate, setDailyMovementDate] = useState(() => new Date().toISOString().slice(0, 10));

  const inventory = data?.inventory;

  const health = useMemo(() => {
    if (!inventory) return null;
    return getHealthTone(Number(inventory.quantity_in_stock || 0), Number(inventory.min_stock_alert || 0));
  }, [inventory]);

  const selectedMonthData = useMemo(() => {
    if (!data?.monthlySeries.length) return null;
    return data.monthlySeries[selectedMonthIndex] || data.monthlySeries[0];
  }, [data?.monthlySeries, selectedMonthIndex]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // e.g. "2026-05"
    if (!val) return;
    const foundIdx = data?.monthlySeries.findIndex((item) => {
      return parseMonthLabelToInputVal(item.month) === val;
    });
    if (foundIdx !== undefined && foundIdx !== -1) {
      setSelectedMonthIndex(foundIdx);
    }
  };

  const recentBills = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return data.movements
      .filter((movement) => movement.bill?.id)
      .filter((movement) => {
        if (!movement.bill || seen.has(movement.bill.id)) return false;
        seen.add(movement.bill.id);
        return true;
      })
      .slice(0, 4);
  }, [data]);

  const recentPurchases = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return data.movements
      .filter((movement) => movement.purchase?.id)
      .filter((movement) => {
        if (!movement.purchase || seen.has(movement.purchase.id)) return false;
        seen.add(movement.purchase.id);
        return true;
      })
      .slice(0, 4);
  }, [data]);
  const pagedMovements = useLoadMoreList(data?.movements || [], {
    initialCount: 12,
    step: 12,
    resetDeps: [data?.movements.length || 0],
  });
  const modalMovements = useMemo(() => {
    if (!data?.movements.length || !selectedMonthData) return [];

    const prefix = parseMonthLabelToInputVal(selectedMonthData.month);
    const filteredMovements = (data.movements || []).filter((movement) => movement.created_at.startsWith(prefix));

    return filteredMovements.filter((movement) => {
      if (transactionModalType === 'in') return movement.quantity_change > 0;
      if (transactionModalType === 'out') return movement.quantity_change < 0;
      return true;
    });
  }, [data?.movements, selectedMonthData, transactionModalType]);
  const pagedModalMovements = useLoadMoreList(modalMovements, {
    initialCount: 12,
    step: 12,
    resetDeps: [modalMovements.length, selectedMonthData?.month || '', transactionModalType || ''],
  });

  const maxChartVal = useMemo(() => {
    if (!data?.monthlySeries.length) return 1;
    let max = 0;
    data.monthlySeries.forEach((m) => {
      const inVal = m.received + m.cancelledBack + m.adjustedIn;
      const outVal = m.sold + m.adjustedOut;
      if (inVal > max) max = inVal;
      if (outVal > max) max = outVal;
    });
    return max === 0 ? 1 : max;
  }, [data?.monthlySeries]);

  const plotData = useMemo(() => {
    if (!data?.monthlySeries) return [];
    return [...data.monthlySeries].reverse().slice(-6);
  }, [data?.monthlySeries]);

  const dailyMovement = useMemo(() => {
    if (!data || !inventory) {
      return {
        opening: 0,
        incoming: 0,
        sold: 0,
        adjustedOut: 0,
        remaining: 0,
        rows: [],
      };
    }

    const rows = data.movements.filter((movement) => movement.created_at.slice(0, 10) === dailyMovementDate);
    const movementAfterDay = data.movements
      .filter((movement) => movement.created_at.slice(0, 10) > dailyMovementDate)
      .reduce((sum, movement) => sum + Number(movement.quantity_change || 0), 0);
    const remaining = Number(inventory.quantity_in_stock || 0) - movementAfterDay;
    const dayNet = rows.reduce((sum, movement) => sum + Number(movement.quantity_change || 0), 0);
    const opening = remaining - dayNet;
    const incoming = rows
      .filter((movement) => movement.quantity_change > 0)
      .reduce((sum, movement) => sum + Number(movement.quantity_change || 0), 0);
    const sold = rows
      .filter((movement) => movement.reference_type === 'bill')
      .reduce((sum, movement) => sum + Math.abs(Number(movement.quantity_change || 0)), 0);
    const adjustedOut = rows
      .filter((movement) => movement.quantity_change < 0 && movement.reference_type !== 'bill')
      .reduce((sum, movement) => sum + Math.abs(Number(movement.quantity_change || 0)), 0);

    return {
      opening,
      incoming,
      sold,
      adjustedOut,
      remaining,
      rows,
    };
  }, [dailyMovementDate, data, inventory]);

  const productArt = inventory ? getProductArt(inventory.product.type) : null;

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="h-52 rounded-[32px]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[30px]" />
        <Skeleton className="h-72 rounded-[30px]" />
        <Skeleton className="h-80 rounded-[30px]" />
      </PageShell>
    );
  }

  /* ── Error / Not found ── */
  if (error || !data || !inventory || !health) {
    return (
      <PageShell>
        <EmptyState
          icon={AlertTriangle}
          title="Stock record not found"
          description="We could not load this stock item. It may have been removed or is not available for the selected branch."
          action={
            <Button variant="outline" onClick={() => navigate('/inventory')}>
              Back to Inventory
            </Button>
          }
        />
      </PageShell>
    );
  }

  const stockUnit = 'units';
  const statCards = buildStatCards(data.summary, stockUnit);

  return (
    <PageShell>
      <PageHeader
        title={inventory.product.name}
        eyebrow={`${inventory.product.type}${inventory.product.category ? ` · ${inventory.product.category}` : ''}`}
        onBack={() => navigate('/inventory')}
        topRightAction={
          <button
            type="button"
            onClick={() => setIsEditInventoryOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Edit product prices"
          >
            <Pencil className="h-[1.1rem] w-[1.1rem]" />
          </button>
        }
        description={
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
              {inventory.product.type}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                health.badge === 'danger'
                  ? 'bg-rose-500 text-white'
                  : health.badge === 'warning'
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-emerald-400 text-emerald-950'
              }`}
            >
              {health.label}
            </span>
            {inventory.product.company ? (
              <span className="inline-flex items-center rounded-full border border-white/30 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-white">
                {inventory.product.company}
              </span>
            ) : null}
          </div>
        }
        action={
          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:flex-row mt-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold"
              fullWidth
              onClick={() => setIsAdjustOpen(true)}
              leftIcon={<Boxes className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              Adjust Stock
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-white text-sky-900 hover:bg-slate-50 font-bold"
              fullWidth
              onClick={() => navigate('/purchases/new')}
              leftIcon={<PackagePlus className="h-4 w-4 sm:h-5 sm:w-5" />}
            >
              Add Stock
            </Button>
          </div>
        }
      />

      <section
        className="relative z-10 rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_rgba(148,163,184,0.16)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                Current Stock
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-[2.75rem] font-extrabold leading-none tracking-[-0.06em] text-slate-900">
                {data.summary.currentStock}
              </span>
              <span className="pb-1.5 text-base font-bold text-slate-500">{stockUnit}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
              Alert threshold: {data.summary.lowStockThreshold ?? 0} {stockUnit}
            </div>

            {/* Pricing Information */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 border-t border-slate-100 pt-5">
              {inventory.product.type === 'medicine' && (
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-0.5">MRP</p>
                  <p className="text-sm font-extrabold text-slate-800">
                    {inventory.medicine_discount_percentage > 0 && inventory.medicine_discount_percentage < 100
                      ? formatCurrency(inventory.selling_price! / (1 - inventory.medicine_discount_percentage / 100))
                      : formatCurrency(inventory.selling_price || 0)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Selling Price</p>
                <p className="text-sm font-extrabold text-sky-600">{formatCurrency(inventory.selling_price || 0)}</p>
              </div>
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Cost Price</p>
                <p className="text-sm font-extrabold text-slate-600">{formatCurrency(inventory.cost_price || 0)}</p>
              </div>
            </div>
          </div>

          <div className={`rounded-[18px] border px-4 py-3 text-right ${health.cardClass}`}>
            <div className="flex items-center justify-end gap-1.5 text-sm font-black uppercase tracking-[0.1em]">
              {health.label}
            </div>
            <div className="mt-2 text-xs font-semibold">Latest expiry</div>
            <div className="mt-0.5 text-base font-extrabold tracking-[-0.02em]">
              {inventory.expiry_date ? formatDate(inventory.expiry_date) : '—'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Stock Value Card ────────────── */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
            <CalendarRange className="h-5 w-5 text-sky-600" />
            Daily Stock Diary
          </div>
          <Input
            type="date"
            value={dailyMovementDate}
            onChange={(event) => setDailyMovementDate(event.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Opening', value: dailyMovement.opening, tone: 'text-slate-900 bg-slate-50' },
            { label: 'In', value: dailyMovement.incoming, tone: 'text-emerald-700 bg-emerald-50' },
            { label: 'Sold', value: dailyMovement.sold, tone: 'text-rose-700 bg-rose-50' },
            { label: 'Other Out', value: dailyMovement.adjustedOut, tone: 'text-orange-700 bg-orange-50' },
            { label: 'Remaining', value: dailyMovement.remaining, tone: 'text-sky-700 bg-sky-50 col-span-2 sm:col-span-1' },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border border-slate-100 p-3 ${item.tone}`}>
              <p className="text-[10px] font-black uppercase tracking-wider opacity-70">{item.label}</p>
              <p className="mt-1 text-xl font-black tracking-tight">
                {item.value} <span className="text-[10px] font-bold">{stockUnit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {dailyMovement.rows.length ? (
            dailyMovement.rows.map((movement) => {
              const isIncoming = movement.quantity_change >= 0;
              const clickable = Boolean(movement.bill?.id || movement.purchase?.id);
              const title =
                movement.bill?.farmer_name_snapshot ||
                movement.purchase?.supplier_name ||
                movement.notes ||
                getMovementLabel(movement.reference_type, movement.quantity_change);

              return (
                <button
                  key={movement.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (movement.bill?.id) {
                      navigate(`/bills/${movement.bill.id}`, { state: { from: location.pathname } });
                    } else if (movement.purchase?.id) {
                      navigate(`/purchases/${movement.purchase.id}`, { state: { from: location.pathname } });
                    }
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left ${
                    clickable ? 'hover:bg-white' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{title}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                      {getMovementLabel(movement.reference_type, movement.quantity_change)}
                      {movement.bill?.bill_number ? ` · ${movement.bill.bill_number}` : ''}
                      {movement.purchase?.invoice_number ? ` · ${movement.purchase.invoice_number}` : ''}
                    </p>
                  </div>
                  <p className={`shrink-0 text-lg font-black ${isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncoming ? '+' : ''}
                    {movement.quantity_change}
                  </p>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              No stock moved on this day.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] bg-gradient-to-br from-slate-900 to-slate-950 p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            <CircleDollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-sky-200/70">
              Stock Value
            </div>
            <div className="mt-1 text-[1.85rem] font-extrabold tracking-[-0.05em]">
              {data.summary.estimatedStockValue !== null
                ? formatCurrency(data.summary.estimatedStockValue)
                : 'N/A'}
            </div>
            <div className="mt-1 text-sm font-medium text-slate-300/80">
              Based on selling price and current quantity
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Stats Grid (4×2) ──────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col items-center gap-2 rounded-[20px] border border-slate-200 bg-white px-3 py-4 text-center shadow-sm"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${card.tone}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <div className="text-[0.65rem] font-bold uppercase leading-tight tracking-[0.1em] text-slate-400">
              {card.label}
            </div>
            <div className="text-[0.95rem] font-extrabold tracking-[-0.03em] text-slate-900">
              {card.value}
            </div>
          </div>
        ))}
      </section>

      {/* ── Section 7: Monthly Analytics ─────────── */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
            <TrendingUp className="h-5 w-5 text-sky-600" />
            Monthly Analytics
          </div>

          {/* Month selector calendar picker */}
          <div className="relative">
            <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 hover:bg-slate-100 transition-colors cursor-pointer">
              <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-sm font-bold text-slate-700">
                {selectedMonthData ? selectedMonthData.month : 'Select Month'}
              </span>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="month"
                value={selectedMonthData ? parseMonthLabelToInputVal(selectedMonthData.month) : ''}
                onChange={handleMonthChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>
        </div>

        {selectedMonthData ? (
          <>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* IN Card */}
              <div 
                onClick={() => setTransactionModalType('in')}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 p-4 transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 group cursor-pointer"
              >
                <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-emerald-600/90">
                    This Month In
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/80 text-emerald-600 shadow-sm">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-emerald-700 relative z-10">
                  {selectedMonthData.received + selectedMonthData.cancelledBack + selectedMonthData.adjustedIn}
                </div>
                <div className="mt-1 text-xs font-medium text-emerald-600/70 relative z-10">
                  Received {selectedMonthData.received} • Adj {selectedMonthData.adjustedIn}
                </div>
              </div>

              {/* OUT Card */}
              <div 
                onClick={() => setTransactionModalType('out')}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-rose-500/10 to-rose-500/5 border border-rose-500/20 p-4 transition-all hover:shadow-lg hover:shadow-rose-500/10 hover:-translate-y-0.5 group cursor-pointer"
              >
                <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-rose-500/10 blur-xl group-hover:bg-rose-500/20 transition-all duration-500"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-rose-600/90">
                    This Month Out
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100/80 text-rose-600 shadow-sm">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-rose-700 relative z-10">
                  {selectedMonthData.sold + selectedMonthData.adjustedOut}
                </div>
                <div className="mt-1 text-xs font-medium text-rose-600/70 relative z-10">
                  Sold {selectedMonthData.sold} • Adj {selectedMonthData.adjustedOut}
                </div>
              </div>

              {/* NET Card */}
              <div 
                onClick={() => setTransactionModalType('net')}
                className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-xl transition-all hover:shadow-2xl hover:shadow-slate-900/20 hover:-translate-y-0.5 group cursor-pointer"
              >
                <div className="absolute top-0 right-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-white/5 blur-xl group-hover:bg-white/10 transition-all duration-500"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-slate-300">
                    Net Movement
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white shadow-sm border border-white/5">
                    <Package2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-extrabold tracking-[-0.04em] relative z-10">
                  {selectedMonthData.net > 0 ? '+' : ''}{selectedMonthData.net}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-400 relative z-10">
                  Overall inventory change
                </div>
              </div>
            </div>

            {/* Elegant SVG/Flex Bar Chart */}
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                <span>Monthly Trends (In vs Out)</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Stock In
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Stock Out
                  </span>
                </div>
              </div>
              
              <div className="relative h-36 flex items-end justify-center gap-6 sm:gap-8 px-4 pt-6 pb-2 border-b border-slate-100/50">
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-x-0 top-3 bottom-8 flex flex-col justify-between pointer-events-none z-0">
                  <div className="w-full border-t border-slate-100" />
                  <div className="w-full border-t border-slate-100" />
                  <div className="w-full border-t border-slate-100" />
                  <div className="w-full border-t border-slate-100" />
                </div>

                {plotData.map((m) => {
                  const inVal = m.received + m.cancelledBack + m.adjustedIn;
                  const outVal = m.sold + m.adjustedOut;
                  
                  const inHeight = Math.max(4, Math.round((inVal / maxChartVal) * 100));
                  const outHeight = Math.max(4, Math.round((outVal / maxChartVal) * 100));
                  
                  const isSelected = m.month === selectedMonthData.month;
                  
                  return (
                    <div
                      key={m.month}
                      onClick={() => {
                        const originalIdx = data.monthlySeries.findIndex((item) => item.month === m.month);
                        if (originalIdx !== -1) {
                          setSelectedMonthIndex(originalIdx);
                        }
                      }}
                      className={`relative z-10 flex flex-col items-center cursor-pointer group transition-all duration-200 w-16 ${
                        isSelected ? 'scale-105' : 'hover:scale-102 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {/* Side-by-side bars */}
                      <div className="w-full flex items-end justify-center gap-1.5 h-24 relative">
                        {/* Tooltip on hover */}
                        <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-transform bg-slate-900 text-white text-[0.65rem] font-bold py-1 px-2 rounded-md shadow-md z-20 pointer-events-none whitespace-nowrap flex gap-2">
                          <span className="text-emerald-300">+{inVal} units</span>
                          <span className="text-rose-300">-{outVal} units</span>
                        </div>
                        
                        {/* Bar In */}
                        <div 
                          style={{ height: `${inHeight}%` }} 
                          className={`w-3.5 rounded-t-[5px] transition-all duration-300 ${
                            isSelected ? 'bg-gradient-to-t from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'bg-emerald-300/80 group-hover:bg-emerald-400'
                          }`}
                        />
                        {/* Bar Out */}
                        <div 
                          style={{ height: `${outHeight}%` }} 
                          className={`w-3.5 rounded-t-[5px] transition-all duration-300 ${
                            isSelected ? 'bg-gradient-to-t from-rose-400 to-rose-500 shadow-[0_0_8px_rgba(251,113,133,0.3)]' : 'bg-rose-300/80 group-hover:bg-rose-400'
                          }`}
                        />
                      </div>
                      
                      {/* Month label */}
                      <span className={`mt-2 text-[0.62rem] font-extrabold tracking-tight transition-colors whitespace-nowrap ${
                        isSelected ? 'text-slate-900 underline decoration-sky-500 decoration-2 underline-offset-4' : 'text-slate-400 group-hover:text-slate-600'
                      }`}>
                        {m.month.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-4 text-center text-sm font-medium text-slate-400">
            No movement data available
          </div>
        )}
      </section>

      {/* ── Section 8: Lot Breakdown ─────────────── */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
            <ReceiptText className="h-5 w-5 text-sky-600" />
            Lot Breakdown
          </div>
          {data.lots.length > 0 && (
            <button type="button" className="text-sm font-bold text-sky-600 hover:text-sky-700">
              View all
            </button>
          )}
        </div>

        <div className="mt-4">
          {data.lots.length ? (
            <div className="space-y-3">
              {data.lots.slice(0, 3).map((lot) => (
                <div key={lot.id} className="rounded-[18px] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {lot.batch_number || 'Unlabelled Batch'}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Received {formatDate(lot.received_at)}
                        {lot.expiry_date ? ` · Exp ${formatDate(lot.expiry_date)}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold text-slate-900">
                        {lot.remaining_quantity} {stockUnit}
                      </div>
                      <div className="text-[0.68rem] font-semibold text-slate-400">remaining</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
              <div className="text-sm font-bold text-slate-600">No tracked lots yet</div>
              <div className="mt-1 text-xs font-medium text-slate-400">
                This stock item does not have lot-level purchase tracking available yet.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 9: Linked Records ────────────── */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
          <Link2 className="h-5 w-5 text-sky-600" />
          Linked Records
        </div>

        <div className="mt-5 space-y-5">
          {/* Recent Bills */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <ReceiptText className="h-4 w-4 text-slate-400" />
              Recent Bills
            </div>
            <div className="mt-2 space-y-2">
              {recentBills.length ? (
                recentBills.map((movement) => (
                  <button
                    key={movement.id}
                    type="button"
                    onClick={() =>
                      movement.bill &&
                      navigate(`/bills/${movement.bill.id}`, { state: { from: location.pathname } })
                    }
                    className="flex w-full items-center justify-between rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-all hover:border-slate-200 hover:bg-white"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">{movement.bill?.bill_number}</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        {movement.bill?.farmer_name_snapshot || 'Walk-in customer'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">
                        {movement.bill ? formatDate(movement.bill.bill_date) : ''}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))
              ) : (
                <p className="py-2 text-sm font-medium text-slate-400">No bill references yet.</p>
              )}
            </div>
          </div>

          {/* Recent Purchases */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <ShoppingCart className="h-4 w-4 text-slate-400" />
              Recent Purchases
            </div>
            <div className="mt-2 space-y-2">
              {recentPurchases.length ? (
                recentPurchases.map((movement) => (
                  <button
                    key={movement.id}
                    type="button"
                    onClick={() =>
                      movement.purchase &&
                      navigate(`/purchases/${movement.purchase.id}`, {
                        state: { from: location.pathname },
                      })
                    }
                    className="flex w-full items-center justify-between rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-all hover:border-slate-200 hover:bg-white"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {movement.purchase?.invoice_number || 'Purchase record'}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-500">
                        {movement.purchase?.supplier_name || 'Supplier not linked'}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))
              ) : (
                <p className="py-2 text-sm font-medium text-slate-400">No purchase references yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 10: Movement History ─────────── */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
          <CalendarRange className="h-5 w-5 text-sky-600" />
          Movement History
        </div>

        <div className="mt-4 space-y-3">
          {pagedMovements.visibleItems.length ? (
            pagedMovements.visibleItems.map((movement) => {
              const isIncoming = movement.quantity_change >= 0;
              const isBillLink = !!movement.bill?.id;
              const isPurchaseLink = !!movement.purchase?.id;
              const isClickable = isBillLink || isPurchaseLink;

              const handleClick = () => {
                if (isBillLink) {
                  navigate(`/bills/${movement.bill?.id}`, { state: { from: location.pathname } });
                } else if (isPurchaseLink) {
                  navigate(`/purchases/${movement.purchase?.id}`, { state: { from: location.pathname } });
                }
              };

              return (
                <button
                  key={movement.id}
                  type="button"
                  onClick={isClickable ? handleClick : undefined}
                  disabled={!isClickable}
                  className={`flex w-full items-center gap-3 rounded-[18px] border border-slate-100 bg-slate-50 p-4 text-left transition-all ${
                    isClickable
                      ? 'cursor-pointer hover:border-slate-200 hover:bg-white'
                      : 'cursor-default'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={isIncoming ? 'success' : 'danger'}
                        className="normal-case tracking-[0.02em]"
                      >
                        {getMovementLabel(movement.reference_type, movement.quantity_change)}
                      </Badge>
                      {movement.lot_id ? (
                        <Badge variant="neutral" className="normal-case tracking-[0.02em]">
                          Lot linked
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 truncate text-sm font-semibold text-slate-700">
                      {movement.notes || 'No note provided'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">
                      {formatDateTime(movement.created_at)}
                      {movement.bill?.bill_number ? ` · ${movement.bill.bill_number}` : ''}
                      {movement.purchase?.invoice_number ? ` · ${movement.purchase.invoice_number}` : ''}
                    </div>
                  </div>

                  <div className={`shrink-0 text-right ${isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <div className="text-lg font-extrabold tracking-[-0.03em]">
                      {isIncoming ? '+' : ''}
                      {movement.quantity_change}
                    </div>
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.1em]">{stockUnit}</div>
                  </div>
                </button>
              );
            })
          ) : (
            <EmptyState
              icon={Boxes}
              title="No stock movement recorded yet"
              description="Movement history will appear here after purchases, bills, cancellations, or manual adjustments."
              className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60"
            />
          )}
        </div>
        <ListLoadMore
          shown={pagedMovements.visibleCount}
          total={pagedMovements.totalCount}
          onLoadMore={pagedMovements.loadMore}
          label="Load more movements"
        />
      </section>

      {isAdjustOpen ? <StockAdjustmentModal item={inventory} onClose={() => setIsAdjustOpen(false)} /> : null}
      {isEditInventoryOpen && inventory ? (
        <EditInventoryModal
          isOpen={isEditInventoryOpen}
          onClose={() => setIsEditInventoryOpen(false)}
          inventoryId={inventory.id}
          productId={inventory.product.id}
          productType={inventory.product.type}
          initialData={{
            selling_price: inventory.selling_price,
            cost_price: inventory.cost_price,
            min_stock_alert: inventory.min_stock_alert,
            medicine_discount_percentage: inventory.medicine_discount_percentage,
          }}
        />
      ) : null}

      <Modal
        isOpen={!!transactionModalType}
        onClose={() => setTransactionModalType(null)}
        title={
          transactionModalType === 'in' ? 'This Month In'
          : transactionModalType === 'out' ? 'This Month Out'
          : 'Net Movement'
        }
      >
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {(() => {
            if (!pagedModalMovements.visibleItems.length) return <p className="text-sm text-slate-500 text-center py-4">No transactions found.</p>;

            return pagedModalMovements.visibleItems.map(movement => {
              const isIncoming = movement.quantity_change >= 0;
              
              let title = isIncoming ? 'Adjusted In / Returned' : 'Adjusted Out';
              if (movement.bill) {
                title = movement.bill.farmer_name_snapshot || 'Walk-in customer';
              } else if (movement.purchase) {
                title = movement.purchase.supplier_name || 'Walk-in supplier';
              }

              return (
                <div key={movement.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div>
                    <div className="font-semibold text-sm text-slate-900">
                      {title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {movement.notes || getMovementLabel(movement.reference_type, movement.quantity_change)}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-400 mt-1">
                      {formatDateTime(movement.created_at)}
                    </div>
                  </div>
                  <div className={`text-right font-bold ${isIncoming ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncoming ? '+' : ''}{movement.quantity_change}
                  </div>
                </div>
              );
            });
          })()}
          <ListLoadMore
            shown={pagedModalMovements.visibleCount}
            total={pagedModalMovements.totalCount}
            onLoadMore={pagedModalMovements.loadMore}
            label="Load more transactions"
          />
        </div>
      </Modal>
    </PageShell>
  );
};

export default InventoryDetailPage;

