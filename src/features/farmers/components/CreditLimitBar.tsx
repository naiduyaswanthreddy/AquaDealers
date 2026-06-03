import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CreditLimitBarProps {
  totalDue: number;
  creditLimit: number;
}

export const CreditLimitBar: React.FC<CreditLimitBarProps> = ({ totalDue, creditLimit }) => {
  if (creditLimit <= 0) {
    return (
      <div className="p-3 bg-slate-50 rounded-xl border border-border text-xs text-text-muted text-center">
        No credit limit set
      </div>
    );
  }

  const percentage = Math.min(100, (totalDue / creditLimit) * 100);
  const barColor =
    percentage < 50
      ? 'bg-success'
      : percentage < 80
      ? 'bg-warning'
      : 'bg-danger';

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <span className="text-[0.7rem] font-black text-slate-400 uppercase tracking-wider">Credit Used</span>
        </div>
        <span className="text-sm font-black text-slate-900">{percentage.toFixed(0)}%</span>
      </div>
      
      <div className="h-4 bg-slate-50 rounded-full overflow-hidden p-1 border border-slate-100 shadow-inner">
        <div
          className={cn('h-full rounded-full transition-all duration-1000 ease-out shadow-sm', barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between items-center px-1 text-[10px] font-black uppercase tracking-wider">
        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{formatCurrency(totalDue)} Used</span>
        <span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{formatCurrency(creditLimit)} Limit</span>
      </div>
    </div>
  );
};

export default CreditLimitBar;
