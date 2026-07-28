import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, MinusCircle, IndianRupee,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  AlertTriangle, Download, Search, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { formatCurrency, cn } from '@/lib/utils';
import {
  useProfitReportData, usePeriodNetProfit,
  SortBy, SortDir, PAGE_SIZE,
} from '../hooks/useProfitReportData';
import {
  CartesianGrid, Line, LineChart as RechartsLineChart,
  BarChart, Bar, Cell,
  PieChart, Pie, Sector,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date();
const toISO = (d: Date) => d.toISOString().split('T')[0];

const PRESETS = [
  { label: 'Today',      start: () => toISO(today()),                       end: () => toISO(today()) },
  { label: 'Yesterday',  start: () => toISO(subDays(today(), 1)),            end: () => toISO(subDays(today(), 1)) },
  { label: 'This Week',  start: () => toISO(startOfWeek(today(), { weekStartsOn: 1 })), end: () => toISO(endOfWeek(today(), { weekStartsOn: 1 })) },
  { label: 'This Month', start: () => toISO(startOfMonth(today())),          end: () => toISO(endOfMonth(today())) },
  { label: 'Last Month', start: () => toISO(startOfMonth(subMonths(today(), 1))), end: () => toISO(endOfMonth(subMonths(today(), 1))) },
];

const SORT_COLUMNS: { key: SortBy; label: string }[] = [
  { key: 'profit',   label: 'Profit' },
  { key: 'revenue',  label: 'Revenue' },
  { key: 'quantity', label: 'Qty' },
  { key: 'margin',   label: 'Margin %' },
];

const BAR_COLORS = ['#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={cn('animate-pulse rounded-2xl bg-slate-100', className)} />
);

// ─── Sort Header Cell ─────────────────────────────────────────────────────────
const SortTh = ({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortBy; current: SortBy; dir: SortDir;
  onSort: (k: SortBy) => void;
}) => {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none px-4 py-3 text-right whitespace-nowrap group"
    >
      <span className={cn(
        'inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors',
        active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-700'
      )}>
        {label}
        {active
          ? (dir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
          : <ChevronDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
const exportCSV = (items: any[], startDate: string, endDate: string) => {
  const headers = ['Product', 'Bill #', 'Qty', 'Sale Price', 'Cost Price', 'Revenue', 'Profit', 'Margin %'];
  const rows = items.map(i => [
    `"${i.product_name}"`,
    i.bill_number || '',
    i.quantity,
    i.unit_price,
    i.cost_price,
    i.revenue,
    i.profit,
    i.revenue > 0 ? ((i.profit / i.revenue) * 100).toFixed(1) + '%' : '0%',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profit_report_${startDate}_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export const ProfitReportPage: React.FC = () => {
  const navigate = useNavigate();

  // Date range — default: this month
  const [startDate, setStartDate] = useState(() => toISO(startOfMonth(today())));
  const [endDate, setEndDate] = useState(() => toISO(today()));
  const [activePreset, setActivePreset] = useState('This Month');

  // Table controls
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('profit');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const handleDateChange = useCallback((s: string, e: string, preset?: string) => {
    setStartDate(s); setEndDate(e);
    setPage(1); setSearch(''); setSearchInput('');
    setActivePreset(preset || '');
  }, []);

  const handleSort = useCallback((key: SortBy) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
    setPage(1);
  }, [sortBy]);

  const handleSearch = useCallback((val: string) => {
    setSearch(val); setPage(1);
  }, []);

  // Previous period for comparison
  const prevEnd = useMemo(() => {
    const s = new Date(startDate);
    return toISO(subDays(s, 1));
  }, [startDate]);
  const prevStart = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = e.getTime() - s.getTime();
    return toISO(new Date(s.getTime() - diff - 86400000));
  }, [startDate, endDate]);

  const { data, isLoading, isFetching } = useProfitReportData(startDate, endDate, page, sortBy, sortDir, search);
  const { data: prevProfit } = usePeriodNetProfit(prevStart, prevEnd);

  const totalPages = data?.totalPages ?? 1;

  // Comparison badge
  const comparisonBadge = useMemo(() => {
    if (prevProfit === undefined || !data) return null;
    const curr = data.netProfit;
    if (prevProfit === 0 && curr === 0) return null;
    if (prevProfit === 0) return { label: 'New period', up: true };
    const pct = ((curr - prevProfit) / Math.abs(prevProfit)) * 100;
    return { label: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs prev`, up: pct >= 0 };
  }, [data, prevProfit]);

  // Chart data
  const lineChartData = useMemo(() =>
    (data?.dailyProfits ?? []).map(dp => ({
      label: format(parseISO(dp.date), 'dd MMM'),
      value: Number(dp.profit),
    })), [data]);

  const top5Data = useMemo(() =>
    (data?.top5Products ?? []).map(p => ({
      name: p.product_name.length > 18 ? p.product_name.slice(0, 16) + '…' : p.product_name,
      profit: Number(p.profit),
    })), [data]);

  const donutData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Gross Profit', value: Math.max(0, data.grossProfit), fill: '#059669' },
      { name: 'Expenses',     value: Math.max(0, data.expenses),    fill: '#ef4444' },
      { name: 'Returns',      value: Math.max(0, data.returns),     fill: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [data]);

  const maxProfit = useMemo(() =>
    Math.max(...(data?.items ?? []).map(i => Math.abs(i.profit)), 1),
  [data]);

  return (
    <PageShell className="space-y-5 pb-24 animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Profit Report"
        description="Detailed breakdown of profit for the selected period"
        onBack={() => navigate('/dashboard')}
        action={
          <button
            type="button"
            onClick={() => data && exportCSV(data.items, startDate, endDate)}
            disabled={!data || data.items.length === 0}
            className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 text-sm font-bold text-white transition-all disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      {/* ── Date Presets + Range Picker ────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-3">
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleDateChange(preset.start(), preset.end(), preset.label)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                activePreset === preset.label
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Custom range */}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => handleDateChange(s, e)}
        />
      </div>

      {/* ── Warning Banner ─────────────────────────────────────────────── */}
      {!isLoading && (data?.missingCostCount ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <p>
            <span className="font-bold">{data!.missingCostCount} item{data!.missingCostCount > 1 ? 's' : ''}</span> have no cost price recorded — profit figures may be understated. Add cost prices in Inventory to fix this.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-3">
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : data ? (
        <>
          {/* ── KPI Row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { label: 'Net Profit',    value: data.netProfit,    color: data.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600', bg: data.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200' },
              { label: 'Gross Profit',  value: data.grossProfit,  color: 'text-slate-900', bg: 'bg-white border-slate-200' },
              { label: 'Total Revenue', value: data.totalRevenue, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
              { label: 'Expenses',      value: -data.expenses,    color: 'text-rose-600', bg: 'bg-white border-slate-200' },
              { label: 'Returns',       value: -data.returns,     color: 'text-orange-500', bg: 'bg-white border-slate-200' },
            ].map(kpi => (
              <div key={kpi.label} className={cn('rounded-2xl border p-4 shadow-sm', kpi.bg)}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <p className={cn('mt-1 text-lg font-black tabular-nums', kpi.color)}>
                  {kpi.value < 0 ? '−' : ''}{formatCurrency(Math.abs(kpi.value))}
                </p>
                {kpi.label === 'Net Profit' && comparisonBadge && (
                  <span className={cn(
                    'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold',
                    comparisonBadge.up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                  )}>
                    {comparisonBadge.label}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Charts Row ───────────────────────────────────────────────── */}
          <div className="grid gap-5 xl:grid-cols-3">
            {/* Daily Profit Line Graph */}
            <div className="xl:col-span-2 rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trend</p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">Daily Profit</h3>
              {lineChartData.length > 0 ? (
                <div className="mt-4 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={lineChartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => formatCurrency(Number(v)).replace('.00', '')} width={78} />
                      <Tooltip formatter={v => [formatCurrency(Number(v)), 'Profit']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 14, fontSize: 12 }} />
                      <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} dot={{ r: 3.5, fill: '#fff', stroke: '#059669', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#059669', stroke: '#fff', strokeWidth: 2 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-center h-52 text-slate-300">
                  <p className="text-sm font-semibold">No data for this period</p>
                </div>
              )}
            </div>

            {/* Donut Chart */}
            <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Breakdown</p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">Profit vs Costs</h3>
              {donutData.length > 0 ? (
                <div className="flex-1 mt-2">
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {donutData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                          <span className="font-semibold text-slate-600">{d.name}</span>
                        </span>
                        <span className="font-bold text-slate-800">{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-300">
                  <p className="text-sm font-semibold">No data</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Top 5 Bar Chart ───────────────────────────────────────────── */}
          {top5Data.length > 0 && (
            <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rankings</p>
              <h3 className="mt-0.5 text-base font-black text-slate-900">Top 5 Most Profitable Products</h3>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top5Data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => formatCurrency(Number(v)).replace('.00', '')} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} width={130} />
                    <Tooltip formatter={v => [formatCurrency(Number(v)), 'Profit']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 14, fontSize: 12 }} />
                    <Bar dataKey="profit" radius={[0, 8, 8, 0]}>
                      {top5Data.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Items Table ───────────────────────────────────────────────── */}
          <div className={cn(
            'rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-150',
            isFetching && !isLoading ? 'opacity-60' : 'opacity-100'
          )}>
            {/* Table Toolbar */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-500" />
                  Item Profit Breakdown
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{data.totalItems} items</p>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(searchInput)}
                  placeholder="Search product…"
                  className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400"
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); handleSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isFetching && !isLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent shrink-0" />
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      Product / Bill
                    </th>
                    <SortTh label="Qty"       sortKey="quantity" current={sortBy} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right whitespace-nowrap">Sale Price</th>
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-right whitespace-nowrap">Cost Price</th>
                    <SortTh label="Revenue"   sortKey="revenue"  current={sortBy} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Profit"    sortKey="profit"   current={sortBy} dir={sortDir} onSort={handleSort} />
                    <SortTh label="Margin %"  sortKey="margin"   current={sortBy} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items.length > 0 ? data.items.map((item, idx) => {
                    const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
                    const contribution = Math.abs(item.profit) / maxProfit;
                    return (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 max-w-[200px] truncate">{item.product_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">#{item.bill_number}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {item.cost_price > 0
                            ? <span className="text-slate-700">{formatCurrency(item.cost_price)}</span>
                            : <span className="text-[10px] font-bold text-rose-400 bg-rose-50 px-2 py-0.5 rounded-full">Missing</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-sky-700">{formatCurrency(item.revenue)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={cn(
                            'inline-flex items-center gap-1 font-bold',
                            item.profit > 0 ? 'text-emerald-600' : item.profit < 0 ? 'text-rose-600' : 'text-slate-400'
                          )}>
                            {item.profit > 0 ? <TrendingUp className="h-3 w-3" /> : item.profit < 0 ? <TrendingDown className="h-3 w-3" /> : <MinusCircle className="h-3 w-3" />}
                            {formatCurrency(Math.abs(item.profit))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded-full',
                            margin >= 30 ? 'bg-emerald-100 text-emerald-700' : margin >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600'
                          )}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        {/* Contribution bar */}
                        <td className="px-4 py-3 min-w-[100px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', item.profit >= 0 ? 'bg-emerald-400' : 'bg-rose-400')}
                                style={{ width: `${Math.round(contribution * 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold w-8 text-right">{Math.round(contribution * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center">
                        <Search className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-slate-500">No items found</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting your search or date range.</p>
                      </td>
                    </tr>
                  )}
                </tbody>

                {data.items.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-900 text-sm">
                    <tr>
                      <td className="px-4 py-3" colSpan={4}>Page Totals</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sky-700">
                        {formatCurrency(data.items.reduce((s, i) => s + i.revenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                        {formatCurrency(data.items.reduce((s, i) => s + i.profit, 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400 text-xs font-semibold">
                        {data.totalRevenue > 0 ? ((data.grossProfit / data.totalRevenue) * 100).toFixed(1) + '% avg' : '—'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Page <span className="font-bold text-slate-800">{page}</span> / <span className="font-bold text-slate-800">{totalPages}</span>
                  <span className="ml-2 text-slate-400">· {data.totalItems} items · {PAGE_SIZE}/page</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isFetching}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | 'e')[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('e');
                        acc.push(p); return acc;
                      }, [])
                      .map((p, i) => p === 'e'
                        ? <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
                        : <button key={p} type="button" onClick={() => setPage(p as number)} disabled={isFetching}
                            className={cn('h-7 w-7 rounded-lg text-xs font-bold transition-all',
                              page === p ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            )}>{p}</button>
                      )}
                  </div>
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || isFetching}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </PageShell>
  );
};

export default ProfitReportPage;
