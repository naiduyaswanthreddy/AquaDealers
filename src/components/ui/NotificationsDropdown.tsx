import React, { useRef, useEffect, useMemo } from 'react';
import { Bell, AlertTriangle, Clock, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useLowStockAlerts, useExpiringMedicinesAlerts, useDashboardStats } from '@/features/dashboard/hooks/useDashboardData';
import { differenceInDays, parseISO } from 'date-fns';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'alert' | 'warning' | 'info';
  isRead: boolean;
  link?: string;
}

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  hasUnread: boolean;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ 
  isOpen, 
  onClose, 
  onMarkAllRead,
  hasUnread
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fetch real data
  const { data: lowStockItems = [] } = useLowStockAlerts();
  const { data: expiringItems = [] } = useExpiringMedicinesAlerts();
  const { data: dashboardStats } = useDashboardStats();

  const realNotifications = useMemo(() => {
    const notifs: NotificationItem[] = [];

    // 1. Low Stock Alerts
    if (lowStockItems.length > 0) {
      const topItems = lowStockItems.slice(0, 2).map((item: any) => `${item.name} (${item.quantity})`).join(', ');
      const moreCount = lowStockItems.length > 2 ? ` and ${lowStockItems.length - 2} more` : '';
      
      notifs.push({
        id: 'low-stock',
        title: 'Low Stock Alert',
        message: `${topItems}${moreCount} running low.`,
        time: 'Just now',
        type: 'alert',
        isRead: !hasUnread,
        link: '/inventory',
      });
    }

    // 2. Expiring Medicines
    if (expiringItems.length > 0) {
      const expiredCount = expiringItems.filter((i: any) => {
        if (!i.expiry_date) return false;
        return differenceInDays(parseISO(i.expiry_date), new Date()) < 0;
      }).length;
      
      const expiringSoonCount = expiringItems.length - expiredCount;
      
      let msg = '';
      if (expiredCount > 0 && expiringSoonCount > 0) {
        msg = `${expiredCount} expired items and ${expiringSoonCount} expiring soon.`;
      } else if (expiredCount > 0) {
        msg = `${expiredCount} inventory items have already expired.`;
      } else {
        msg = `${expiringSoonCount} inventory items are expiring soon.`;
      }

      notifs.push({
        id: 'expiring',
        title: 'Medicine Expiring',
        message: msg,
        time: 'Recently',
        type: 'warning',
        isRead: !hasUnread,
        link: '/inventory',
      });
    }

    // 3. Overdue Payments / Dues
    if (dashboardStats && dashboardStats.dueFarmersCount > 0) {
      notifs.push({
        id: 'dues',
        title: 'Outstanding Dues',
        message: `You have ${dashboardStats.dueFarmersCount} farmers with outstanding dues.`,
        time: 'Updated today',
        type: 'info',
        isRead: !hasUnread,
        link: '/farmers',
      });
    }

    return notifs;
  }, [lowStockItems, expiringItems, dashboardStats, hasUnread]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={dropdownRef}
      className="absolute top-12 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
        </div>
        {hasUnread && realNotifications.length > 0 && (
          <button 
            onClick={() => {
              onMarkAllRead();
              onClose();
            }}
            className="text-[0.75rem] font-bold text-sky-600 hover:text-sky-700 transition-colors uppercase tracking-wider"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {realNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">You're all caught up!</p>
            <p className="text-xs text-slate-400 mt-1">No new notifications right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {realNotifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => {
                  if (notif.link) {
                    navigate(notif.link);
                    onClose();
                  }
                }}
                className={cn(
                  "p-4 hover:bg-slate-50 transition-colors relative",
                  notif.link && "cursor-pointer"
                )}
              >
                {!notif.isRead && (
                  <div className="absolute top-4 left-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                )}
                <div className="flex gap-3 pl-3">
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    notif.type === 'alert' ? 'bg-rose-100 text-rose-600' :
                    notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                    'bg-sky-100 text-sky-600'
                  )}>
                    {notif.type === 'alert' ? <AlertTriangle className="h-4 w-4" /> :
                     notif.type === 'warning' ? <Clock className="h-4 w-4" /> :
                     <Package className="h-4 w-4" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{notif.title}</h4>
                    <p className="text-[0.8rem] text-slate-500 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                    <p className="text-[0.7rem] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                      {notif.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
