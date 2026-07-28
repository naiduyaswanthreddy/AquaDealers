import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopCustomers } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { formatCurrency, getInitials } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

const ACCENT_COLORS = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706'];

const TopCustomersComponent: React.FC = () => {
  const navigate = useNavigate();
  const { data: customers, isLoading } = useTopCustomers();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                  <Skeleton className="h-3.5 w-16 rounded-md" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-[1rem] font-bold text-slate-800 mb-4">Top Customers</h3>
        <p className="text-sm text-slate-400 text-center py-4">No outstanding dues yet.</p>
      </div>
    );
  }

  const maxDue = Math.max(...customers.map((c) => Number(c.total_due)));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[1rem] font-bold text-slate-800">Top Customers</h3>
        <button
          type="button"
          onClick={() => navigate('/farmers')}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 focus:outline-none"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3.5">
        {customers.map((customer, i) => {
          const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
          const pct = maxDue > 0 ? (Number(customer.total_due) / maxDue) * 100 : 0;

          return (
            <div
              key={customer.id}
              className="cursor-pointer group"
              onClick={() => navigate(`/farmers/${customer.id}`)}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-[0.65rem] font-extrabold text-white flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {getInitials(customer.name)}
                </div>
                <span className="flex-1 text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">
                  {customer.name}
                </span>
                <span className="text-sm font-bold text-slate-700 flex-shrink-0">
                  {formatCurrency(Number(customer.total_due))}
                </span>
              </div>
              <div className="ml-9 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TopCustomers = React.memo(TopCustomersComponent);
TopCustomers.displayName = 'TopCustomers';
export default TopCustomers;
