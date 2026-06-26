import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectToday } from '../hooks/useDashboardData';
import { Skeleton } from '@/components/ui';
import { formatCurrency, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { MessageCircle, TrendingDown } from 'lucide-react';
import { CROP_STATUSES } from '@/lib/constants';

export const CollectToday: React.FC = () => {
  const navigate = useNavigate();
  const { data: farmers, isLoading, isError, error } = useCollectToday();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="w-36 h-5 rounded-md" />
          <Skeleton className="w-14 h-4 rounded-md" />
        </div>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center">
        <p className="text-sm font-medium text-rose-600">Failed to load collections: {(error as Error)?.message || 'Unknown error'}</p>
      </div>
    );
  }

  if (!farmers || farmers.length === 0) {
    return (
      <div className="mt-4 space-y-3 animate-fade-in">
        <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2 px-1">
          <TrendingDown className="w-[1.1rem] h-[1.1rem] text-rose-500" />
          Collect Today
        </h3>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-500">No collections due today.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[1.05rem] font-bold text-slate-900 flex items-center gap-2">
          <TrendingDown className="w-[1.1rem] h-[1.1rem] text-rose-500" />
          Collect Today
        </h3>
        <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
          {farmers.length} Due
        </span>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]">
        {farmers.map((farmer: any) => {
          const cropConfig = CROP_STATUSES.find((c) => c.value === farmer.crop_status);

          return (
            <div
              key={farmer.id}
              onClick={() => navigate(`/farmers/${farmer.id}`)}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {getInitials(farmer.name)}
                </div>

                {/* Info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-[0.95rem] font-semibold text-slate-900 truncate">
                    {farmer.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {farmer.village && (
                      <span className="text-[0.78rem] text-slate-500 font-medium truncate max-w-[80px]">
                        {farmer.village}
                      </span>
                    )}
                    {cropConfig && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md whitespace-nowrap"
                        style={{
                          backgroundColor: cropConfig.color + '15',
                          color: cropConfig.color,
                        }}
                      >
                        {cropConfig.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Due Amount & Actions */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[0.98rem] font-bold text-rose-600">
                  {formatCurrency(Number(farmer.total_due))}
                </span>
                
                {/* Quick WhatsApp */}
                {farmer.phone && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const cleanPhone = farmer.phone!.replace(/\D/g, '');
                      const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                      const text = `Hello ${farmer.name}, this is a friendly reminder regarding your outstanding balance of ${formatCurrency(Number(farmer.total_due))} at our shop. Please visit at your convenience. Thank you!`;
                      window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                    }}
                    style={{ backgroundColor: '#25D366', color: '#ffffff' }}
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95"
                    title="Send WhatsApp Reminder"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="fill-current text-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollectToday;
