import React from 'react';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useOfflineBillStore } from '../offline/offlineBillStore';

/**
 * Shows bills saved offline that are waiting to sync, with manual retry and
 * discard controls for bills the server rejected.
 */
export const OfflinePendingBanner: React.FC = () => {
  const bills = useOfflineBillStore((s) => s.bills);
  const isSyncing = useOfflineBillStore((s) => s.isSyncing);
  const syncAll = useOfflineBillStore((s) => s.syncAll);
  const discardBill = useOfflineBillStore((s) => s.discardBill);

  if (!bills.length) return null;

  const failedBills = bills.filter((b) => b.status === 'failed');

  return (
    <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <CloudOff className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-amber-900">
              {bills.length} bill{bills.length === 1 ? '' : 's'} saved offline
            </div>
            <div className="text-xs font-semibold text-amber-700">
              {failedBills.length > 0
                ? `${failedBills.length} need attention — the rest will sync automatically.`
                : 'They will sync automatically when internet returns.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => syncAll()}
          disabled={isSyncing || !navigator.onLine}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-2 text-xs font-black text-white transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {bills.map((bill) => (
          <div
            key={bill.clientRef}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-slate-800">
                {bill.tempBillNumber} · {bill.farmerName || 'Walk-in Customer'}
              </div>
              <div className="truncate text-[11px] font-semibold text-slate-500">
                {formatCurrency(bill.total)}
                {bill.status === 'failed' && bill.error ? ` — ${bill.error}` : ''}
              </div>
            </div>
            {bill.status === 'failed' && (
              <button
                type="button"
                onClick={() => discardBill(bill.clientRef)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-600 transition-all active:scale-95"
                aria-label={`Discard offline bill ${bill.tempBillNumber}`}
              >
                <Trash2 className="h-3 w-3" />
                Discard
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfflinePendingBanner;
