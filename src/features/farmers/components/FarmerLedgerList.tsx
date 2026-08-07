import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui';
import { ListLoadMore } from '@/components/ui/ListLoadMore';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

interface Transaction {
  id: string;
  type: 'bill' | 'payment' | 'adjustment' | 'return';
  refNumber: string;
  date: string;
  amount: number;
  runningBalance?: number;
  paymentMethod?: string;
  branchName?: string | null;
  isEstimate?: boolean;
}

interface FarmerLedgerListProps {
  transactions: Transaction[];
  isLoading: boolean;
  backTo?: string;
  headerComponent?: React.ReactNode;
  // Server-driven infinite scroll (used by the paginated ledger tab). When
  // these are set, we skip the client-side useLoadMoreList and drive the
  // "Load more" button off the React Query infinite hook instead.
  serverPagination?: {
    total: number;
    hasMore: boolean;
    isFetchingMore: boolean;
    onLoadMore: () => void;
  };
}

export const FarmerLedgerList: React.FC<FarmerLedgerListProps> = ({
  transactions,
  isLoading,
  backTo,
  headerComponent,
  serverPagination,
}) => {
  const navigate = useNavigate();
  const pagedTransactions = useLoadMoreList(transactions, {
    initialCount: 12,
    step: 12,
    resetDeps: [transactions.length],
  });
  // Server-paginated: render everything already loaded; client-paginated: slice.
  const visibleItems = serverPagination ? transactions : pagedTransactions.visibleItems;

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-5 w-24" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const groupedTransactions = visibleItems.reduce((groups, tx) => {
    const dateObj = new Date(tx.date);
    const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const groupEntries = Object.entries(groupedTransactions);

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
      {headerComponent && (
        <div className="border-b border-primary/10 bg-primary/5 px-4 py-3 sm:px-6">
          {headerComponent}
        </div>
      )}
      <div className="flex flex-col">
        {groupEntries.map(([monthYear, txs], groupIndex) => (
          <div key={monthYear} className="flex flex-col">
            {groupIndex > 0 && (
              <div className="border-y border-slate-100 bg-slate-50 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-wider text-slate-500">
                {monthYear}
              </div>
            )}
            {txs.map((tx, index) => {
              const dateObj = new Date(tx.date);
              const day = dateObj.getDate();
              const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
              const isPayment = tx.type === 'payment';
              const isAdjustment = tx.type === 'adjustment';
              const isReturn = tx.type === 'return';
              const isEstimate = tx.isEstimate ?? false;
              const subLabel = isPayment ? (tx.paymentMethod || tx.refNumber || 'Payment') : tx.refNumber;
              const isLast = index === txs.length - 1 && groupIndex === groupEntries.length - 1;

              return (
                <React.Fragment key={tx.id}>
                  <button
                    type="button"
                    onClick={isPayment || isReturn ? undefined : () => navigate(`/bills/${tx.id}`, backTo ? { state: { from: backTo } } : undefined)}
                    className={`group flex min-h-[80px] w-full items-center justify-between px-4 py-4 text-left transition-all active:scale-[0.99] focus-ring ${
                      isPayment || isReturn ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                        <span className="text-[0.95rem] font-black leading-none text-slate-800">{day}</span>
                        <span className="mt-0.5 text-[0.56rem] font-black uppercase tracking-[0.16em] text-slate-400">{month}</span>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[1rem] font-bold tracking-tight text-slate-900">
                          {isPayment ? 'Payment Received' : isReturn ? 'Farmer Return' : isAdjustment ? 'Rate Adjustment' : isEstimate ? 'Estimate' : 'Bill'}
                        </div>
                        <div className="mt-0.5 truncate text-[0.82rem] font-medium text-slate-500">
                          {subLabel}
                          {tx.branchName && (
                            <span className="ml-2 inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200">
                              {tx.branchName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <div className={`text-[1rem] font-bold tabular-nums ${
                          isPayment || isReturn ? 'text-emerald-600'
                          : isAdjustment ? 'text-amber-600'
                          : isEstimate ? 'text-indigo-500'
                          : 'text-orange-500'
                        }`}>
                          {isPayment ? '+' : isReturn ? '−' : '-'}{formatCurrency(tx.amount)}
                        </div>
                        {typeof tx.runningBalance === 'number' ? (
                          <div className="mt-0 text-[0.72rem] font-semibold text-slate-400">
                            Bal {formatCurrency(tx.runningBalance)}
                          </div>
                        ) : (
                          <div className="mt-0 text-[0.72rem] font-semibold text-slate-400">
                            {isPayment || isReturn ? 'Credit' : isEstimate ? 'Quote' : 'Debit'}
                          </div>
                        )}
                      </div>
                      <svg className="h-4.5 w-4.5 text-slate-200 transition-colors group-hover:text-slate-300" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>
                  {!isLast && <div className="h-px w-full bg-slate-200/80" aria-hidden="true" />}
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>

      {transactions.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-500">
          No transactions found for this farmer.
        </div>
      )}

      {serverPagination ? (
        <ListLoadMore
          shown={transactions.length}
          total={serverPagination.total}
          onLoadMore={serverPagination.onLoadMore}
          isLoading={serverPagination.isFetchingMore}
          label="Load more transactions"
        />
      ) : (
        <ListLoadMore
          shown={pagedTransactions.visibleCount}
          total={pagedTransactions.totalCount}
          onLoadMore={pagedTransactions.loadMore}
          label="Load more transactions"
        />
      )}
    </div>
  );
};

export default FarmerLedgerList;
