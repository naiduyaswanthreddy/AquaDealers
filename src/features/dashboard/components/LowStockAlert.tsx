import React from 'react';
import { useLowStockAlerts } from '../hooks/useDashboardData';
import { Card, CardContent, Skeleton } from '@/components/ui';
import { Package, AlertTriangle } from 'lucide-react';

export const LowStockAlert: React.FC = () => {
  const { data: items, isLoading } = useLowStockAlerts();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="w-28 h-5" />
        <Skeleton className="w-full h-16 rounded-xl" />
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3 animate-fade-in">
      <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5 px-1">
        <Package className="w-4 h-4 text-warning" />
        Low Stock Alert
        <span className="text-[10px] font-semibold bg-warning/10 text-warning rounded-full px-2 py-0.5 ml-1">
          {items.length}
        </span>
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {items.slice(0, 6).map((item: any) => (
          <Card key={item.id} className="flex-shrink-0 w-[140px] border border-warning/30 bg-warning/5 shadow-none rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-warning" />
                <span className="text-[9px] font-bold text-warning uppercase">Low</span>
              </div>
              <div className="text-xs font-bold text-text-primary line-clamp-2 leading-tight">
                {item.product?.name || 'Unknown'}
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5">
                {item.product?.company}
              </div>
              <div className="mt-2 text-xs font-extrabold text-warning">
                {Number(item.quantity_in_stock)} left
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default LowStockAlert;
