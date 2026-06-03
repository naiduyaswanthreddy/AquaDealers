import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import { useMonthlyFinancePack } from '../hooks/useReports';
import { exportRowsToCsv, exportRowsToExcelCompatibleHtml, exportSummaryPdf } from '../utils/reportExport';
import { formatCurrency } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

const GSTLedgerPage: React.FC = () => {
  const { t } = useTranslation();

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const { data: pack, isLoading, error } = useMonthlyFinancePack(month, year);

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

  const gst = pack.gst;
  const monthlySummaryRows = [...gst.outputRows, ...gst.inputRows];

  const exportCsv = () => exportRowsToCsv(gst.exportBaseName, [{ key: 'label', label: 'Label' }, { key: 'value', label: 'Value' }], monthlySummaryRows);
  const exportExcel = () => exportRowsToExcelCompatibleHtml(gst.exportBaseName, gst.title, [{ key: 'label', label: 'Label' }, { key: 'value', label: 'Value' }], monthlySummaryRows);
  const exportPdf = () => exportSummaryPdf(gst.exportBaseName, gst.title, gst.description, gst.summaries, ['GSTR-1, GSTR-3B and ITC output are derived from recorded bills and purchases.']);

  return (
    <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
      <PageHeader
        eyebrow={t('reports.gstReports', 'GST Reports')}
        title={gst.title}
        description={gst.description}
        action={(
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              CSV
            </Button>
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={exportExcel}>
              Excel
            </Button>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={exportPdf}>
              PDF
            </Button>
          </div>
        )}
      />

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Month</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{pack.period.label}</h2>
          </div>
          <div className="flex gap-3">
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
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {gst.summaries.map((summary) => (
          <div key={summary.label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{summary.label}</p>
            <h3 className="mt-2 text-2xl font-black text-slate-900">{summary.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <FileText className="h-5 w-5 text-blue-600" />
            Output Tax (GSTR-1)
          </h3>
          <div className="mt-4 space-y-3">
            {gst.outputRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
            <FileText className="h-5 w-5 text-emerald-600" />
            Input Tax (Purchase ITC)
          </h3>
          <div className="mt-4 space-y-3">
            {gst.inputRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(row.value)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
        <p className="text-sm font-bold text-amber-800">{t('reports.netGstPayable', 'Net GST Payable')}</p>
        <h2 className="mt-2 text-4xl font-black text-amber-700">
          {formatCurrency(Number(gst.summaries.find((summary) => summary.label === 'Net GST Payable')?.value || 0))}
        </h2>
        <p className="mt-2 text-xs text-amber-700/70">{t('reports.netGstFormula', 'Output GST - Input GST')}</p>
      </div>
    </PageShell>
  );
};

export default GSTLedgerPage;
