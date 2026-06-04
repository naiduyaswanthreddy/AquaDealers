import React from 'react';
import { Skeleton, Button } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Receipt, ArrowDownLeft } from 'lucide-react';
import { useLoadMoreList } from '@/lib/useLoadMoreList';

interface Transaction {
  id: string;
  type: 'bill' | 'payment';
  refNumber: string;
  date: string;
  amount: number;
  runningBalance: number;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading: boolean;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  isLoading,
}) => {
  const pagedTransactions = useLoadMoreList(transactions, {
    initialCount: 8,
    step: 8,
    resetDeps: [transactions.length],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="w-40 h-5" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="w-full h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-slate-50 border border-border rounded-xl">
        <div className="text-4xl mb-2">📄</div>
        <div className="text-sm font-bold text-text-primary">No transactions yet</div>
        <div className="text-xs text-text-secondary mt-1">
          Bills and payments will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
        Transaction History
      </h4>
      <div className="space-y-1.5">
        {pagedTransactions.visibleItems.map((tx) => {
          const isBill = tx.type === 'bill';
          return (
            <div
              key={tx.id}
              className={cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors',
                isBill
                  ? 'bg-red-50/40 border-red-100'
                  : 'bg-emerald-50/40 border-emerald-100'
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  isBill ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
                )}
              >
                {isBill ? (
                  <Receipt className="w-4 h-4" />
                ) : (
                  <ArrowDownLeft className="w-4 h-4" />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text-primary truncate uppercase">
                  {tx.refNumber}
                </div>
                <div className="text-[11px] text-text-secondary mt-0.5">
                  {formatDateTime(tx.date)}
                </div>
              </div>

              {/* Amounts */}
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <div
                  className={cn(
                    'text-sm font-extrabold',
                    isBill ? 'text-danger' : 'text-success'
                  )}
                >
                  {isBill ? '+' : '-'}
                  {formatCurrency(tx.amount)}
                </div>
                <div className="text-[10px] font-semibold text-text-muted">
                  Bal: {formatCurrency(tx.runningBalance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        variant="outline"
        fullWidth
        className="mt-2 text-xs"
        onClick={pagedTransactions.loadMore}
        disabled={!pagedTransactions.hasMore}
      >
        {pagedTransactions.hasMore ? 'Load More' : 'All transactions shown'}
      </Button>
    </div>
  );
};

export default TransactionHistory;
