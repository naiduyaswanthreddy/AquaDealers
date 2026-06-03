import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, BookOpen, Building2, CalendarDays, Download, FileSpreadsheet, LineChart, ShieldAlert, ShoppingCart, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { useMonthlyFinancePack } from '../hooks/useReports';
import { exportRowsToCsv, exportRowsToExcelCompatibleHtml, exportSummaryPdf } from '../utils/reportExport';
import { ReportTableModel } from '../types';
import { formatCurrency, cn } from '@/lib/utils';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

const currentDate = new Date();

function toMonthlySummaryValue(value: string | number) {
  if (typeof value === 'number') return formatCurrency(value);
  return value;
}

type SummaryRow = { section: string; metric: string; value: string };

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
                      {typeof value === 'number' ? formatCurrency(value) : (value ?? '—')}
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
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const { data: pack, isLoading, error } = useMonthlyFinancePack(month, year);

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

  return (
    <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
      <PageHeader
        eyebrow={t('nav.reports', 'Reports & Analytics')}
        title="CA Monthly Reports Center"
        description="Monthly finance pack with accountant-ready exports"
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
            <p className="mt-1 text-sm text-slate-500">Use the month selector to review GST, cash flow, profit, dues, and supporting ledgers.</p>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviewCards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{toMonthlySummaryValue(card.value)}</h3>
              </div>
              <div className={cn('rounded-2xl p-3', card.bg)}>
                <card.icon className={cn('h-5 w-5', card.tone)} />
              </div>
            </div>
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

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Optional add-ons</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Additional CA reports when those data sources are active</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'Inventory Summary', description: 'Stock valuation, slow movers, and low stock alerts.', icon: Building2 },
            { title: 'Payroll & Statutory', description: 'Salary, TDS/PT, and attendance-linked payouts.', icon: CalendarDays },
            { title: 'Fixed Assets', description: 'Asset register, depreciation, and additions/disposals.', icon: LineChart },
            { title: 'Loans & EMI', description: 'Outstanding principal, interest, and due instalments.', icon: Wallet },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <item.icon className="h-5 w-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ReportSection table={pack.sales} />
      <ReportSection table={pack.purchases} />
      <ReportSection table={pack.expenses} />
      <ReportSection table={pack.cashBook} />
      <ReportSection table={pack.bankReconciliation} note={pack.bankReconciliation.note} />
      <ReportSection table={pack.receivables} />
      <ReportSection table={pack.payables} />
    </PageShell>
  );
};

export default ReportsPage;
