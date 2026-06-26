import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DateRangeFilter from '@/components/ui/DateRangeFilter';
import { BarChart3, BookOpen, Building2, CalendarDays, Download, FileSpreadsheet, LineChart, ShieldAlert, ShoppingCart, Wallet, ChevronRight, ArrowLeft, Package, CreditCard, Users, PieChart, FileText, Award } from 'lucide-react';
import { format } from 'date-fns';
import { useMonthlyFinancePack } from '../hooks/useReports';
import { exportRowsToCsv, exportRowsToExcelCompatibleHtml, exportSummaryPdf } from '../utils/reportExport';
import { ReportSummaryItem, ReportTableModel } from '../types';
import { formatCurrency, cn } from '@/lib/utils';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const currentDate = new Date();

function toMonthlySummaryValue(value: string | number) {
  if (typeof value === 'number') return formatCurrency(value);
  return value;
}

type SummaryRow = { section: string; metric: string; value: string };

const parseSummaryCurrency = (value: string) => {
  const normalized = value.replace(/[^\d.-]/g, '');
  return Number(normalized) || 0;
};

const getNetProfitValue = (summaries?: ReportSummaryItem[]) =>
  parseSummaryCurrency(summaries?.find((item) => item.label === 'Net Profit')?.value || '0');

function ProfitLossAnalytics({
  summaries,
  previousSummaries,
}: {
  summaries: ReportSummaryItem[];
  previousSummaries?: ReportSummaryItem[];
}) {
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
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(Number(value)).replace('.00', '')}
              width={86}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), 'Net Profit']}
              contentStyle={{
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#059669"
              strokeWidth={3}
              dot={{ r: 5, fill: '#ffffff', stroke: '#059669', strokeWidth: 3 }}
              activeDot={{ r: 7, fill: '#059669', stroke: '#ffffff', strokeWidth: 3 }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ReportSection<T extends Record<string, any>>({
  table,
  note,
}: {
  table: ReportTableModel<T>;
  note?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? table.rows : table.rows.slice(0, 8);

  const handleExportCsv = () => exportRowsToCsv(table.exportBaseName, table.columns, table.rows);
  const handleExportExcel = () => exportRowsToExcelCompatibleHtml(table.exportBaseName, table.title, table.columns, table.rows);
  const handleExportPdf = () => exportSummaryPdf(
    table.exportBaseName,
    table.title,
    table.description,
    table.summaries,
    note ? [note] : undefined
  );

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
              <span
                key={summary.label}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700"
              >
                {summary.label}: {summary.value}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExportCsv}>
            CSV
          </Button>
          <Button variant="outline" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={handleExportExcel}>
            Excel
          </Button>
          <Button leftIcon={<Download className="h-4 w-4" />} onClick={handleExportPdf}>
            PDF
          </Button>
        </div>
      </div>

      {note && (
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-900">
          {note}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="bg-slate-50">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'whitespace-nowrap border-b border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center'
                  )}
                >
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
                    <td
                      key={column.key}
                      className={cn(
                        'whitespace-nowrap px-4 py-3 text-sm text-slate-700',
                        column.align === 'right' && 'text-right tabular-nums font-semibold text-slate-900',
                        column.align === 'center' && 'text-center'
                      )}
                    >
                      {typeof value === 'number' 
                        ? ((column.type === 'number' || ['qty', 'quantity', 'ageDays', 'gstRate'].includes(column.key)) ? value.toLocaleString('en-IN') : formatCurrency(value)) 
                        : (value ?? '—')}
                    </td>
                  );
                })}
              </tr>
            )) : (
              <tr>
                <td colSpan={table.columns.length} className="px-4 py-8 text-center text-sm text-slate-500">
                  No rows for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {table.rows.length > 8 && (
        <div className="flex justify-center border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="text-sm font-bold text-primary hover:underline"
          >
            {showAll ? 'Show less' : `Show all ${table.rows.length} rows`}
          </button>
        </div>
      )}
    </section>
  );
}

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const queryStart = isCustomRange ? startDate : month;
  const queryEnd = isCustomRange ? endDate : year;

  const prevQueryStart = useMemo(() => {
    if (!isCustomRange) {
      return month === 1 ? 12 : month - 1;
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = e.getTime() - s.getTime();
    const prevS = new Date(s.getTime() - diff - 86400000);
    return prevS.toISOString().split('T')[0];
  }, [isCustomRange, month, startDate, endDate]);

  const prevQueryEnd = useMemo(() => {
    if (!isCustomRange) {
      return month === 1 ? year - 1 : year;
    }
    const s = new Date(startDate);
    const prevE = new Date(s.getTime() - 86400000);
    return prevE.toISOString().split('T')[0];
  }, [isCustomRange, month, year, startDate]);

  const { data: pack, isLoading, error } = useMonthlyFinancePack(queryStart, queryEnd);
  const { data: prevPack } = useMonthlyFinancePack(prevQueryStart, prevQueryEnd);

  const getTrend = (current?: number, previous?: number) => {
    if (current === undefined || previous === undefined) return undefined;
    if (previous === 0 && current === 0) return undefined;
    if (previous === 0) return current > 0 ? '↑ 100.0%' : '↓ 100.0%';
    const percent = ((current - previous) / Math.abs(previous)) * 100;
    const absPercent = Math.abs(percent).toFixed(1);
    if (percent > 0) return `↑ ${absPercent}%`;
    if (percent < 0) return `↓ ${absPercent}%`;
    return undefined;
  };

  const selectedReport = useMemo(() => {
    if (!pack || !selectedReportId) return null;
    return (pack as any)[selectedReportId];
  }, [pack, selectedReportId]);

  const handleOpenReport = (id: string) => {
    if (!isCustomRange) {
      const today = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      const offsetFirst = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
      const offsetLast = new Date(lastDay.getTime() - (lastDay.getTimezoneOffset() * 60000));
      
      setStartDate(offsetFirst.toISOString().split('T')[0]);
      setEndDate(offsetLast.toISOString().split('T')[0]);
      setIsCustomRange(true);
    }
    setSelectedReportId(id);
  };

  const handleCloseReport = () => {
    setSelectedReportId(null);
    setIsCustomRange(false);
  };

  const overviewCards = useMemo(() => {
    if (!pack) return [];

    const sales = pack.sales.summaries.find((item) => item.label === 'Total Sales')?.value || '0';
    const purchases = pack.purchases.summaries.find((item) => item.label === 'Total Purchase Value')?.value || '0';
    const expenses = pack.expenses.summaries.find((item) => item.label === 'Total Expenses')?.value || '0';
    const netProfit = pack.profitAndLoss.summaries.find((item) => item.label === 'Net Profit')?.value || '0';
    const cashBalance = pack.cashBook.summaries.find((item) => item.label === 'Closing Balance')?.value || '0';
    const gst = pack.gst.summaries.find((item) => item.label === 'Net GST Payable')?.value || '0';

    return [
      { label: 'Sales', value: sales, icon: LineChart, tone: 'text-emerald-700', bg: 'bg-emerald-50' },
      { label: 'Purchases', value: purchases, icon: ShoppingCart, tone: 'text-sky-700', bg: 'bg-sky-50' },
      { label: 'Expenses', value: expenses, icon: Wallet, tone: 'text-rose-700', bg: 'bg-rose-50' },
      { label: 'Cash Balance', value: cashBalance, icon: BookOpen, tone: 'text-violet-700', bg: 'bg-violet-50' },
      { label: 'Net Profit', value: netProfit, icon: BarChart3, tone: 'text-lime-700', bg: 'bg-lime-50' },
      { label: 'GST Payable', value: gst, icon: ShieldAlert, tone: 'text-amber-700', bg: 'bg-amber-50' },
    ];
  }, [pack]);

  const packSummaryRows = useMemo<SummaryRow[]>(() => {
    if (!pack) return [];

    const sections: Array<{ section: string; items: { label: string; value: string }[] }> = [
      { section: pack.sales.title, items: pack.sales.summaries },
      { section: pack.purchases.title, items: pack.purchases.summaries },
      { section: pack.expenses.title, items: pack.expenses.summaries },
      { section: pack.cashBook.title, items: pack.cashBook.summaries },
      { section: pack.bankReconciliation.title, items: pack.bankReconciliation.summaries },
      { section: pack.gst.title, items: pack.gst.summaries },
      { section: pack.profitAndLoss.title, items: pack.profitAndLoss.summaries },
      { section: pack.receivables.title, items: pack.receivables.summaries },
      { section: pack.payables.title, items: pack.payables.summaries },
    ];

    return sections.flatMap((section) =>
      section.items.map((item) => ({
        section: section.section,
        metric: item.label,
        value: item.value,
      }))
    );
  }, [pack]);

  const handlePackPdf = () => {
    if (!pack) return;
    exportSummaryPdf(
      pack.gst.exportBaseName,
      `CA Monthly Pack - ${pack.period.label}`,
      'Monthly finance pack for accountant review',
      [
        ...pack.sales.summaries,
        ...pack.purchases.summaries,
        ...pack.expenses.summaries,
        ...pack.cashBook.summaries,
        ...pack.gst.summaries,
        ...pack.profitAndLoss.summaries,
        ...pack.receivables.summaries,
        ...pack.payables.summaries,
      ],
      pack.bankReconciliation.note ? [pack.bankReconciliation.note] : undefined
    );
  };

  const handlePackCsv = () => {
    if (!pack) return;
    exportRowsToCsv(`${pack.gst.exportBaseName}_summary`, [
      { key: 'section', label: 'Section' },
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ], packSummaryRows);
  };

  const handlePackExcel = () => {
    if (!pack) return;
    exportRowsToExcelCompatibleHtml(`${pack.gst.exportBaseName}_summary`, `CA Monthly Pack - ${pack.period.label}`, [
      { key: 'section', label: 'Section' },
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value' },
    ], packSummaryRows);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="rounded-2xl bg-red-50 p-8 text-center text-red-600">
        <p>{t('common.error')}</p>
      </div>
    );
  }

  if (selectedReport) {
    const isPnL = selectedReport.title === 'Profit & Loss';

    return (
      <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleCloseReport} leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-black text-slate-900">{selectedReport.title}</h1>
          </div>
          
          <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex-shrink-0">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => {
                setStartDate(s);
                setEndDate(e);
                setIsCustomRange(true);
              }}
            />
          </div>
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

  return (
    <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
      <PageHeader
        title={t('nav.reports', 'Reports & Analytics')}
        onBack={() => navigate('/more')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handlePackCsv}
              style={{
                background: 'rgba(255, 255, 255, 0.16)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                boxShadow: '0 8px 18px rgba(10, 35, 58, 0.12)',
              }}
            >
              Summary CSV
            </Button>
            <Button
              variant="outline"
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={handlePackExcel}
              style={{
                background: 'rgba(255, 255, 255, 0.16)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                boxShadow: '0 8px 18px rgba(10, 35, 58, 0.12)',
              }}
            >
              Summary Excel
            </Button>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={handlePackPdf}>
              Monthly Pack PDF
            </Button>
          </div>
        }
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Reporting Month</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{pack.period.label}</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="month"
              value={`${year}-${String(month).padStart(2, '0')}`}
              onChange={(event) => {
                const [selectedYear, selectedMonth] = event.target.value.split('-').map(Number);
                setYear(selectedYear);
                setMonth(selectedMonth);
              }}
              className="w-full sm:w-64"
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-bold text-slate-900">Branch:</span> {pack.branchName}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-[20px] sm:rounded-3xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
            <div className="flex justify-between items-start">
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">{card.label}</p>
              <div className={cn('rounded-xl p-2 sm:p-3', card.bg)}>
                <card.icon className={cn('h-5 w-5', card.tone)} />
              </div>
            </div>
            <h3 className="mt-2 text-[1.15rem] sm:text-2xl font-black text-slate-900 leading-tight">
              {toMonthlySummaryValue(card.value)}
            </h3>
          </div>
        ))}
      </div>

      {/* Main Reports Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
        {[
          { id: 'sales', title: 'Sales Report', icon: LineChart, color: 'text-blue-600', bg: 'bg-blue-50', action: () => handleOpenReport('sales'), trend: getTrend(pack?.rawTotals.totalSales, prevPack?.rawTotals.totalSales) },
          { id: 'purchases', title: 'Purchase Report', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50', action: () => handleOpenReport('purchases'), trend: getTrend(pack?.rawTotals.totalPurchases, prevPack?.rawTotals.totalPurchases) },
          { id: 'stock', title: 'Stock Report', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50', action: () => navigate('/inventory/report') },
          { id: 'payments', title: 'Payment Report', icon: CreditCard, color: 'text-rose-600', bg: 'bg-rose-50', action: () => handleOpenReport('receivables'), trend: getTrend(pack?.rawTotals.totalCollections, prevPack?.rawTotals.totalCollections) },
          { id: 'dues', title: 'Customer Dues', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50', action: () => handleOpenReport('receivables'), trend: getTrend(pack?.rawTotals.outstandingDues, prevPack?.rawTotals.outstandingDues) },
          { id: 'pnl', title: 'Profit & Loss', icon: PieChart, color: 'text-teal-600', bg: 'bg-teal-50', action: () => handleOpenReport('profitAndLoss'), trend: getTrend(pack?.rawTotals.netProfit, prevPack?.rawTotals.netProfit) },
          { id: 'gst', title: 'GST Report', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', action: () => navigate('/gst') },
          { id: 'products', title: 'Top Products', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50', action: () => handleOpenReport('topProducts') },
        ].map((item) => (
          <div key={item.id} onClick={item.action} className="rounded-3xl border border-slate-100 bg-white p-5 flex flex-col items-center justify-center text-center hover:shadow-lg hover:-translate-y-1 hover:border-slate-200 transition-all cursor-pointer group">
            <div className={cn('rounded-2xl p-4 shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3', item.bg)}>
              <item.icon className={cn('h-8 w-8', item.color)} />
            </div>
            <h3 className="font-bold text-slate-800 mt-4 text-[15px]">{item.title}</h3>
            {item.trend && (
              <span className={cn('inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide', item.trend.startsWith('↑') ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                {item.trend}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <p className="text-sm font-bold text-emerald-800">Profit & Loss</p>
          <h2 className="mt-2 text-4xl font-black text-emerald-700">
            {pack.profitAndLoss.summaries.find((item) => item.label === 'Net Profit')?.value || '0'}
          </h2>
          <p className="mt-2 text-xs text-emerald-700/70">Revenue − Purchases − Expenses</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {pack.profitAndLoss.summaries.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
          <p className="text-sm font-bold text-amber-800">GST Pack</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {pack.gst.summaries.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white/80 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-bold text-slate-800">Output Tax</p>
              {pack.gst.outputRows.map((row) => (
                <div key={row.label} className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-sm font-bold text-slate-800">Input Tax</p>
              {pack.gst.inputRows.map((row) => (
                <div key={row.label} className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{row.label}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GST Return Reports */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">GST Return Reports</h2>
            <p className="text-sm text-slate-500 mt-1">Statutory GST return reports</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { id: 'gstr1', title: 'GSTR-1', description: 'Outward supplies return', period: 'This Month', action: () => exportRowsToExcelCompatibleHtml(`${pack.sales.exportBaseName}_GSTR1`, 'GSTR-1 Outward Supplies', pack.sales.columns, pack.sales.rows) },
            { id: 'gstr2', title: 'GSTR-2', description: 'Inward supplies return', period: 'This Month', action: () => exportRowsToExcelCompatibleHtml(`${pack.purchases.exportBaseName}_GSTR2`, 'GSTR-2 Inward Supplies', pack.purchases.columns, pack.purchases.rows) },
            { id: 'gstr3b', title: 'GSTR-3B', description: 'Monthly summary return', period: 'This Month', action: () => navigate('/gst') },
            { id: 'gstr4', title: 'GSTR-4', description: 'Composition scheme return', period: 'This Quarter', action: () => exportRowsToExcelCompatibleHtml(`${pack.sales.exportBaseName}_GSTR4`, 'GSTR-4 Composition Summary', pack.sales.columns, pack.sales.rows) },
            { id: 'gstr9', title: 'GSTR-9', description: 'Annual return', period: 'This Financial Year', action: () => alert('GSTR-9 is an annual return. To generate, please export 12 months of GSTR-1 and GSTR-3B data.') },
          ].map((item) => (
            <div key={item.id} onClick={item.action} className="rounded-2xl border border-slate-100 bg-white p-4 text-center hover:border-blue-200 hover:shadow-md transition-all cursor-pointer flex flex-col items-center">
              <h3 className="font-black text-slate-900 text-lg">{item.title}</h3>
              <p className="mt-2 text-xs text-slate-500 flex-1 px-2">{item.description}</p>
              <div className="mt-5 px-3 py-1.5 bg-slate-50 rounded-lg text-xs font-bold text-slate-500 w-full">
                {item.period}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
};

export default ReportsPage;
