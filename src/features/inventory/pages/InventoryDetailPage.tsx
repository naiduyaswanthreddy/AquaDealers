import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  LayoutGrid,
  BarChart2,
  Layers,
  Clock,
  SlidersHorizontal,
  Plus,
  ArrowDownCircle,
  ArrowUpCircle
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
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'lots' | 'history'>('overview');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const [isQuickStatsPaused, setIsQuickStatsPaused] = useState(false);
  const quickStatsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = quickStatsRef.current;
    if (!container) return;

    let animationFrameId: number;
    let direction = 1;
    const scrollStep = 0.4; 

    const scrollLoop = () => {
      if (!isQuickStatsPaused && container) {
        container.scrollLeft += (scrollStep * direction);
        if (container.scrollLeft >= container.scrollWidth - container.clientWidth - 1) {
          direction = -1;
        } else if (container.scrollLeft <= 0) {
          direction = 1;
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isQuickStatsPaused]);

  const historyFilteredMovements = useMemo(() => {
    if (!data?.movements) return [];
    return data.movements.filter(m => {
      const dateStr = m.created_at.slice(0, 10);
      if (historyStartDate && dateStr < historyStartDate) return false;
      if (historyEndDate && dateStr > historyEndDate) return false;
      return true;
    });
  }, [data?.movements, historyStartDate, historyEndDate]);

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
    return historyFilteredMovements
      .filter((movement) => movement.bill?.id)
      .filter((movement) => {
        if (!movement.bill || seen.has(movement.bill.id)) return false;
        seen.add(movement.bill.id);
        return true;
      })
      .slice(0, 4);
  }, [data, historyFilteredMovements]);

  const recentPurchases = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return historyFilteredMovements
      .filter((movement) => movement.purchase?.id)
      .filter((movement) => {
        if (!movement.purchase || seen.has(movement.purchase.id)) return false;
        seen.add(movement.purchase.id);
        return true;
      })
      .slice(0, 4);
  }, [data, historyFilteredMovements]);

  const recentAdjustments = useMemo(() => {
    if (!data) return [];
    return historyFilteredMovements
      .filter((movement) => movement.reference_type === 'ADJUSTMENT' || movement.reference_type === 'INITIAL_STOCK')
      .slice(0, 4);
  }, [data, historyFilteredMovements]);

  const pagedMovements = useLoadMoreList(historyFilteredMovements, {
    initialCount: 12,
    step: 12,
    resetDeps: [historyFilteredMovements.length, historyStartDate, historyEndDate],
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
    <PageShell width="full" className="pb-8 bg-transparent">
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
          <div className="mt-3 md:mt-1 flex items-center gap-2 sm:gap-3 text-sm font-medium w-full overflow-x-auto hide-scrollbar pb-1">
            <div className="inline-flex flex-1 sm:flex-none items-center justify-between sm:justify-start gap-2 bg-white/10 px-2.5 sm:px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm whitespace-nowrap">
              <span className="text-white/70 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Selling</span>
              <span className="text-white font-bold text-sm sm:text-base">₹{inventory.selling_price?.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-white/50 capitalize">/ {inventory.product.unit}</span></span>
            </div>
            <div className="inline-flex flex-1 sm:flex-none items-center justify-between sm:justify-start gap-2 bg-white/10 px-2.5 sm:px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm whitespace-nowrap">
              <span className="text-white/70 text-[10px] sm:text-xs uppercase tracking-wider font-bold">Cost</span>
              <span className="text-white font-bold text-sm sm:text-base">₹{inventory.cost_price?.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-white/50 capitalize">/ {inventory.product.unit}</span></span>
            </div>
          </div>
        }
        action={
          <div className="grid grid-cols-2 gap-3 w-full sm:flex sm:w-auto mt-3 md:mt-0">
            <Button
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/30 font-semibold h-12 rounded-xl"
              fullWidth
              onClick={() => setIsAdjustOpen(true)}
              leftIcon={<Boxes className="h-5 w-5 opacity-80" />}
            >
              Adjust Stock
            </Button>
            <Button
              className="bg-white text-[#0052cc] hover:bg-slate-50 font-bold h-12 rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]"
              fullWidth
              onClick={() => navigate('/purchases/new')}
              leftIcon={<PackagePlus className="h-5 w-5" />}
            >
              Add Stock
            </Button>
          </div>
        }
      />

      {/* ── Current Stock Card (Always Visible) ── */}
      <div className="px-1 mt-6 relative z-10 mb-4 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100/50 p-5">
          <div className="flex items-start justify-between mb-4">
             <div>
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-2">
                   <Package2 className="w-4 h-4 text-sky-500" />
                   Current Stock
                </div>
                <div className="flex items-baseline gap-1.5">
                   <span className="text-5xl font-extrabold text-[#0070F3] tracking-tight">{data.summary.currentStock}</span>
                   <span className="text-sm font-semibold text-slate-500">{stockUnit}</span>
                </div>
                <div className="text-xs font-medium text-slate-500 mt-1">
                   Alert threshold: {data.summary.lowStockThreshold ?? 0} {stockUnit}
                </div>
             </div>
             
             {/* Expiry Box */}
             <div className="bg-[#FFF9EB] border border-[#FFE8B3] rounded-xl p-3 text-center min-w-[110px]">
                <div className="text-[#B77A00] text-[10px] font-bold uppercase flex items-center justify-center gap-1 mb-2">
                   <AlertTriangle className="w-3.5 h-3.5" />
                   {health.label}
                </div>
                <div className="text-[10px] font-medium text-slate-500 mb-0.5">Latest expiry</div>
                <div className="text-xs font-bold text-slate-800">
                   {inventory.expiry_date ? formatDate(inventory.expiry_date) : '—'}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
             <div className="flex flex-col gap-1 items-center justify-center text-center">
                <div className="flex items-center gap-1.5">
                   <CircleDollarSign className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Stock Value</span>
                </div>
                <span className="text-sm font-bold text-[#0070F3]">
                   {data.summary.estimatedStockValue !== null ? `₹${data.summary.estimatedStockValue.toLocaleString()}` : '—'}
                </span>
             </div>
             <div className="flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Unit</span>
                </div>
                <span className="text-sm font-bold text-slate-800 capitalize">{inventory.product.unit}</span>
             </div>
             <div className="flex flex-col gap-1 items-center justify-center text-center border-l border-slate-100">
                <div className="flex items-center gap-1.5">
                   <ReceiptText className="w-3.5 h-3.5 text-slate-400" />
                   <span className="text-[10px] font-medium text-slate-500">Tax (GST)</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{inventory.product.gst_rate}%</span>
             </div>
          </div>
        </div>
      </div>

      {/* ── Inline Tabs ── */}
      <div className="px-2 max-w-7xl mx-auto w-full mb-5 z-10 relative">
        <div className="flex items-center gap-6 overflow-x-auto hide-scrollbar border-b border-slate-200/60">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'analytics', label: 'Analytics' },
            { id: 'lots', label: 'Lots' },
            { id: 'history', label: 'History' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative py-3 text-sm font-bold transition-colors whitespace-nowrap outline-none ${
                  isActive ? 'text-[#0052cc]' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#0052cc] rounded-t-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="px-1 max-w-7xl mx-auto space-y-4 w-full">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Today's Movement */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CalendarRange className="w-4 h-4 text-slate-400" />
                  Today's Movement
                </div>
                <div className="relative">
                  <div className="relative h-[30px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-sm focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 cursor-pointer flex items-center min-w-[130px]">
                    <div className="absolute right-2.5 pointer-events-none text-slate-400">
                      <CalendarRange className="w-3.5 h-3.5" />
                    </div>
                    <div className="absolute left-2.5 pointer-events-none text-xs font-semibold text-slate-600">
                      {formatDate(dailyMovementDate)}
                    </div>
                    <input
                      type="date"
                      value={dailyMovementDate}
                      onChange={(e) => setDailyMovementDate(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 border border-slate-100 rounded-[14px] p-3">
                 <div className="text-center flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Opening</span>
                    <span className="text-[1.35rem] font-black text-[#0070F3] leading-none">{dailyMovement.opening}</span>
                    <span className="text-[9px] font-bold text-[#0070F3] mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">In</span>
                    <span className="text-[1.35rem] font-black text-emerald-500 leading-none">{dailyMovement.incoming}</span>
                    <span className="text-[9px] font-bold text-emerald-500 mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Out (Sold)</span>
                    <span className="text-[1.35rem] font-black text-rose-500 leading-none">{dailyMovement.sold + dailyMovement.adjustedOut}</span>
                    <span className="text-[9px] font-bold text-rose-500 mt-1">units</span>
                 </div>
                 <div className="text-center flex flex-col items-center border-l border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 mb-0.5">Remaining</span>
                    <span className="text-[1.35rem] font-black text-[#0070F3] leading-none">{dailyMovement.remaining}</span>
                    <span className="text-[9px] font-bold text-[#0070F3] mt-1">units</span>
                 </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-bold text-slate-800">Quick Stats</h3>
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400/80 uppercase tracking-widest sm:hidden">
                  <span>Swipe</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
              <div 
                ref={quickStatsRef}
                onMouseEnter={() => setIsQuickStatsPaused(true)}
                onMouseLeave={() => setIsQuickStatsPaused(false)}
                onTouchStart={() => setIsQuickStatsPaused(true)}
                onTouchEnd={() => setIsQuickStatsPaused(false)}
                className="flex gap-3 overflow-x-auto pb-3 px-1 hide-scrollbar"
              >
                {/* 1. Sold This Month */}
                <div className="flex-none w-28 bg-emerald-50 border border-emerald-100 rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <TrendingUp className="w-5 h-5 text-emerald-600 mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Sold This Month</span>
                   <div className="flex items-baseline gap-1 mt-auto">
                     <span className="text-xl font-black text-emerald-600 leading-none">{selectedMonthData ? selectedMonthData.sold : 0}</span>
                   </div>
                   <span className="text-[9px] font-bold text-emerald-600 mt-1 leading-tight">units</span>
                </div>
                {/* 2. Profit This Month */}
                <div className="flex-none w-28 bg-[#F4F7FB] border border-[#E5EDF6] rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[11px] mb-2">₹</div>
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Profit This Mth</span>
                   <span className="text-sm font-black text-blue-600 leading-none mt-auto">
                     ₹{(((inventory.selling_price || 0) - (inventory.cost_price || 0)) * (selectedMonthData ? selectedMonthData.sold : 0)).toLocaleString()}
                   </span>
                </div>
                {/* 3. Total Received */}
                <div className="flex-none w-28 bg-[#FFF6EE] border border-[#FFE8D6] rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <TrendingDown className="w-5 h-5 text-[#E36B15] mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Total Received</span>
                   <span className="text-xl font-black text-[#E36B15] leading-none mt-auto">{data.summary.totalReceived}</span>
                   <span className="text-[9px] font-bold text-[#E36B15] mt-1 leading-tight">units</span>
                </div>
                {/* 4. Total Sold */}
                <div className="flex-none w-28 bg-rose-50 border border-rose-100 rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <TrendingUp className="w-5 h-5 text-rose-600 mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Total Sold</span>
                   <span className="text-xl font-black text-rose-600 leading-none mt-auto">{data.summary.totalIssued}</span>
                   <span className="text-[9px] font-bold text-rose-600 mt-1 leading-tight">units</span>
                </div>
                {/* 5. Available Lots */}
                <div className="flex-none w-28 bg-teal-50 border border-teal-100 rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <Layers className="w-5 h-5 text-teal-600 mb-2" />
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Available Lots</span>
                   <span className="text-xl font-black text-teal-600 leading-none mt-auto">{data.summary.availableLots}</span>
                </div>
                {/* 6. Stock Value */}
                <div className="flex-none w-28 bg-[#F9F5FF] border border-[#F3EBFF] rounded-[18px] p-3.5 text-center flex flex-col items-center justify-center shadow-sm">
                   <div className="w-6 h-6 rounded-full bg-[#EADDFF] text-[#6B21A8] flex items-center justify-center font-bold text-[11px] mb-2">₹</div>
                   <span className="text-[10px] font-medium text-slate-500 mb-1 leading-tight">Stock Value</span>
                   <span className="text-sm font-black text-[#6B21A8] leading-none mt-auto">
                     {data.summary.estimatedStockValue !== null ? `₹${data.summary.estimatedStockValue.toLocaleString()}` : '—'}
                   </span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div>
               <div className="flex items-center justify-between mb-3 px-1">
                 <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
                 <button onClick={() => setActiveTab('history')} className="text-[11px] font-bold text-[#0070F3] uppercase tracking-wider">View All</button>
               </div>
               <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2">
                 {data.movements.slice(0, 5).map((movement, idx) => {
                   const isIncoming = movement.quantity_change >= 0;
                   const title = movement.reference_type === 'bill' ? 'Sale' : 
                                 movement.reference_type === 'purchase' ? 'Purchase' : 
                                 movement.reference_type === 'manual_adjustment' ? 'Manual Adjustment' :
                                 getMovementLabel(movement.reference_type, movement.quantity_change);
                   
                   const subtitle = movement.bill?.bill_number ? `Bill ${movement.bill.bill_number}` :
                                    movement.purchase?.invoice_number ? `Purchase record` :
                                    movement.notes || (movement.quantity_change < 0 ? 'Stock reduced' : 'Stock increased');
                   
                   return (
                     <div key={movement.id} className={`flex items-center justify-between p-3 ${idx !== 0 ? 'border-t border-slate-50' : ''}`}>
                       <div className="flex items-center gap-3">
                         <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                           movement.reference_type === 'manual_adjustment' ? 'bg-orange-50 text-orange-500' :
                           isIncoming ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'
                         }`}>
                           {movement.reference_type === 'manual_adjustment' ? (
                             <SlidersHorizontal className="w-4 h-4" />
                           ) : isIncoming ? (
                             <ArrowUpCircle className="w-5 h-5" />
                           ) : (
                             <ArrowDownCircle className="w-5 h-5" />
                           )}
                         </div>
                         <div>
                           <div className="text-sm font-bold text-slate-800">{title}</div>
                           <div className="text-[10px] font-medium text-slate-500">{subtitle}</div>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className={`text-sm font-black ${isIncoming ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {isIncoming ? '+' : ''}{movement.quantity_change} units
                         </div>
                         <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                           {formatDateTime(movement.created_at)}
                         </div>
                       </div>
                     </div>
                   );
                 })}
                 {data.movements.length === 0 && (
                   <div className="p-6 text-center text-sm font-medium text-slate-400">No recent activity</div>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* Other Tabs content ... */}
        {activeTab === 'analytics' && (
          <div className="py-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900">
                  <TrendingUp className="h-5 w-5 text-sky-600" />
                  Monthly Analytics
                </div>

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
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div 
                      onClick={() => setTransactionModalType('in')}
                      className="relative overflow-hidden rounded-[20px] bg-emerald-50 border border-emerald-100 p-4 transition-all hover:-translate-y-0.5 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-emerald-600">
                          This Month In
                        </div>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-emerald-700">
                        {selectedMonthData.received + selectedMonthData.cancelledBack + selectedMonthData.adjustedIn}
                      </div>
                      <div className="mt-1 text-xs font-medium text-emerald-600/70">
                        Received {selectedMonthData.received} • Adj {selectedMonthData.adjustedIn}
                      </div>
                    </div>

                    <div 
                      onClick={() => setTransactionModalType('out')}
                      className="relative overflow-hidden rounded-[20px] bg-rose-50 border border-rose-100 p-4 transition-all hover:-translate-y-0.5 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-rose-600">
                          This Month Out
                        </div>
                        <TrendingDown className="h-4 w-4 text-rose-500" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-rose-700">
                        {selectedMonthData.sold + selectedMonthData.adjustedOut}
                      </div>
                      <div className="mt-1 text-xs font-medium text-rose-600/70">
                        Sold {selectedMonthData.sold} • Adj {selectedMonthData.adjustedOut}
                      </div>
                    </div>

                    <div 
                      onClick={() => setTransactionModalType('net')}
                      className="relative overflow-hidden rounded-[20px] bg-sky-50 border border-sky-100 p-4 transition-all hover:-translate-y-0.5 group cursor-pointer"
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-sky-600">
                          Net Movement
                        </div>
                        <Layers className="h-4 w-4 text-sky-500" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-sky-700">
                        {(selectedMonthData.received + selectedMonthData.cancelledBack + selectedMonthData.adjustedIn) - (selectedMonthData.sold + selectedMonthData.adjustedOut)}
                      </div>
                      <div className="mt-1 text-xs font-medium text-sky-600/70">
                        Total In - Total Out
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                      <span>Monthly Trends</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" /> In
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-400" /> Out
                        </span>
                      </div>
                    </div>
                    
                    <div className="relative h-36 flex items-end justify-center gap-6 px-4 pt-6 pb-2 border-b border-slate-100/50">
                      <div className="absolute inset-x-0 top-3 bottom-8 flex flex-col justify-between pointer-events-none z-0">
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
                          <div key={m.month} className="relative z-10 flex flex-col items-center w-12 cursor-pointer group" onClick={() => handleMonthChange({target:{value:parseMonthLabelToInputVal(m.month)}} as any)}>
                            <div className="w-full flex items-end justify-center gap-1 h-24">
                              <div style={{ height: `${inHeight}%` }} className={`w-3 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-emerald-500' : 'bg-emerald-200 group-hover:bg-emerald-300'}`} />
                              <div style={{ height: `${outHeight}%` }} className={`w-3 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-rose-500' : 'bg-rose-200 group-hover:bg-rose-300'}`} />
                            </div>
                            <span className={`mt-2 text-[10px] font-bold ${isSelected ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
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
                  No data available
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'lots' && (
          <div className="py-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900 mb-4">
                <ReceiptText className="h-5 w-5 text-sky-600" />
                Lot Breakdown
              </div>
              {data.lots.length ? (
                <div className="space-y-3">
                  {data.lots.map((lot) => (
                    <div key={lot.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
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
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
                  <div className="text-sm font-bold text-slate-600">No tracked lots yet</div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="py-4 space-y-4">
            <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800 tracking-tight">
                <CalendarRange className="h-5 w-5 text-sky-500" /> Filter History
              </div>
              <div className="flex flex-row items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                <div className="flex flex-col gap-1.5 flex-1 sm:w-[150px]">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">From</span>
                  <div className="relative h-11 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                      <CalendarRange className="w-4 h-4" />
                    </div>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="absolute inset-0 w-full h-full pl-9 pr-3 bg-transparent text-[13px] sm:text-sm font-extrabold text-slate-800 outline-none appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-1 sm:w-[150px]">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest pl-1">To</span>
                  <div className="relative h-11 bg-white border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 transition-all">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                      <CalendarRange className="w-4 h-4" />
                    </div>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="absolute inset-0 w-full h-full pl-9 pr-3 bg-transparent text-[13px] sm:text-sm font-extrabold text-slate-800 outline-none appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <>
                <div className="w-full rounded-[14px] border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 uppercase tracking-wider px-5 py-4 border-b border-slate-100 bg-[#F4F7FB]/50">
                    <ReceiptText className="h-4.5 w-4.5 text-slate-400" /> Recent Bills
                  </div>
                  <div className="w-full overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Customer</th>
                          <th className="px-4 py-2.5 font-semibold">Bill No.</th>
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                          <th className="px-4 py-2.5 font-semibold text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentBills.length ? recentBills.map(m => (
                          <tr key={m.id} onClick={() => m.bill && navigate(`/bills/${m.bill.id}`)} className="group hover:bg-sky-50 transition-colors cursor-pointer">
                            <td className="px-4 py-3 font-bold text-slate-800 group-hover:text-sky-900">{m.bill?.farmer_name_snapshot || 'Unknown Customer'}</td>
                            <td className="px-4 py-3">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-semibold">{m.bill?.bill_number}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-semibold">{formatDate(m.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              <ChevronRight className="inline-block h-4 w-4 text-slate-300 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-sm font-medium text-slate-400 italic">No recent bills found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                


                <div className="w-full rounded-[14px] border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 uppercase tracking-wider px-5 py-4 border-b border-slate-100 bg-[#F4F7FB]/50">
                    <ShoppingCart className="h-4.5 w-4.5 text-slate-400" /> Recent Purchases
                  </div>
                  <div className="w-full overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Supplier</th>
                          <th className="px-4 py-2.5 font-semibold">Invoice No.</th>
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                          <th className="px-4 py-2.5 font-semibold text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentPurchases.length ? recentPurchases.map(m => (
                          <tr key={m.id} onClick={() => m.purchase && navigate(`/purchases/${m.purchase.id}`)} className="group hover:bg-emerald-50 transition-colors cursor-pointer">
                            <td className="px-4 py-3 font-bold text-slate-800 group-hover:text-emerald-900">{m.purchase?.supplier_name || 'Unknown Supplier'}</td>
                            <td className="px-4 py-3">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-semibold">{m.purchase?.invoice_number || 'N/A'}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-semibold">{formatDate(m.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              <ChevronRight className="inline-block h-4 w-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-sm font-medium text-slate-400 italic">No recent purchases found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>



                <div className="w-full rounded-[14px] border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 uppercase tracking-wider px-5 py-4 border-b border-slate-100 bg-[#F4F7FB]/50">
                    <SlidersHorizontal className="h-4.5 w-4.5 text-slate-400" /> Recent Adjustments
                  </div>
                  <div className="w-full overflow-x-auto hide-scrollbar">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Reason / Notes</th>
                          <th className="px-4 py-2.5 font-semibold">Qty Change</th>
                          <th className="px-4 py-2.5 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentAdjustments.length ? recentAdjustments.map(m => (
                          <tr key={m.id} className="group hover:bg-amber-50 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800">{m.notes || (m.reference_type === 'INITIAL_STOCK' ? 'Initial Stock' : 'Manual Adjustment')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${m.quantity_change > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-semibold">{formatDate(m.created_at)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-sm font-medium text-slate-400 italic">No recent adjustments found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
            </>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-extrabold tracking-[-0.02em] text-slate-900 mb-4">
                <Clock className="h-5 w-5 text-sky-600" />
                Full Movement History
              </div>
              <div className="space-y-2">
                {pagedMovements.visibleItems.length > 0 ? (
                  <>
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto hide-scrollbar border border-slate-100 rounded-[14px]">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200/70 text-slate-500 font-bold text-[10px] uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-2.5 font-semibold">Type</th>
                            <th className="px-4 py-2.5 font-semibold">Date & Time</th>
                            <th className="px-4 py-2.5 font-semibold text-right">Qty Change</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pagedMovements.visibleItems.map((item) => {
                            const isIncoming = item.quantity_change > 0;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800">{getMovementLabel(item.reference_type, item.quantity_change)}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs font-semibold">{formatDateTime(item.created_at)}</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${isIncoming ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {isIncoming ? '+' : ''}{item.quantity_change}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <ListLoadMore 
                      shown={pagedMovements.visibleItems.length} 
                      total={data.movements.length} 
                      onLoadMore={pagedMovements.loadMore} 
                    />
                  </>
                ) : (
                  <div className="text-sm text-slate-400">No history available.</div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>



      {/* ── Modals ── */}
      {isAdjustOpen && (
        <StockAdjustmentModal
          item={inventory as any}
          onClose={() => setIsAdjustOpen(false)}
        />
      )}
      <EditInventoryModal
        isOpen={isEditInventoryOpen}
        onClose={() => setIsEditInventoryOpen(false)}
        inventoryId={inventory.id}
        productId={inventory.product_id}
        productType={inventory.product.type}
        initialData={{
          selling_price: inventory.selling_price,
          cost_price: inventory.cost_price,
          min_stock_alert: inventory.min_stock_alert,
          medicine_discount_percentage: inventory.medicine_discount_percentage
        }}
      />
    </PageShell>
  );
};

export default InventoryDetailPage;

