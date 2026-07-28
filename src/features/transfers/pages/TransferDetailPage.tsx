import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { useStockTransfer } from '../hooks/useTransfers';

export const TransferDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useStockTransfer(id);

  if (isLoading) {
    return (
      <PageShell width="wide">
        <div className="space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-32 w-full rounded-xl" /></div>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell width="wide">
        <div className="text-center text-sm text-slate-500 p-10">Transfer not found.</div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Stock Transfer"
        title={data.transfer_number || 'Transfer'}
        description={
          <span className="inline-flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700 uppercase tracking-wider">{data.from_branch_name}</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 uppercase tracking-wider ring-1 ring-emerald-200">{data.to_branch_name}</span>
          </span>
        }
        onBack={() => navigate('/transfers')}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Transfer date</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{formatDate(data.transfer_date)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total quantity</div>
          <div className="mt-1 text-sm font-bold text-slate-800 tabular-nums">{Number(data.total_quantity)} units</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recorded</div>
          <div className="mt-1 text-sm font-bold text-slate-800">{formatDateTime(data.created_at)}</div>
        </div>
      </div>

      {data.notes && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Notes</div>
          {data.notes}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-black text-slate-800">Items</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2 text-right">Cost / unit</th>
              <th className="px-3 py-2 text-right">Line cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((it) => (
              <tr key={it.id}>
                <td className="px-3 py-2 font-semibold text-slate-800">{it.product_name_snapshot || 'Product'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{Number(it.quantity)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{it.cost_price != null ? formatCurrency(Number(it.cost_price)) : '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {it.cost_price != null ? formatCurrency(Number(it.cost_price) * Number(it.quantity)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
};

export default TransferDetailPage;
