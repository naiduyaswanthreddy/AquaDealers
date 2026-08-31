import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  WalletCards,
  FileBarChart,
  BookText,
  NotebookPen,
  Truck,
  LayoutGrid,
  Store,
  ChevronsUpDown,
  FileText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode, StaffFeatureKey } from '@/lib/staffAccess';
import { cn } from '@/lib/utils';

interface SidebarItem {
  path: string;
  label: string;
  icon: React.ElementType;
  featureKey?: StaffFeatureKey;
  alwaysVisible?: boolean;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, featureKey: 'dashboard' },
  { path: '/bills', label: 'Billing', icon: Receipt, featureKey: 'billHistory' },
  { path: '/estimates', label: 'Estimates', icon: FileText, featureKey: 'billHistory' },
  { path: '/inventory', label: 'Stock & Purchase', icon: Package, featureKey: 'inventory' },
  { path: '/farmers', label: 'Farmers', icon: Users, featureKey: 'farmerList' },
  { path: '/dues', label: 'Dues', icon: WalletCards, featureKey: 'farmerList' },
  { path: '/book', label: 'Daily Book', icon: NotebookPen, featureKey: 'reports' },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, featureKey: 'suppliers' },
  { path: '/cashbook', label: 'Cashbook', icon: BookText, featureKey: 'cashbook' },
  { path: '/reports', label: 'Reports', icon: FileBarChart, featureKey: 'reports' },
  { path: '/more', label: 'More', icon: LayoutGrid, alwaysVisible: true },
];

const DesktopSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const {
    branches,
    activeBranch,
    isAllBranches,
    setActiveBranch,
    setAllBranches,
  } = useBranchStore();
  const isInvoiceWorkspace = pathname.startsWith('/bills/new');

  const handleBranchChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;

    if (value === 'all') {
      setAllBranches(true);
      return;
    }

    const selectedBranch = branches.find((branch) => branch.id === value);
    if (selectedBranch) {
      setActiveBranch(selectedBranch);
    }
  };

  return (
    <aside
      className={cn(
        'hidden h-dvh sticky top-0 z-50 flex-col border-r border-white/15 text-white shadow-[4px_0_24px_rgba(0,0,0,0.14)] lg:flex',
        isInvoiceWorkspace ? 'w-[4.75rem]' : 'w-60'
      )}
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {/* Header / Logo */}
      <div className={cn('flex items-center py-4', isInvoiceWorkspace ? 'justify-center px-3' : 'gap-3 px-5')}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-2 shadow-lg shadow-black/15 ring-1 ring-white/40">
          <img src="/logo.png" alt="AquaDealers Logo" className="h-5 w-5 object-contain" />
        </div>
        <div className={cn('min-w-0', isInvoiceWorkspace && 'hidden')}>
          <div className="text-xl font-extrabold tracking-tight text-white">AquaDealers</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-0.5 overflow-hidden py-2', isInvoiceWorkspace ? 'px-2' : 'px-3')} aria-label="Sidebar">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
          const mode = item.featureKey
            ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
            : 'visible';

          if (mode === 'hidden' && !item.alwaysVisible) {
            return null;
          }

          if (mode === 'disabled') {
            return (
              <div
                key={item.path}
                className={cn(
                  'flex cursor-not-allowed overflow-hidden rounded-xl text-sm font-semibold text-white/35',
                  isInvoiceWorkspace ? 'flex-col items-center justify-center px-1 py-1.5 gap-0.5' : 'flex-row items-center gap-3 px-3 py-3'
                )}
              >
                <Icon className="h-5 w-5" />
                {isInvoiceWorkspace
                  ? <span className="text-[9px] font-bold leading-tight text-center w-full truncate">{item.label}</span>
                  : <span>{item.label}</span>
                }
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group relative flex overflow-hidden rounded-xl text-sm font-semibold transition-all duration-300',
                  isInvoiceWorkspace
                    ? 'flex-col items-center justify-center px-1 py-1.5 gap-0.5'
                    : 'flex-row items-center gap-3 px-3 py-2.5',
                   isActive
                     ? 'bg-gradient-to-r from-white/25 to-white/5 text-white shadow-lg ring-1 ring-white/30 before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:bg-white'
                     : 'text-white/80 hover:bg-white/12 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-300",
                       isActive ? "scale-110 text-white" : "text-white/60 group-hover:scale-110 group-hover:text-white"
                    )}
                  />
                  {isInvoiceWorkspace
                    ? <span className="text-[9px] font-bold leading-tight text-center w-full truncate">{item.label}</span>
                    : <span className="z-10">{item.label}</span>
                  }
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Profile / Branch Area */}
      {branches.length > 0 && !isInvoiceWorkspace ? (
        <div className="mt-auto border-t border-white/15 bg-black/5 p-3">
          {/* Branch Selector */}
          {branches.length > 0 ? (
            <div className="group/branch rounded-xl border border-white/20 bg-white/10 p-2.5 shadow-sm shadow-black/10 transition-all hover:border-white/40 hover:bg-white/15">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-widest text-white/60 transition-colors group-hover/branch:text-white">
                <Store size={12} /> Active Branch
              </div>
              <div className="relative">
                <select
                  value={isAllBranches ? 'all' : activeBranch?.id || ''}
                  onChange={handleBranchChange}
                  className="block w-full cursor-pointer appearance-none rounded-lg border-none bg-white/15 px-3 py-1.5 pr-8 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:ring-1 focus:ring-white/60"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id} className="font-medium text-slate-700">
                      {branch.name}
                    </option>
                  ))}
                  {!currentStaff ? <option value="all" className="font-bold text-slate-700">All Shops</option> : null}
                </select>
                <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/15 bg-white/15 p-1 shadow-sm">
                  <ChevronsUpDown className="h-3 w-3 text-white/70" />
                </div>
              </div>
            </div>
          ) : null}

        </div>
      ) : null}
    </aside>
  );
};

export default DesktopSidebar;
