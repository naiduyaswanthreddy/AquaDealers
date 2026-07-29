import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSettlementDetails } from '../hooks/useSettlementDetails';
import { formatCurrency } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';

export const SettlementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useSettlementDetails();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.farmerName.toLowerCase().includes(q) ||
        r.billNumber.toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  return (
    <PageShell>
      <PageHeader
        title="Settlements (All Time)"
        onBack={() => navigate('/reports')}
      />

      <div className="p-4 space-y-4">
        {/* Summary card */}
        <div className="rounded-2xl bg-slate-900 p-4 text-white flex items-center gap-4">
          <div className="rounded-xl bg-fuchsia-600 p-2.5">
            <IndianRupee className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total settled (all time)</p>
            <p className="text-2xl font-black mt-0.5">{formatCurrency(total)}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-bold text-slate-400">{rows.length} settlement{rows.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Search farmer, bill number, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
              {rows.length === 0 ? 'No settlement discounts recorded yet.' : 'No results match your search.'}
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1fr_auto] gap-x-4 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Farmer</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Bill #</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Date</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Reason</span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 text-right">Amount</span>
              </div>

              {filtered.map((row) => (
                <div
                  key={row.billId}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_1fr_auto] gap-x-4 gap-y-0.5 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                >
                  <span className="text-sm font-bold text-slate-900">{row.farmerName}</span>
                  <span className="text-sm text-slate-600 font-mono">{row.billNumber}</span>
                  <span className="text-sm text-slate-500">
                    {format(parseISO(row.billDate), 'dd MMM yyyy')}
                  </span>
                  <span className="text-sm text-slate-500 italic truncate">
                    {row.reason || <span className="not-italic text-slate-300">—</span>}
                  </span>
                  <span className="text-sm font-black text-fuchsia-700 sm:text-right">
                    {formatCurrency(row.amount)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default SettlementsPage;
