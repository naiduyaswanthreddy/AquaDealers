import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectToday } from '../hooks/useDashboardData';
import { Card, CardContent, Skeleton, Badge, EmptyState } from '@/components/ui';
import { formatCurrency, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { MessageCircle, Phone, ChevronRight, TrendingDown, Users } from 'lucide-react';
import { CROP_STATUSES } from '@/lib/constants';

export const CollectToday: React.FC = () => {
  const navigate = useNavigate();
  const { data: farmers, isLoading } = useCollectToday();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="w-32 h-5" />
          <Skeleton className="w-16 h-4" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="w-1/2 h-4" />
                <Skeleton className="w-1/3 h-3" />
              </div>
              <Skeleton className="w-16 h-5" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!farmers || farmers.length === 0) {
    return null; // Don't show section if no collections needed
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Section Header */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
          <TrendingDown className="w-4 h-4 text-danger" />
          Collect Today
        </h3>
        <span className="text-[10px] font-semibold text-text-muted bg-danger/10 text-danger rounded-full px-2 py-0.5">
          {farmers.length} farmer{farmers.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Farmer Cards */}
      <div className="space-y-2">
        {farmers.map((farmer: any) => {
          const cropConfig = CROP_STATUSES.find((c) => c.value === farmer.crop_status);

          return (
            <button
              key={farmer.id}
              type="button"
              onClick={() => navigate(`/farmers/${farmer.id}`)}
              className="w-full text-left bg-white border border-border rounded-2xl px-3.5 py-3 flex items-center gap-3 hover:bg-slate-50 active:scale-[0.99] transition-all focus-ring shadow-sm"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center font-bold text-sm flex-shrink-0">
                {getInitials(farmer.name)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text-primary truncate">
                  {farmer.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {farmer.village && (
                    <span className="text-[11px] text-text-secondary truncate">
                      {farmer.village}
                    </span>
                  )}
                  {cropConfig && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
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

              {/* Due Amount */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-sm font-extrabold text-danger">
                  {formatCurrency(Number(farmer.total_due))}
                </span>
                {/* Quick WhatsApp */}
                {farmer.phone && (
                  <a
                    href={`https://wa.me/91${farmer.phone}?text=${encodeURIComponent(
                      `Hello ${farmer.name}, this is a friendly reminder regarding your outstanding balance of ${formatCurrency(Number(farmer.total_due))} at our shop. Please visit at your convenience. Thank you!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-7 h-7 rounded-full bg-success/10 text-success flex items-center justify-center hover:bg-success/20 transition-colors"
                    title="Send WhatsApp Reminder"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CollectToday;
