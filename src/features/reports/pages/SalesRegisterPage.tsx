import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Search,
  LineChart,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useSalesRegisterData, SalesSortBy, SortDir, PaymentStatusFilter, PaymentModeFilter, PAGE_SIZE } from '../hooks/useSalesRegisterData';
import { exportRowsToCsv, exportRowsToExcelCompatibleHtml } from '../utils/reportExport';
import { formatCurrency, cn } from '@/lib/utils';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import DateRangeFilter from '@/components/ui/DateRangeFilter';

const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const SalesRegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const defaultStartDate = new Intl.DateTimeFormat('en-CA').format(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const defaultEndDate = new Intl.DateTimeFormat('en-CA').format(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  );

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [activePreset, setActivePreset] = useState<string>('This Month');

  const handleDateChange = (s: string, e: string, presetLabel?: string) => {
    setStartDate(s);
    setEndDate(e);
    setPage(1);
    if (presetLabel) {
      setActivePreset(presetLabel);
    } else {
      setActivePreset('Custom');
    }
  };

  const PRESETS = [
    { label: 'Today', start: () => new Intl.DateTimeFormat('en-CA').format(new Date()), end: () => new Intl.DateTimeFormat('en-CA').format(new Date()) },
    { label: 'Yesterday', start: () => { const d = new Date(); d.setDate(d.getDate() - 1); return new Intl.DateTimeFormat('en-CA').format(d); }, end: () => { const d = new Date(); d.setDate(d.getDate() - 1); return new Intl.DateTimeFormat('en-CA').format(d); } },
    { label: 'This Week', start: () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day == 0 ? -6 : 1); return new Intl.DateTimeFormat('en-CA').format(new Date(d.setDate(diff))); }, end: () => new Intl.DateTimeFormat('en-CA').format(new Date()) },
    { label: 'This Month', start: () => { const d = new Date(); return new Intl.DateTimeFormat('en-CA').format(new Date(d.getFullYear(), d.getMonth(), 1)); }, end: () => { const d = new Date(); return new Intl.DateTimeFormat('en-CA').format(new Date(d.getFullYear(), d.getMonth() + 1, 0)); } },
  ];
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SalesSortBy>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all');
  const [paymentMode, setPaymentMode] = useState<PaymentModeFilter>('all');

  const { data, isLoading, isFetching } = useSalesRegisterData(
    startDate,
    endDate,
    page,
    sortBy,
    sortDir,
    search,
    paymentStatus,
    paymentMode
  );

  const handleSort = (column: SalesSortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setPage(1);
  };

  const totalPages = data?.pagination?.totalPages || 1;

  const handleExportCsv = () => {
    if (!data?.items.length) return;
    exportRowsToCsv('sales_register_filtered', [
      { key: 'date', label: 'Date' },
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'customerName', label: 'Customer' },
      { key: 'itemsString', label: 'Items' },
      { key: 'totalQty', label: 'Total Qty' },
      { key: 'taxableValue', label: 'Taxable' },
      { key: 'gstAmount', label: 'GST' },
      { key: 'totalAmount', label: 'Total' },
      { key: 'amountPaid', label: 'Paid' },
      { key: 'balanceDue', label: 'Due' },
      { key: 'paymentMode', label: 'Mode' },
    ], data.items);
  };

  const handleExportExcel = () => {
    if (!data?.items.length) return;
    exportRowsToExcelCompatibleHtml('sales_register_filtered', 'Sales Register', [
      { key: 'date', label: 'Date' },
      { key: 'invoiceNo', label: 'Invoice No' },
      { key: 'customerName', label: 'Customer' },
      { key: 'itemsString', label: 'Items' },
      { key: 'totalQty', label: 'Total Qty' },
      { key: 'taxableValue', label: 'Taxable' },
      { key: 'gstAmount', label: 'GST' },
      { key: 'totalAmount', label: 'Total' },
      { key: 'amountPaid', label: 'Paid' },
      { key: 'balanceDue', label: 'Due' },
      { key: 'paymentMode', label: 'Mode' },
    ], data.items);
  };

  const getStatusColor = (paid: number, due: number) => {
    if (due <= 0) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (paid > 0) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-rose-100 text-rose-800 border-rose-200';
  };
  const getStatusText = (paid: number, due: number) => {
    if (due <= 0) return 'Paid';
    if (paid > 0) return 'Partial';
    return 'Unpaid';
  };

  return (
    <PageShell width="wide" className="space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Sales Register"
        description="Detailed view of sales and outstanding amounts"
        onBack={() => navigate('/more/reports')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExportCsv} disabled={!data?.items.length}>
              CSV
            </Button>
            <Button variant="outline" leftIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={handleExportExcel} disabled={!data?.items.length}>
              Excel
            </Button>
          </div>
        }
      />

      {/* Date & Search Filters */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col xl:flex-row gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleDateChange(preset.start(), preset.end(), preset.label)}
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
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => handleDateChange(s, e)}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row items-end gap-3 xl:w-1/2">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by customer, invoice or item..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 w-full"
            />
          </div>
          <select
            value={paymentMode}
            onChange={(e) => { setPaymentMode(e.target.value as PaymentModeFilter); setPage(1); }}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="credit">Credit</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-black text-emerald-950 mt-1">{formatCurrency(data?.summary?.totalRevenue || 0)}</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
          <p className="text-xs font-bold text-sky-800 uppercase tracking-wider">Total Bills</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-black text-sky-950">{data?.summary?.totalBills || 0}</p>
            <p className="text-xs font-semibold text-sky-700">({data?.summary?.totalQty || 0} items)</p>
          </div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
          <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Outstanding Amount</p>
          <p className="text-2xl font-black text-rose-950 mt-1">{formatCurrency(data?.summary?.totalOutstanding || 0)}</p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 flex flex-col justify-center">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-emerald-700">Paid:</span>
            <span className="font-bold">{data?.summary?.paidCount || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="font-semibold text-amber-600">Partial:</span>
            <span className="font-bold">{data?.summary?.partialCount || 0}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="font-semibold text-rose-600">Unpaid:</span>
            <span className="font-bold">{data?.summary?.unpaidCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-slate-800">Daily Revenue Trend</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={data?.charts?.dailyRevenue || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }} 
                  tickFormatter={(val) => format(new Date(val), 'MMM dd')} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => formatCurrency(val).replace('.00', '')} 
                />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Revenue']}
                  labelFormatter={(label) => format(new Date(label), 'MMMM dd, yyyy')}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="h-5 w-5 text-slate-500" />
            <h3 className="font-bold text-slate-800">Payment Modes</h3>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {(!data?.charts?.paymentSplit || data.charts.paymentSplit.length === 0) ? (
              <p className="text-slate-400 text-sm">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.paymentSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="amount"
                    nameKey="mode"
                  >
                    {data.charts.paymentSplit.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Amount']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {data?.charts?.paymentSplit?.map((entry, index) => (
              <div key={entry.mode} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                <span className="capitalize font-semibold text-slate-600">{entry.mode}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col relative">
        {isFetching && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        )}

        <div className="border-b border-slate-100 bg-slate-50/50 p-2 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 w-max">
            {(['all', 'paid', 'unpaid', 'partial'] as PaymentStatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => { setPaymentStatus(status); setPage(1); }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all",
                  paymentStatus === status 
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 font-bold text-slate-500 uppercase text-xs cursor-pointer select-none" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">Date {sortBy === 'date' && (sortDir === 'desc' ? '↓' : '↑')}</div>
                </th>
                <th className="px-5 py-3 font-bold text-slate-500 uppercase text-xs cursor-pointer select-none" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">Invoice / Customer {sortBy === 'customer' && (sortDir === 'desc' ? '↓' : '↑')}</div>
                </th>
                <th className="px-5 py-3 font-bold text-slate-500 uppercase text-xs">Items</th>
                <th className="px-5 py-3 font-bold text-slate-500 uppercase text-xs text-right cursor-pointer select-none" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end gap-1">Total Amount {sortBy === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}</div>
                </th>
                <th className="px-5 py-3 font-bold text-slate-500 uppercase text-xs text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data?.items.map((row) => (
                <tr 
                  key={row.id} 
                  onClick={() => navigate(`/bills/${row.id}`)}
                  className="hover:bg-slate-50 cursor-pointer group transition-colors"
                >
                  <td className="px-5 py-4 text-slate-700 font-medium">
                    {format(new Date(row.date), 'dd MMM yyyy')}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-900">{row.customerName}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{row.invoiceNo}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-700 truncate max-w-[200px]" title={row.itemsString || ''}>
                      {row.itemsString}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{row.totalQty} items</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-bold text-slate-900">{formatCurrency(row.totalAmount)}</p>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Base: {formatCurrency(row.taxableValue)} · GST: {formatCurrency(row.gstAmount)}</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide border', getStatusColor(row.amountPaid, row.balanceDue))}>
                        {getStatusText(row.amountPaid, row.balanceDue)}
                      </span>
                      {row.balanceDue > 0 && (
                        <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          Due: {formatCurrency(row.balanceDue)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!data?.items || data.items.length === 0) && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                    No sales found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Page <span className="font-bold text-slate-800">{page}</span> / <span className="font-bold text-slate-800">{totalPages}</span>
              <span className="ml-2 text-slate-400">· {data?.pagination?.totalItems || 0} items · {PAGE_SIZE}/page</span>
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
                          page === p ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
    </PageShell>
  );
};

export default SalesRegisterPage;
