import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  WalletCards,
  FileBarChart,
  CircleDollarSign,
  Settings,
  ChevronDown,
  BookText,
  Truck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
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
  { path: '/inventory', label: 'Inventory', icon: Package, featureKey: 'inventory' },
  { path: '/bills', label: 'Billing', icon: Receipt, featureKey: 'billHistory' },
  { path: '/farmers', label: 'Customers', icon: Users, featureKey: 'farmerList' },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, featureKey: 'suppliers' },
  { path: '/dues', label: 'Dues', icon: WalletCards, featureKey: 'farmerList' },
  { path: '/cashbook', label: 'Cashbook', icon: BookText, featureKey: 'cashbook' },
  { path: '/reports', label: 'Reports', icon: FileBarChart, featureKey: 'reports' },
  { path: '/expenses', label: 'Expenses', icon: CircleDollarSign, featureKey: 'expenses' },
  { path: '/settings', label: 'Settings', icon: Settings, featureKey: 'settings' },
];

const DesktopSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const {
    branches,
    activeBranch,
    isAllBranches,
    setActiveBranch,
    setAllBranches,
  } = useBranchStore();

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
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 h-dvh sticky top-0 z-50">
      <div className="flex items-center p-6 gap-3">
        <div className="flex items-center justify-center bg-blue-600 rounded-xl p-2 w-10 h-10">
          <img src="/logo.png" alt="AquaDealer Logo" className="h-6 w-6 object-contain filter brightness-0 invert" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold text-slate-900 truncate tracking-tight">AquaDealer</div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto" aria-label="Sidebar">
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
                className="flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg text-slate-400 cursor-not-allowed opacity-60"
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {user && branches.length > 0 ? (
        <div className="p-4 mt-auto border-t border-slate-100">
          <div className="text-xs font-medium text-slate-400 mb-2 px-1 uppercase tracking-wider">Branch</div>
          <div className="relative">
            <select
              value={isAllBranches ? 'all' : activeBranch?.id || ''}
              onChange={handleBranchChange}
              className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 transition-colors hover:bg-slate-100 outline-none"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
              {!currentStaff ? <option value="all">All Shops</option> : null}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <div className="mt-4 flex items-center gap-3 px-1">
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-600 font-bold uppercase text-xs">
              {user.name?.charAt(0) || user.shop_name?.charAt(0) || 'D'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{user.name || 'Dealer'}</div>
              <div className="text-xs text-slate-500 truncate">{user.shop_name || 'AquaDealer'}</div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
};

export default DesktopSidebar;
