import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTodaySoldItems } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { Package, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ItemsSoldToday: React.FC = () => {
  const { t } = useTranslation();
  const { data: items, isLoading, isError, error } = useTodaySoldItems();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="w-36 h-5 rounded-md" />
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
        <p className="text-sm font-medium text-rose-600">Failed to load today's items: {(error as Error)?.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="mt-4 space-y-3 animate-fade-in">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-[1.1rem] h-[1.1rem] text-blue-500" />
            Items Sold Today
          </h3>
          <Link
            to="/inventory/report"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Stock Reports
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">No items sold today yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-[1.1rem] h-[1.1rem] text-blue-500" />
          Items Sold Today
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            {items.length} Products
          </span>
          <Link
            to="/inventory/report"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Stock Reports
          </Link>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        {items.map((item: any) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/70 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
              <div className="flex flex-col min-w-0">
                <span className="text-[0.95rem] font-semibold text-slate-900 truncate">
                  {item.name}
                </span>
                <span className="text-[0.78rem] text-slate-500 font-medium capitalize">
                  {item.type}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[0.98rem] font-bold text-blue-600">
                {item.quantity} <span className="text-xs font-medium text-slate-400 ml-0.5">{item.unit || 'units'}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ItemsSoldToday;
