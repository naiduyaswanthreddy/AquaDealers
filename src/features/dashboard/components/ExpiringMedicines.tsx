import React from 'react';
import { useExpiringMedicinesAlerts } from '../hooks/useDashboardData';
import { Card, CardContent, Skeleton, Button } from '@/components/ui';
import { Clock, Pill, Share2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { shareExpiryReportViaWhatsApp } from '../utils/expiryReportPdf';

export const ExpiringMedicines: React.FC = () => {
  const { data: items, isLoading } = useExpiringMedicinesAlerts();
  const [isSharing, setIsSharing] = useState(false);
  const dealer = useAuthStore(s => s.user);

  const handleShare = async () => {
    if (!items) return;
    try {
      setIsSharing(true);
      await shareExpiryReportViaWhatsApp(items, dealer);
    } catch (error) {
      console.error('Failed to share expiry report', error);
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="w-36 h-5" />
        <Skeleton className="w-full h-16 rounded-xl" />
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
          <Pill className="w-4 h-4 text-danger" />
          Expiring Medicines
          <span className="text-[10px] font-semibold bg-danger/10 text-danger rounded-full px-2 py-0.5 ml-1">
            {items.length}
          </span>
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          leftIcon={<Share2 className="h-3.5 w-3.5" />}
          onClick={handleShare}
          loading={isSharing}
          className="text-slate-500 hover:text-slate-800 h-7 px-2"
        >
          Share
        </Button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {items.slice(0, 6).map((item: any) => {
          const daysLeft = item.expiry_date
            ? differenceInDays(parseISO(item.expiry_date), new Date())
            : 0;
          const isExpired = daysLeft < 0;

          return (
            <Card
              key={item.id}
              className={`flex-shrink-0 w-[140px] border shadow-none rounded-xl ${
                isExpired ? 'border-danger/40 bg-danger/5' : 'border-orange-200 bg-orange-50'
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1.5">
                  <Clock className={`w-3 h-3 ${isExpired ? 'text-danger' : 'text-orange-500'}`} />
                  <span className={`text-[9px] font-bold uppercase ${isExpired ? 'text-danger' : 'text-orange-600'}`}>
                    {isExpired ? 'Expired' : `${daysLeft}d left`}
                  </span>
                </div>
                <div className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
                  {item.product?.name || 'Unknown'}
                </div>
                <div className="text-[10px] text-text-secondary mt-1">
                  Exp: {item.expiry_date ? formatDate(item.expiry_date) : 'N/A'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ExpiringMedicines;
