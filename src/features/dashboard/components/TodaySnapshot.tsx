import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardStats } from '../hooks/useDashboardData';
import { formatCurrency } from '@/lib/utils';
import { Skeleton, Button } from '@/components/ui';
import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { shareDailySummaryViaWhatsApp } from '../utils/dailySummaryPdf';

export const TodaySnapshot: React.FC = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useDashboardStats();
  const [isSharing, setIsSharing] = useState(false);
  const dealer = useAuthStore(s => s.user);

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await shareDailySummaryViaWhatsApp(stats, dealer);
    } catch (error) {
      console.error('Failed to share daily summary', error);
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/60" />
        <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/60" />
        <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/60" />
        <Skeleton className="h-16 rounded-2xl bg-white border border-slate-200/60" />
      </div>
    );
  }

  const items = [
    {
      label: t('dashboard.cashReceived', 'Cash Received'),
      value: formatCurrency(stats?.todayCashReceived ?? 0),
      valueColor: 'text-emerald-600',
    },
    {
      label: 'UPI Received',
      value: formatCurrency(stats?.todayUpiReceived ?? 0),
      valueColor: 'text-sky-600',
    },
    {
      label: t('dashboard.creditGiven', 'Credit Given'),
      value: formatCurrency(stats?.todayCredit ?? 0),
      valueColor: 'text-rose-600',
    },
    {
      label: t('dashboard.bills', 'Bills'),
      value: (stats?.todayCount ?? 0).toString(),
      valueColor: 'text-blue-600',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Today's Snapshot</h2>
        <Button 
          variant="secondary" 
          size="sm" 
          leftIcon={<Share2 className="h-4 w-4" />}
          onClick={handleShare}
          loading={isSharing}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 border-none rounded-full px-4"
        >
          Share Summary
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 animate-fade-in">
        {items.map((item, idx) => {
          return (
            <div 
              key={idx} 
              className="flex flex-col items-center justify-center text-center bg-white border border-slate-200/60 rounded-2xl p-2.5 sm:p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)] min-w-0"
            >
              <span className="text-[0.58rem] sm:text-[0.66rem] font-bold text-slate-500 uppercase tracking-wider leading-tight text-center max-w-full">
                {item.label}
              </span>
              <span className={`text-[0.98rem] sm:text-[1.15rem] font-extrabold ${item.valueColor} tracking-tight leading-none mt-1.5 sm:mt-2 truncate w-full px-1`}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodaySnapshot;
