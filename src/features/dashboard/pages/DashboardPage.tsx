import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Search, Bell, Settings2, X } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { cn } from '@/lib/utils';
import { UniversalSearchModal } from '@/components/ui/UniversalSearchModal';
import { SyncStatusIndicator } from '@/components/ui/SyncStatusIndicator';
import { NotificationsDropdown } from '@/components/ui/NotificationsDropdown';
import CollectToday from '../components/CollectToday';
import ExpiringMedicines from '../components/ExpiringMedicines';
import LowStockAlert from '../components/LowStockAlert';
import RecentTransactions from '../components/RecentTransactions';
import StatCards from '../components/StatCards';
import TodaySnapshot from '../components/TodaySnapshot';
import SalesTrend from '../components/SalesTrend';
import TopSoldProducts from '../components/TopSoldProducts';
import ItemsSoldToday from '../components/ItemsSoldToday';

// ─────────────────────────────────────────────────────────────────────────────
// BranchDropdown — isolated component so its local state (isDropdownOpen)
// never triggers a re-render of the 9 heavy dashboard child components.
// ─────────────────────────────────────────────────────────────────────────────
const BranchDropdown: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const { branches, activeBranch, setActiveBranch, isAllBranches, setAllBranches } = useBranchStore();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleClickOutside = React.useCallback((event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setIsDropdownOpen(false);
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const currentLabel = isAllBranches
    ? t('dashboard.allBranches', 'All Branches')
    : activeBranch?.name || t('dashboard.mainShop', 'Main Shop');

  return (
    <div className="dashboard-hero__branch-row relative inline-block" ref={dropdownRef}>
      {branches.length > 1 ? (
        <button
          type="button"
          className="dashboard-hero__branch-trigger flex items-center gap-1.5 cursor-pointer focus:outline-none"
          onClick={() => setIsDropdownOpen(o => !o)}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
        >
          <h1 className="text-xl font-bold text-white tracking-tight">{currentLabel}</h1>
          <ChevronDown
            className={cn('dashboard-hero__chevron transition-transform duration-200 mt-1', isDropdownOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="dashboard-hero__branch-trigger flex items-center gap-1.5">
          <h1 className="text-xl font-bold text-white tracking-tight">{currentLabel}</h1>
        </div>
      )}

      {isDropdownOpen && (
        <div
          className="absolute left-0 top-full mt-2 z-50 w-64 rounded-xl border border-border/80 bg-white p-1.5 shadow-xl animate-scale-in text-text-primary"
          role="listbox"
        >
          {branches.length > 1 && (
            <button
              type="button"
              onClick={() => { setAllBranches(true); setIsDropdownOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer',
                isAllBranches ? 'bg-slate-100 text-primary font-bold' : 'text-text-primary hover:bg-slate-50'
              )}
            >
              <span>{t('dashboard.allBranches', 'All Branches')}</span>
            </button>
          )}

          {branches.map((branch) => {
            const isActive = !isAllBranches && activeBranch?.id === branch.id;
            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => { setActiveBranch(branch); setIsDropdownOpen(false); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer',
                  isActive ? 'bg-slate-100 text-primary font-bold' : 'text-text-primary hover:bg-slate-50'
                )}
              >
                <span>{branch.name}</span>
                {branch.is_main && (
                  <span className="text-[0.68rem] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold tracking-wider uppercase">
                    {t('dashboard.main', 'MAIN')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
BranchDropdown.displayName = 'BranchDropdown';

const WIDGET_CONFIGS = [
  { key: 'sales_trend',         label: 'Sales Trend' },
  { key: 'collect_today',       label: 'Collect Today' },
  { key: 'top_sold',            label: 'Top Sold Products' },
  { key: 'recent_transactions', label: 'Recent Transactions' },
  { key: 'low_stock',           label: 'Low Stock Alert' },
  { key: 'expiring',            label: 'Expiring Medicines' },
  { key: 'today_items',         label: "Today's Items Sold" },
] as const;

type WidgetKey = (typeof WIDGET_CONFIGS)[number]['key'];

function loadHiddenWidgets(): Set<WidgetKey> {
  try {
    const stored = localStorage.getItem('dashboard_hidden_widgets_v1');
    return stored ? new Set(JSON.parse(stored) as WidgetKey[]) : new Set();
  } catch {
    return new Set();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage
// All heavy child components are wrapped in React.memo in their own files.
// This component itself is kept lean — no local state that would cascade.
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = React.useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = React.useState(false);
  const [hiddenWidgets, setHiddenWidgets] = React.useState<Set<WidgetKey>>(loadHiddenWidgets);
  const customizeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target as Node)) {
        setIsCustomizeOpen(false);
      }
    };
    if (isCustomizeOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isCustomizeOpen]);

  const toggleWidget = (key: WidgetKey) => {
    setHiddenWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem('dashboard_hidden_widgets_v1', JSON.stringify([...next]));
      return next;
    });
  };

  const show = (key: WidgetKey) => !hiddenWidgets.has(key);

  return (
    <PageShell width="full">
      <section className="dashboard-hero">
        {/* Mobile View: Logo, Shop Name, Branch Dropdown & Header Tools */}
        <div className="dashboard-hero__content flex-1 min-w-0 lg:hidden flex justify-between items-center w-full">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/logo.png" alt="AquaDealers" className="h-11 w-11 shrink-0 rounded-xl bg-white p-1.5 shadow-sm" />
            <div className="min-w-0 pr-2">
              <div className="dashboard-hero__eyebrow !mb-0.5 truncate">{user?.shop_name || 'AquaDealers'}</div>
              {/* BranchDropdown has its own isolated state */}
              <BranchDropdown />
            </div>
          </div>
          
          {/* Header Tools */}
          <div className="flex items-center gap-1.5 shrink-0 relative">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 bg-white/5 hover:bg-white/10 hover:text-white transition-all focus:outline-none"
              aria-label="Search"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            <SyncStatusIndicator />
            <button
              type="button"
              onClick={() => setIsCustomizeOpen(o => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 bg-white/5 hover:bg-white/10 hover:text-white transition-all focus:outline-none"
              aria-label="Customize dashboard"
            >
              <Settings2 className="h-4.5 w-4.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(o => !o)}
                className={cn(
                  "relative flex h-9 w-9 items-center justify-center rounded-full transition-all focus:outline-none",
                  hasUnreadNotifications ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20" : "text-white/80 bg-white/5 hover:bg-white/10 hover:text-white"
                )}
                aria-label="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
                {hasUnreadNotifications && (
                  <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(47,60,77,1)]"></span>
                )}
              </button>
              <NotificationsDropdown 
                isOpen={isNotificationsOpen} 
                onClose={() => setIsNotificationsOpen(false)} 
                hasUnread={hasUnreadNotifications}
                onMarkAllRead={() => setHasUnreadNotifications(false)}
              />
            </div>
          </div>
        </div>

        {/* Desktop View: Page Title & Header Tools */}
        <div className="hidden lg:flex justify-between items-center w-full">
          <div className="flex-1 min-w-0">
            <h1 className="dashboard-hero__title mt-1">{t('nav.dashboard', 'Dashboard')}</h1>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 bg-white/5 hover:bg-white/10 hover:text-white transition-all focus:outline-none"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <SyncStatusIndicator />
            {/* Customize widget visibility */}
            <div className="relative" ref={customizeRef}>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(o => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 bg-white/5 hover:bg-white/10 hover:text-white transition-all focus:outline-none"
                aria-label="Customize dashboard"
              >
                <Settings2 className="h-5 w-5" />
              </button>
              {isCustomizeOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border/80 bg-white p-3 shadow-xl animate-scale-in text-text-primary">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Widgets</span>
                    <button type="button" onClick={() => setIsCustomizeOpen(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {WIDGET_CONFIGS.map((w) => (
                    <label key={w.key} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={show(w.key)}
                        onChange={() => toggleWidget(w.key)}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-slate-700">{w.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(o => !o)}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full transition-all focus:outline-none",
                  hasUnreadNotifications ? "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20" : "text-white/80 bg-white/5 hover:bg-white/10 hover:text-white"
                )}
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {hasUnreadNotifications && (
                  <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_0_2px_rgba(47,60,77,1)]"></span>
                )}
              </button>
              <NotificationsDropdown
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
                hasUnread={hasUnreadNotifications}
                onMarkAllRead={() => setHasUnreadNotifications(false)}
              />
            </div>
          </div>
        </div>
      </section>

      <UniversalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Widget customize panel (mobile — floats below hero) */}
      {isCustomizeOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" onClick={() => setIsCustomizeOpen(false)}>
          <div
            className="w-full rounded-t-2xl border-t border-slate-200 bg-white p-5 pb-safe shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black uppercase tracking-wider text-slate-500">Customize Widgets</span>
              <button type="button" onClick={() => setIsCustomizeOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {WIDGET_CONFIGS.map((w) => (
                <label key={w.key} className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-2.5 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={show(w.key)}
                    onChange={() => toggleWidget(w.key)}
                    className="h-4 w-4 rounded accent-primary cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-slate-700">{w.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden lg:flex flex-col gap-6">
        <div className="dashboard-hero__cards">
          <StatCards />
        </div>

        <div className="grid grid-cols-12 gap-6 items-start">
          <div className="col-span-12 xl:col-span-8 flex flex-col gap-6">
            {show('sales_trend') && <SalesTrend />}
            {(show('collect_today') || show('top_sold')) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {show('collect_today') && <CollectToday />}
                {show('top_sold') && <TopSoldProducts />}
              </div>
            )}
          </div>
          <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
            {show('recent_transactions') && <RecentTransactions />}
            {show('low_stock') && <LowStockAlert />}
            {show('expiring') && <ExpiringMedicines />}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col w-full">
        <div className="w-[100vw] relative left-1/2 -translate-x-1/2 px-4 -mt-7 z-10">
          <StatCards />
        </div>
        <TodaySnapshot />
        <div className="flex flex-col gap-5 mt-5">
          <div className="space-y-5">
            {show('today_items') && <ItemsSoldToday />}
            {show('collect_today') && <CollectToday />}
            {show('recent_transactions') && <RecentTransactions />}
          </div>
          <div className="space-y-5">
            {show('low_stock') && <LowStockAlert />}
            {show('expiring') && <ExpiringMedicines />}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default DashboardPage;
