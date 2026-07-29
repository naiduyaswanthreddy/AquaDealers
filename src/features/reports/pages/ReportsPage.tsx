import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import {
  BookOpen, Download, FileSpreadsheet, LineChart, ShoppingCart,
  Package, CreditCard, Users, PieChart, FileText, Award,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowLeft,
  Activity, IndianRupee, ShieldCheck,
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useMonthlyFinancePack } from '../hooks/useReports';
import { useBusinessSnapshot } from '../hooks/useBusinessSnapshot';
import { useSettlementSummary } from '../hooks/useSettlementSummary';
import { Modal } from '@/components/ui';
import { exportRowsToCsv, exportRowsToExcelCompatibleHtml, exportSummaryPdf } from '../utils/reportExport';
import { ReportSummaryItem, ReportTableModel } from '../types';
import { formatCurrency, cn } from '@/lib/utils';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  CartesianGrid, Line, LineChart as RechartsLineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
  AreaChart, Area,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = () => new Date();
const toISO = (d: Date) => d.toISOString().split('T')[0];

const MONTH_PRESETS = [
  { label: 'This Month', getRange: () => ({ start: toISO(startOfMonth(today())), end: toISO(endOfMonth(today())) }) },
  { label: 'Last Month', getRange: () => ({ start: toISO(startOfMonth(subMonths(today(), 1))), end: toISO(endOfMonth(subMonths(today(), 1))) }) },
  { label: 'Last 3 Months', getRange: () => ({ start: toISO(startOfMonth(subMonths(today(), 2))), end: toISO(endOfMonth(today())) }) },
  { label: 'Last 6 Months', getRange: () => ({ start: toISO(startOfMonth(subMonths(today(), 5))), end: toISO(endOfMonth(today())) }) },
];

type SummaryRow = { section: string; metric: string; value: string };

const parseSummaryCurrency = (value: string) => {
  const normalized = value.replace(/[^\d.-]/g, '');
  return Number(normalized) || 0;
};

const getNetProfitValue = (summaries?: ReportSummaryItem[]) =>
  parseSummaryCurrency(summaries?.find((item) => item.label === 'Net Profit')?.value || '0');

// ─── Sparkline Mini Chart ─────────────────────────────────────────────────────
function MiniSparkline({ curr, prev, positive }: { curr: number; prev: number; positive: boolean }) {
  const data = [{ v: prev }, { v: (prev + curr) / 2 }, { v: curr }];
  const color = positive ? '#059669' : '#e11d48';
  return (
    <div className="h-10 w-20 opacity-70">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${positive}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg-${positive})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Trend Badge ─────────────────────────────────────────────────────────────
function TrendBadge({ current, previous }: { current: number; previous?: number }) {
  if (!previous || (previous === 0 && current === 0)) return null;
  const pct = previous === 0 ? 100 : ((current - previous) / Math.abs(previous)) * 100;
  const up = pct >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black',
      up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
    )}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ─── Health Score ─────────────────────────────────────────────────────────────
function computeHealthScore(
  netProfit: number, totalSales: number,
  outstandingDues: number, totalCollections: number
): { score: number; label: string; color: string; emoji: string } {
  let score = 50;
  // Profit margin (max 30pts)
  if (totalSales > 0) {
    const margin = netProfit / totalSales;
    if (margin >= 0.2) score += 30;
    else if (margin >= 0.1) score += 20;
    else if (margin >= 0) score += 10;
    else score -= 15;
  }
  // Dues recovery (max 20pts)
  const totalRevenue = totalSales + outstandingDues;
  if (totalRevenue > 0) {
    const recovery = totalCollections / totalRevenue;
    if (recovery >= 0.9) score += 20;
    else if (recovery >= 0.7) score += 12;
    else if (recovery >= 0.5) score += 5;
  }
  score = Math.min(100, Math.max(0, score));
  if (score >= 75) return { score, label: 'Excellent', color: 'text-emerald-600', emoji: '🟢' };
  if (score >= 55) return { score, label: 'Good', color: 'text-lime-600', emoji: '🟡' };
  if (score >= 35) return { score, label: 'Fair', color: 'text-amber-600', emoji: '🟠' };
  return { score, label: 'Needs Attention', color: 'text-rose-600', emoji: '🔴' };
}

// ─── PnL Analytics ───────────────────────────────────────────────────────────
function ProfitLossAnalytics({ summaries, previousSummaries }: { summaries: ReportSummaryItem[]; previousSummaries?: ReportSummaryItem[] }) {
  const chartData = useMemo(() => [
    { label: 'Previous', value: getNetProfitValue(previousSummaries) },
    { label: 'Current', value: getNetProfitValue(summaries) },
  ], [previousSummaries, summaries]);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-slate-500">Profit Line Graph</p>
      <h2 className="mt-1 text-xl font-black text-slate-900">Net profit trend</h2>
      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatCurrency(Number(value)).replace('.00', '')} width={86} />
            <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Net Profit']} contentStyle={{ border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)' }} />
            <Line type="monotone" dataKey="value" stroke="#059669" strokeWidth={3} dot={{ r: 5, fill: '#ffffff', stroke: '#059669', strokeWidth: 3 }} activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 3 }} />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ─── Report Section (detail view) ─────────────────────────────────────────────
function ReportSection<T extends Record<string, any>>({ table, note }: { table: ReportTableModel<T>; note?: string }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const filterKeys = [
    'customerName', 'itemService', 'medicineName', 'vendor', 'category',
    'paymentMode', 'paymentStatus', 'branch', 'source', 'status', 'agingBucket',
  ].filter((key) => table.columns.some((column) => column.key === key));
  const filteredRows = useMemo(() => table.rows.filter((row) => {
    const matchesSearch = !search.trim() || Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(search.trim().toLowerCase()));
    return matchesSearch && filterKeys.every((key) => !filters[key] || String(row[key] ?? '') === filters[key]);
  }), [filterKeys.join(','), filters, search, table.rows]);
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, 8);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">{table.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{table.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {table.summaries.map((summary) => (
              <span key={summary.label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                {summary.label}: {summary.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={() => exportRowsToCsv(table.exportBaseName, table.columns, filteredRows)}>CSV</Button>
          <Button variant="outline" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => exportRowsToExcelCompatibleHtml(table.exportBaseName, table.title, table.columns, filteredRows)}>Excel</Button>
          <Button leftIcon={<Download className="h-4 w-4" />} onClick={() => exportSummaryPdf(table.exportBaseName, table.title, table.description, table.summaries, note ? [note] : undefined)}>PDF</Button>
        </div>
      </div>
      {note && <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-900">{note}</div>}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-6 py-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this report" className="min-w-[12rem] flex-1" />
        {filterKeys.map((key) => {
          const values = Array.from(new Set(table.rows.map((row) => String(row[key] ?? '')).filter(Boolean))).sort();
          return values.length > 1 ? (
            <select key={key} value={filters[key] || ''} onChange={(e) => setFilters((c) => ({ ...c, [key]: e.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <option value="">All {table.columns.find((c) => c.key === key)?.label}s</option>
              {values.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : null;
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-50">
            <tr>
              {table.columns.map((column) => (
                <th key={column.key} className={cn('whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length ? visibleRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50/70">
                {table.columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td key={column.key} className={cn('whitespace-nowrap px-4 py-3 text-sm text-slate-700', column.align === 'right' && 'text-right tabular-nums font-semibold text-slate-900', column.align === 'center' && 'text-center')}>
                      {typeof value === 'number'
                        ? ((column.type === 'number' || ['qty', 'quantity', 'ageDays', 'gstRate'].includes(column.key)) ? value.toLocaleString('en-IN') : formatCurrency(value))
                        : (value ?? '—')}
                    </td>
                  );
                })}
              </tr>
            )) : (
              <tr><td colSpan={table.columns.length} className="px-4 py-8 text-center text-sm text-slate-500">No rows for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filteredRows.length > 8 && (
        <div className="flex justify-center border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-bold text-primary hover:underline">
            {showAll ? 'Show less' : `Show all ${filteredRows.length} rows`}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────
function ReportCard({
  id, title, liveValue, icon: Icon, color, bg, action, trend,
}: {
  id: string; title: string; liveValue?: string;
  icon: React.ComponentType<any>; color: string; bg: string;
  action: () => void; trend?: string;
}) {
  return (
    <div onClick={action} className="rounded-3xl border border-slate-100 bg-white p-5 flex flex-col items-center justify-center text-center hover:shadow-lg hover:-translate-y-1 hover:border-slate-200 transition-all cursor-pointer group">
      <div className={cn('rounded-2xl p-4 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3', bg)}>
        <Icon className={cn('h-7 w-7', color)} />
      </div>
      <h3 className="font-bold text-slate-800 mt-3 text-[14px] leading-tight">{title}</h3>
      {liveValue && (
        <p className="mt-1 text-xs font-black text-slate-500 tabular-nums">{liveValue}</p>
      )}
      {trend && (
        <span className={cn('inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide', trend.startsWith('↑') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
          {trend}
        </span>
      )}
    </div>
  );
}

// ─── Report Group ─────────────────────────────────────────────────────────────
function ReportGroup({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<any>; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-100" />
        <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500">
          <Icon className="h-3 w-3" />
          {title}
        </span>
        <div className="h-px flex-1 bg-slate-100" />
      </div>
      {children}
    </div>
  );
}

// ─── Business Snapshot Section ──────────────────────────────────────────────
// Standalone so it has its own loading state and doesn't block the main page.
function BusinessSnapshotSection() {
  const { data: snap, isLoading, isError, refetch } = useBusinessSnapshot();

  type CardDef = {
    emoji: string;
    label: string;
    value: string;
    sub?: string;
    accent: string;       // Tailwind text color
    bg: string;           // Tailwind bg color
    border: string;       // Tailwind border color
    highlight?: boolean;  // bigger font
  };

  const cards: CardDef[] = snap ? [
    {
      emoji: '💰',
      label: 'Total Invested',
      value: formatCurrency(snap.totalInvested),
      sub: 'All purchases ever made',
      accent: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      emoji: '📦',
      label: 'Current Inventory',
      value: formatCurrency(snap.currentInventoryValue),
      sub: 'Money locked in unsold stock',
      accent: 'text-violet-700',
      bg: 'bg-violet-50',
      border: 'border-violet-100',
    },
    {
      emoji: '💵',
      label: 'Cash Available',
      value: formatCurrency(snap.cashAvailable),
      sub: 'Current cash book balance',
      accent: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      emoji: '🧾',
      label: 'Outstanding Dues',
      value: formatCurrency(snap.outstandingDues),
      sub: 'Pending customer payments',
      accent: snap.outstandingDues > 0 ? 'text-rose-700' : 'text-slate-500',
      bg: snap.outstandingDues > 0 ? 'bg-rose-50' : 'bg-slate-50',
      border: snap.outstandingDues > 0 ? 'border-rose-100' : 'border-slate-100',
    },
    {
      emoji: '📈',
      label: 'Total Sales',
      value: formatCurrency(snap.totalSales),
      sub: 'All-time revenue from bills',
      accent: 'text-sky-700',
      bg: 'bg-sky-50',
      border: 'border-sky-100',
    },
    {
      emoji: '🗒️',
      label: 'Total Expenses',
      value: formatCurrency(snap.totalExpenses),
      sub: 'All-time operational costs',
      accent: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
    },
    {
      emoji: '💹',
      label: 'Realized Profit',
      value: formatCurrency(Math.abs(snap.realizedProfit)),
      sub: snap.realizedProfit >= 0 ? 'Profit earned so far' : 'Net loss so far',
      accent: snap.realizedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700',
      bg: snap.realizedProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50',
      border: snap.realizedProfit >= 0 ? 'border-emerald-100' : 'border-rose-100',
      highlight: true,
    },
    {
      emoji: '🎯',
      label: 'Expected Profit',
      value: formatCurrency(snap.expectedProfit),
      sub: 'Profit if all stock sells',
      accent: 'text-teal-700',
      bg: 'bg-teal-50',
      border: 'border-teal-100',
    },
    {
      emoji: '🏦',
      label: 'Net Business Worth',
      value: formatCurrency(snap.netBusinessWorth),
      sub: 'Inventory + Cash + Dues',
      accent: 'text-indigo-700',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      highlight: true,
    },
    {
      emoji: '⭐',
      label: 'ROI',
      value: `${snap.roi.toFixed(1)}%`,
      sub: 'Return on total investment',
      accent: snap.roi >= 15 ? 'text-emerald-700' : snap.roi >= 5 ? 'text-amber-700' : 'text-rose-700',
      bg: snap.roi >= 15 ? 'bg-emerald-50' : snap.roi >= 5 ? 'bg-amber-50' : 'bg-rose-50',
      border: snap.roi >= 15 ? 'border-emerald-100' : snap.roi >= 5 ? 'border-amber-100' : 'border-rose-100',
      highlight: true,
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-red-50 p-8 text-center text-red-600">
        <p>Couldn&apos;t load business snapshot right now.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-xs font-bold underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!snap) return null;

  return (
    <div className="space-y-4">
      {/* 10-card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              'rounded-2xl border bg-white p-4 shadow-sm flex flex-col gap-1 hover:shadow-md transition-shadow',
              card.border
            )}
          >
            <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl shrink-0', card.bg)}>
              {card.emoji}
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
              {card.label}
            </p>
            <p
              className={cn(
                'font-black tabular-nums leading-tight',
                card.accent,
                card.highlight ? 'text-xl' : 'text-base'
              )}
            >
              {card.value}
            </p>
            {card.sub && (
              <p className="text-[10px] text-slate-400 leading-tight">{card.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Smart Insight callout */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-white px-5 py-4 shadow-sm">
        <span className="text-2xl shrink-0 mt-0.5">🧠</span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Today’s Insight</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">&ldquo;{snap.insight}&rdquo;</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Period state — defaults to current month
  const [activePreset, setActivePreset] = useState('This Month');
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [month, setMonth] = useState(today().getMonth() + 1);
  const [year, setYear] = useState(today().getFullYear());
  const [startDate, setStartDate] = useState(() => toISO(startOfMonth(today())));
  const [endDate, setEndDate] = useState(() => toISO(endOfMonth(today())));
  const [gstExpanded, setGstExpanded] = useState(false);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const { data: settlementSummary } = useSettlementSummary();

  // Query params
  const queryStart = isCustomRange ? startDate : month;
  const queryEnd = isCustomRange ? endDate : year;

  const prevQueryStart = useMemo(() => {
    if (!isCustomRange) return month === 1 ? 12 : month - 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = e.getTime() - s.getTime();
    return new Date(s.getTime() - diff - 86400000).toISOString().split('T')[0];
  }, [isCustomRange, month, startDate, endDate]);

  const prevQueryEnd = useMemo(() => {
    if (!isCustomRange) return month === 1 ? year - 1 : year;
    return new Date(new Date(startDate).getTime() - 86400000).toISOString().split('T')[0];
  }, [isCustomRange, month, year, startDate]);

  const { data: pack, isLoading, error } = useMonthlyFinancePack(queryStart, queryEnd);
  const { data: prevPack } = useMonthlyFinancePack(prevQueryStart, prevQueryEnd);

  const getTrend = (current?: number, previous?: number) => {
    if (current === undefined || previous === undefined) return undefined;
    if (previous === 0 && current === 0) return undefined;
    if (previous === 0) return current > 0 ? '↑ 100.0%' : '↓ 100.0%';
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    if (pct > 0) return `↑ ${Math.abs(pct).toFixed(1)}%`;
    if (pct < 0) return `↓ ${Math.abs(pct).toFixed(1)}%`;
    return undefined;
  };

  const selectedReport = useMemo(() => {
    if (!pack || !selectedReportId) return null;
    return (pack as any)[selectedReportId];
  }, [pack, selectedReportId]);

  const handleOpenReport = (id: string) => {
    if (!isCustomRange) {
      const first = new Date(year, month - 1, 1);
      const last = new Date(year, month, 0);
      setStartDate(new Date(first.getTime() - first.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
      setEndDate(new Date(last.getTime() - last.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
      setIsCustomRange(true);
    }
    setSelectedReportId(id);
  };

  const handlePreset = (preset: typeof MONTH_PRESETS[0]) => {
    const { start, end } = preset.getRange();
    setStartDate(start); setEndDate(end);
    setIsCustomRange(true); setActivePreset(preset.label);
    setSelectedReportId(null);
  };

  const handleCustomRange = (s: string, e: string) => {
    setStartDate(s); setEndDate(e);
    setIsCustomRange(true); setActivePreset('');
    setSelectedReportId(null);
  };

  const packSummaryRows = useMemo<SummaryRow[]>(() => {
    if (!pack) return [];
    const sections = [
      { section: pack.sales.title, items: pack.sales.summaries },
      { section: pack.purchases.title, items: pack.purchases.summaries },
      { section: pack.expenses.title, items: pack.expenses.summaries },
      { section: pack.cashBook.title, items: pack.cashBook.summaries },
      { section: pack.bankReconciliation.title, items: pack.bankReconciliation.summaries },
      { section: pack.profitAndLoss.title, items: pack.profitAndLoss.summaries },
      { section: pack.receivables.title, items: pack.receivables.summaries },
      { section: pack.payables.title, items: pack.payables.summaries },
    ];
    return sections.flatMap((s) => s.items.map((item) => ({ section: s.section, metric: item.label, value: item.value })));
  }, [pack]);

  const handlePackPdf = () => {
    if (!pack) return;
    exportSummaryPdf(pack.profitAndLoss.exportBaseName, `Monthly Report - ${pack.period.label}`, 'Finance summary pack',
      [...pack.sales.summaries, ...pack.purchases.summaries, ...pack.expenses.summaries, ...pack.cashBook.summaries, ...pack.profitAndLoss.summaries, ...pack.receivables.summaries, ...pack.payables.summaries],
      pack.bankReconciliation.note ? [pack.bankReconciliation.note] : undefined
    );
  };


  const health = useMemo(() => {
    if (!pack) return null;
    const r = pack.rawTotals;
    return computeHealthScore(r.netProfit, r.totalSales, r.outstandingDues, r.totalCollections);
  }, [pack]);

  // ─── Selected Report Detail View ──────────────────────────────────────────
  if (selectedReport) {
    const isPnL = selectedReport.title === 'Profit & Loss';
    return (
      <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
        <PageHeader
          title={selectedReport.title}
          onBack={() => setSelectedReportId(null)}
        />
        <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm w-fit">
          <DateRangeFilter startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); setIsCustomRange(true); }} />
        </div>
        {isPnL ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
              <p className="text-sm font-bold text-emerald-800">Monthly Snapshot</p>
              <h2 className="mt-2 text-4xl font-black text-emerald-700">
                {selectedReport.summaries.find((item: ReportSummaryItem) => item.label === 'Net Profit')?.value || '0'}
              </h2>
              <p className="mt-2 text-xs text-emerald-700/70">Revenue - Purchases - Expenses</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {selectedReport.summaries.map((item: ReportSummaryItem) => (
                  <div key={item.label} className="rounded-2xl border border-emerald-50 bg-white/80 px-5 py-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <ProfitLossAnalytics summaries={selectedReport.summaries} previousSummaries={prevPack?.profitAndLoss.summaries} />
          </div>
        ) : (
          <ReportSection table={selectedReport} />
        )}
      </PageShell>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !pack) {
    return <div className="rounded-2xl bg-red-50 p-8 text-center text-red-600"><p>{t('common.error')}</p></div>;
  }

  return (
    <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <PageHeader
        title={t('nav.reports', 'Reports & Analytics')}
        onBack={() => navigate('/more')}
        action={
          <button
            type="button"
            onClick={handlePackPdf}
            className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-4 py-2 text-sm font-bold text-white transition-all"
          >
            <Download className="h-4 w-4" />
            Download Report
          </button>
        }
      />

      {/* ── Period Selector ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reporting Period</p>
            <p className="mt-0.5 text-base font-black text-slate-800">{pack.period.label}</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-3 py-1">
            Branch: {pack.branchName}
          </span>
        </div>
        {/* Preset pills */}
        <div className="flex flex-wrap gap-2">
          {MONTH_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePreset(preset)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                activePreset === preset.label
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {/* Custom date range */}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onChange={handleCustomRange}
        />
      </div>

      {/* ── Business Health Score ─────────────────────────────────────────── */}
      {health && (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50">
            <ShieldCheck className={cn('h-6 w-6', health.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Business Health</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className={cn('text-lg font-black', health.color)}>{health.emoji} {health.score}/100 — {health.label}</p>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', health.score >= 75 ? 'bg-emerald-500' : health.score >= 55 ? 'bg-lime-400' : health.score >= 35 ? 'bg-amber-400' : 'bg-rose-500')} style={{ width: `${health.score}%` }} />
            </div>
          </div>
          <p className="hidden sm:block text-xs text-slate-400 max-w-[180px] text-right leading-relaxed">Based on profit margin, dues recovery & cash position</p>
        </div>
      )}

      {/* ── Business Snapshot Cards ───────────────────────────────────────── */}
      <BusinessSnapshotSection />

      {/* ── Financial Reports ──────────────────────────────────────────────── */}
      <ReportGroup title="Financial Reports" icon={IndianRupee}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          <ReportCard id="sales"     title="Sales Report"    liveValue={formatCurrency(pack.rawTotals.totalSales)}     icon={LineChart}     color="text-blue-600"    bg="bg-blue-50"    action={() => navigate('/sales-register')} trend={getTrend(pack.rawTotals.totalSales, prevPack?.rawTotals.totalSales)} />
          <ReportCard id="purchases" title="Purchase Report" liveValue={formatCurrency(pack.rawTotals.totalPurchases)} icon={ShoppingCart}  color="text-emerald-600" bg="bg-emerald-50" action={() => handleOpenReport('purchases')} trend={getTrend(pack.rawTotals.totalPurchases, prevPack?.rawTotals.totalPurchases)} />
          <ReportCard id="pnl"       title="Profit & Loss"   liveValue={formatCurrency(pack.rawTotals.netProfit)}      icon={PieChart}      color="text-teal-600"    bg="bg-teal-50"    action={() => navigate('/profit-report')} trend={getTrend(pack.rawTotals.netProfit, prevPack?.rawTotals.netProfit)} />
          <ReportCard id="cashbook"  title="Cash Book"       liveValue={parseSummaryCurrency(pack.cashBook.summaries.find((s) => s.label === 'Closing Balance')?.value || '0') > 0 ? formatCurrency(parseSummaryCurrency(pack.cashBook.summaries.find((s) => s.label === 'Closing Balance')?.value || '0')) : undefined} icon={BookOpen} color="text-amber-600" bg="bg-amber-50" action={() => navigate('/cashbook')} />
        </div>
      </ReportGroup>

      {/* ── Operational Reports ────────────────────────────────────────────── */}
      <ReportGroup title="Operational Reports" icon={Activity}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          <ReportCard id="payments" title="Payment Report"  liveValue={formatCurrency(pack.rawTotals.totalCollections)} icon={CreditCard} color="text-rose-600"   bg="bg-rose-50"   action={() => handleOpenReport('receivables')} trend={getTrend(pack.rawTotals.totalCollections, prevPack?.rawTotals.totalCollections)} />
          <ReportCard id="dues"     title="Customer Dues"  liveValue={formatCurrency(pack.rawTotals.outstandingDues)}   icon={Users}      color="text-orange-600" bg="bg-orange-50" action={() => navigate('/dues')} trend={getTrend(pack.rawTotals.outstandingDues, prevPack?.rawTotals.outstandingDues)} />
          <ReportCard id="stock"    title="Stock Report"   icon={Package} color="text-violet-600" bg="bg-violet-50" action={() => navigate('/inventory/report')} />
          <ReportCard id="products" title="Top Products"   icon={Award}   color="text-indigo-600" bg="bg-indigo-50" action={() => handleOpenReport('topProducts')} />
          <ReportCard id="settlements" title="Settlements (All Time)" liveValue={settlementSummary?.total ? formatCurrency(settlementSummary.total) : undefined} icon={IndianRupee} color="text-fuchsia-600" bg="bg-fuchsia-50" action={() => setSettlementModalOpen(true)} />
        </div>
      </ReportGroup>

      <Modal isOpen={settlementModalOpen} onClose={() => setSettlementModalOpen(false)} title="Settlement Discounts — All Time" contentClassName="max-w-lg">
        <div className="grid gap-3">
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-300">Total settlement given so far</div>
            <div className="mt-1 text-2xl font-black">{formatCurrency(settlementSummary?.total || 0)}</div>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            {!settlementSummary?.byFarmer.length ? (
              <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No settlement discounts recorded yet.</div>
            ) : (
              settlementSummary.byFarmer.map((row) => (
                <div key={row.farmerId} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <span className="text-sm font-bold text-slate-900">{row.farmerName}</span>
                  <span className="text-sm font-black text-fuchsia-700">{formatCurrency(row.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ── Tax Reports (collapsible) ──────────────────────────────────────── */}
      <ReportGroup title="Tax Reports" icon={FileText}>
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setGstExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800 text-sm">GST Return Reports</p>
                <p className="text-xs text-slate-500">GSTR-1, GSTR-2, GSTR-3B, GSTR-4, GSTR-9</p>
              </div>
            </div>
            {gstExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {gstExpanded && (
            <div className="border-t border-slate-100 p-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'gstr1', title: 'GSTR-1', description: 'Outward supplies', action: () => exportRowsToExcelCompatibleHtml(`${pack.sales.exportBaseName}_GSTR1`, 'GSTR-1', pack.sales.columns, pack.sales.rows) },
                  { id: 'gstr2', title: 'GSTR-2', description: 'Inward supplies', action: () => exportRowsToExcelCompatibleHtml(`${pack.purchases.exportBaseName}_GSTR2`, 'GSTR-2', pack.purchases.columns, pack.purchases.rows) },
                  { id: 'gstr3b', title: 'GSTR-3B', description: 'Monthly summary', action: () => navigate('/gst') },
                  { id: 'gstr4', title: 'GSTR-4', description: 'Composition scheme', action: () => exportRowsToExcelCompatibleHtml(`${pack.sales.exportBaseName}_GSTR4`, 'GSTR-4', pack.sales.columns, pack.sales.rows) },
                  { id: 'gstr9', title: 'GSTR-9', description: 'Annual return', action: () => alert('Export 12 months of GSTR-1 & GSTR-3B data.') },
                ].map((item) => (
                  <div key={item.id} onClick={item.action} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm transition-all cursor-pointer">
                    <p className="font-black text-slate-900 text-base">{item.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ReportGroup>
    </PageShell>
  );
};

export default ReportsPage;
