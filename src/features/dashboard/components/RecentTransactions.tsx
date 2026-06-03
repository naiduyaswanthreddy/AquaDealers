import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRecentTransactionsList } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { formatCurrency, formatRelativeDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export const RecentTransactions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: transactions, isLoading } = useRecentTransactionsList(5);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="w-36 h-5 rounded-md" />
          <Skeleton className="w-14 h-4 rounded-md" />
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="space-y-2 w-1/3">
                <Skeleton className="h-4 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-[1.1rem] h-[1.1rem] text-slate-500" />
            {t('dashboard.recentTransactions', 'Recent Transactions')}
          </h3>
          <button 
            type="button"
            onClick={() => navigate('/bills')}
            className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer"
          >
            {t('dashboard.viewAll', 'View all')}
          </button>
        </div>
        <div className="text-center py-8 text-sm text-text-muted bg-white border border-slate-200/60 rounded-2xl shadow-sm">
          No transactions yet. Create your first bill!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-[1.1rem] h-[1.1rem] text-slate-500" />
          {t('dashboard.recentTransactions', 'Recent Transactions')}
        </h3>
        <button 
          type="button"
          onClick={() => navigate('/bills')}
          className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer focus:outline-none"
        >
          {t('dashboard.viewAll', 'View all')}
        </button>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        {transactions.map((tx: any) => {
          const isBill = tx.type === 'bill';
          const isAdjustment = tx.type === 'adjustment';
          const dateLabel = formatRelativeDate(tx.date);
          const capitalizedDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
          const subtext = isBill 
            ? `${capitalizedDate} • Bill ${tx.refNumber}` 
            : isAdjustment
            ? `${capitalizedDate} • Adjustment`
            : `${capitalizedDate} • Payment Receipt`;

          return (
            <div 
              key={tx.id} 
              onClick={() => (isBill || isAdjustment) && navigate(`/bills/${tx.id}`)}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/70 transition-colors",
                (isBill || isAdjustment) && "cursor-pointer"
              )}
            >
              {/* Details */}
              <div className="flex flex-col min-w-0">
                <span className="text-[0.95rem] font-semibold text-slate-900 truncate">
                  {isBill ? tx.farmerName : isAdjustment ? `Rate Adj: ${tx.farmerName}` : t('dashboard.paymentReceived', 'Payment Received')}
                </span>
                <span className="text-[0.78rem] text-slate-500 font-medium mt-0.5">
                  {subtext}
                </span>
              </div>

              {/* Amount */}
              <div
                className={cn(
                  'text-[0.98rem] font-bold shrink-0',
                  isBill ? 'text-rose-600' : isAdjustment ? 'text-amber-600' : 'text-emerald-600'
                )}
              >
                {isBill || isAdjustment ? `- ${formatCurrency(tx.amount)}` : `+ ${formatCurrency(tx.amount)}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentTransactions;
