import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeftRight, Plus } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Skeleton } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useStockTransfers } from '../hooks/useTransfers';

export const TransfersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useStockTransfers(null);
  const rows = data?.data ?? [];

  return (
    <PageShell width="wide">
      <PageHeader
        title="Stock Transfers"
        action={
          <Button onClick={() => navigate('/transfers/new')} leftIcon={<Plus className="w-4 h-4" />}>
            New transfer
          </Button>
        }
        onBack={() => navigate('/more')}
      />

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <ArrowLeftRight className="w-8 h-8 mx-auto text-slate-400" />
          <div className="mt-3 text-sm font-bold text-slate-700">No transfers yet</div>
          <div className="mt-1 text-xs text-slate-500">Move stock from one branch to another with full audit trail.</div>
          <Button className="mt-4" onClick={() => navigate('/transfers/new')} leftIcon={<Plus className="w-4 h-4" />}>
            Create your first transfer
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          {rows.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/transfers/${t.id}`)}
              className="text-left w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-300 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-black text-slate-900">{t.transfer_number}</div>
                <div className="text-xs text-slate-500 shrink-0">{formatDate(t.transfer_date)}</div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  {t.from_branch_name || 'From branch'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="inline-flex items-center rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  {t.to_branch_name || 'To branch'}
                </span>
                <span className="ml-auto text-sm font-bold tabular-nums text-slate-700">{Number(t.total_quantity)} units</span>
              </div>
              {t.notes && <div className="mt-1 text-xs text-slate-500 truncate">{t.notes}</div>}
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default TransfersListPage;
