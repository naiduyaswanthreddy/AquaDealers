import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { cn } from '@/lib/utils';
import CollectToday from '../components/CollectToday';
import ExpiringMedicines from '../components/ExpiringMedicines';
import LowStockAlert from '../components/LowStockAlert';
import RecentTransactions from '../components/RecentTransactions';
import StatCards from '../components/StatCards';
import TodaySnapshot from '../components/TodaySnapshot';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { branches, activeBranch, setActiveBranch, isAllBranches, setAllBranches } = useBranchStore();
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitials =
    (user?.name || user?.shop_name || 'AD')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AD';

  return (
    <PageShell width="full">
      <section className="dashboard-hero">
        {/* Mobile View: Logo, Shop Name, Branch Dropdown */}
        <div className="dashboard-hero__content flex-1 min-w-0 lg:hidden">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AquaDealer" className="h-11 w-11 shrink-0 rounded-xl bg-white p-1.5 shadow-sm" />
            <div className="min-w-0">
              <div className="dashboard-hero__eyebrow !mb-0.5 truncate">{user?.shop_name || 'AquaDealer'}</div>
              <div className="dashboard-hero__branch-row relative inline-block" ref={dropdownRef}>
              {branches.length > 1 ? (
                <button
                  type="button"
                  className="dashboard-hero__branch-trigger flex items-center gap-1.5 cursor-pointer focus:outline-none"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {isAllBranches ? t('dashboard.allBranches', 'All Branches') : (activeBranch?.name || t('dashboard.mainShop', 'Main Shop'))}
                  </h1>
                  <ChevronDown className={cn("dashboard-hero__chevron transition-transform duration-200 mt-1", isDropdownOpen && "rotate-180")} aria-hidden="true" />
                </button>
              ) : (
                <div className="dashboard-hero__branch-trigger flex items-center gap-1.5">
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {activeBranch?.name || t('dashboard.mainShop', 'Main Shop')}
                  </h1>
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
                      onClick={() => {
                        setAllBranches(true);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer",
                        isAllBranches 
                          ? "bg-slate-100 text-primary font-bold" 
                          : "text-text-primary hover:bg-slate-50"
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
                        onClick={() => {
                          setActiveBranch(branch);
                          setIsDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer",
                          isActive 
                            ? "bg-slate-100 text-primary font-bold" 
                            : "text-text-primary hover:bg-slate-50"
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
            </div>
          </div>
        </div>

        {/* Desktop View: Just the Page Title */}
        <div className="hidden lg:block flex-1 min-w-0">
          <h1 className="dashboard-hero__title mt-1">{t('nav.dashboard', 'Dashboard')}</h1>
        </div>

        {/* Profile Avatar - always rightmost */}
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="dashboard-hero__avatar shrink-0 cursor-pointer focus:outline-none transition-transform hover:scale-[1.05] lg:hidden"
          aria-label={user?.name || 'Dealer'}
        >
          {userInitials}
        </button>
      </section>

      {/* Desktop Redesign */}
      <div className="hidden lg:flex flex-col gap-6 mt-4">
        {/* Top Stats */}
        <div className="dashboard-hero__cards">
          <StatCards />
        </div>
        
        {/* Main Grid Content */}
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* Recent Bills */}
          <div className="col-span-12 xl:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
            <h3 className="text-lg font-bold text-slate-800 mb-6">Recent Bills</h3>
            <RecentTransactions />
          </div>

          {/* Sales Trend */}
          <div className="col-span-12 xl:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-slate-800">Sales Trend</h3>
              <span className="text-sm text-slate-500 font-medium">This Month ▾</span>
            </div>
            {/* CSS Bar Chart mimicking the reference image */}
            <div className="flex-1 flex items-end gap-3 justify-between pt-8 mt-auto h-48">
              {[50, 70, 30, 80, 50, 90, 100, 60, 40].map((h, i) => (
                <div key={i} className="w-full max-w-[2.5rem] bg-[#F4F7FB] rounded-t-lg h-full flex flex-col justify-end relative overflow-hidden">
                  <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{ height: `${h}%` }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className="col-span-12 xl:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Top Products</h3>
              <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View All</button>
            </div>
            <div className="space-y-5">
              {[
                { name: 'CP 9951 Starter', qty: '120 bags' },
                { name: 'Growel Feed', qty: '85 bags' },
                { name: 'Bayer Medicine', qty: '45 btls' }
              ].map((product, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-100 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src="/logo.png" alt="Product" className="h-8 w-8 object-contain opacity-50" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{product.qty}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Original View */}
      <div className="lg:hidden block">
        <div className="dashboard-hero__cards">
          <StatCards />
        </div>
        <TodaySnapshot />

        <div className="grid gap-5 mt-5">
          <div className="space-y-5">
            <CollectToday />
            <RecentTransactions />
          </div>
          <div className="space-y-5">
            <LowStockAlert />
            <ExpiringMedicines />
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export default DashboardPage;
