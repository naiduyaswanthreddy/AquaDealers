import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStats } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

const TodayCashFlowComponent: React.FC = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalReceived = (stats?.todayCashReceived ?? 0) + (stats?.todayUpiReceived ?? 0) + (stats?.todayChequeReceived ?? 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[1rem] font-bold text-slate-800">Today's Cash Flow</h3>
        <button
          type="button"
          onClick={() => navigate('/cashbook')}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 focus:outline-none"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-0">
        {/* Bills count */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-slate-500 font-medium">Total Bills</span>
          <span className="text-sm font-bold text-blue-700 tabular-nums">{stats?.todayCount ?? 0}</span>
        </div>

        {/* Sales */}
        <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
          <span className="text-sm text-slate-500 font-medium">Total Sales</span>
          <span className="text-sm font-bold text-slate-800">{formatCurrency(stats?.todaySales ?? 0)}</span>
        </div>

        {/* Collections */}
        <div className="flex items-center justify-between py-1.5 pl-3">
          <span className="text-xs text-slate-400 font-medium">Today's Collections</span>
          <span className="text-xs font-semibold text-emerald-600">{formatCurrency(totalReceived)}</span>
        </div>

        {/* Breakdown */}
        <div className="flex items-center justify-between py-1.5 pl-3">
          <span className="text-xs text-slate-400 font-medium">Cash Received</span>
          <span className="text-xs font-semibold text-emerald-600">{formatCurrency(stats?.todayCashReceived ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5 pl-3">
          <span className="text-xs text-slate-400 font-medium">UPI Received</span>
          <span className="text-xs font-semibold text-sky-600">{formatCurrency(stats?.todayUpiReceived ?? 0)}</span>
        </div>

        {/* Total Received */}
        <div className="flex items-center justify-between py-1.5 border-t border-slate-100">
          <span className="text-sm text-slate-600 font-semibold">Total Received</span>
          <span className="text-sm font-extrabold text-emerald-600">{formatCurrency(totalReceived)}</span>
        </div>

        {/* Credit Given */}
        <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
          <span className="text-sm text-slate-500 font-medium">Credit Given</span>
          <span className="text-sm font-bold text-rose-500">{formatCurrency(stats?.todayCredit ?? 0)}</span>
        </div>

        {/* Returns */}
        {(stats?.todayReturns ?? 0) > 0 && (
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-slate-500 font-medium">Total Returns</span>
            <span className="text-sm font-bold text-amber-600">{formatCurrency(stats?.todayReturns ?? 0)}</span>
          </div>
        )}

        {/* Expenses */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-slate-500 font-medium">Total Expenses</span>
          <span className="text-sm font-bold text-amber-600">{formatCurrency(stats?.todayExpenses ?? 0)}</span>
        </div>

        {/* Cash in Hand footer */}
        <div className="pt-2 mt-1 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">Cash in Hand</span>
            <span className="text-base font-extrabold text-emerald-600">{formatCurrency(stats?.cashBalance ?? 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TodayCashFlow = React.memo(TodayCashFlowComponent);
TodayCashFlow.displayName = 'TodayCashFlow';
export default TodayCashFlow;
