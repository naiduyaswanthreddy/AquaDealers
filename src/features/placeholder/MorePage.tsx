import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  FileBarChart,
  GitBranch,
  Lock,
  LogOut,
  PiggyBank,
  Settings,
  Users2,
  Wallet,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { usePinStore } from '@/stores/pinStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode, type StaffFeatureKey } from '@/lib/staffAccess';

export const MorePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, session, logout, setUser, setOnboardingComplete, clearSession } = useAuthStore();
  const { isPinSet } = usePinStore();
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const navigate = useNavigate();
  type MenuItem = {
    path: string;
    label: string;
    icon: React.ElementType;
    color: string;
    featureKey?: StaffFeatureKey;
  };

  const handleLogout = async () => {
    if (!window.confirm(t('more.confirmLogout', 'Are you sure you want to sign out?'))) return;
    await logout();
    toast.success(t('more.logoutSuccess', 'Successfully logged out.'));
    navigate('/login');
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: t('more.businessOperations', 'Business Operations'),
      items: [
        { path: '/cashbook', label: t('nav.cashbook', 'Cash Book'), icon: PiggyBank, color: 'bg-success-light text-success', featureKey: 'cashbook' },
        { path: '/expenses', label: t('nav.shopExpenses', 'Shop Expenses'), icon: Wallet, color: 'bg-danger-light text-danger', featureKey: 'expenses' },
        { path: '/suppliers', label: t('nav.suppliersRegistry', 'Suppliers Registry'), icon: Users2, color: 'bg-primary/10 text-primary', featureKey: 'suppliers' },
        { path: '/bills', label: t('nav.allBills', 'All Bills'), icon: ReceiptText, color: 'bg-indigo-100 text-indigo-600', featureKey: 'billHistory' },
      ],
    },
    {
      title: t('more.settingsAdmin', 'Settings & Administration'),
      items: [
        { path: '/reports', label: t('nav.gstAndReports', 'GST & Reports'), icon: FileBarChart, color: 'bg-info-light text-primary', featureKey: 'reports' },
        { path: '/branches', label: t('more.manageShops', 'Manage Shops'), icon: GitBranch, color: 'bg-surface text-text-primary', featureKey: 'branches' },
        { path: '/settings', label: t('nav.appSettings', 'App Settings'), icon: Settings, color: 'bg-warning-light text-warning', featureKey: 'settings' },
        { path: '/staff', label: t('more.staff', 'Staff'), icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700', featureKey: 'staffManagement' },
      ],
    },
  ];

  return (
    <PageShell width="full">
      <PageHeader eyebrow={t('more.workspace', 'Workspace')} title={t('nav.more', 'More')} />

      {user ? (
        <div className="overflow-hidden rounded-[var(--card-radius)] bg-gradient-to-br from-primary to-primary-light p-[clamp(1rem,2.5vw,1.5rem)] text-white shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15 text-xl font-bold">
              {getInitials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold tracking-[-0.03em]">{user.shop_name}</h2>
              <p className="mt-1 truncate text-sm text-white/85">{user.name} • {user.phone}</p>
              <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em]">
                {user.plan} {t('more.account', 'account')}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentStaff ? (
        <div className="rounded-[var(--card-radius)] border border-emerald-200 bg-emerald-50 p-[clamp(1rem,2.5vw,1.25rem)] text-emerald-950 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                Staff Mode
              </div>
              <div className="mt-3 text-lg font-black tracking-[-0.03em]">{currentStaff.name}</div>
              <p className="mt-1 text-sm text-emerald-900/75">
                Staff permissions are active. Only allowed features are shown below.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                useStaffStore.getState().clearStaffSession();
                if (!session) {
                  setUser(null);
                  setOnboardingComplete(false);
                  clearSession();
                  navigate('/login');
                }
              }}
            >
              Exit Staff Mode
            </Button>
          </div>
        </div>
      ) : null}


      {menuSections.map((section) => (
        <SectionCard key={section.title} title={section.title}>
          <div className="grid grid-cols-2 gap-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              const mode = item.featureKey
                ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
                : 'visible';

              if (mode === 'hidden') return null;

              if (mode === 'disabled') {
                return (
                  <div key={item.path} className="focus-ring flex flex-col items-start gap-3 rounded-2xl border border-border bg-white p-4 opacity-65">
                    <div className="flex w-full items-start justify-between">
                      <div className={`rounded-2xl p-3 ${item.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <Lock className="h-4 w-4 text-text-muted opacity-50" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary leading-tight">{item.label}</div>
                      <div className="mt-1.5 text-[0.65rem] font-black uppercase tracking-wider text-text-muted">Restricted</div>
                    </div>
                  </div>
                );
              }

              return (
                <Link key={item.path} to={item.path} className="focus-ring flex flex-col items-start gap-3 rounded-2xl border border-border bg-white p-4 hover:border-primary/20 hover:shadow-sm transition-all active:scale-[0.98]">
                  <div className={`rounded-2xl p-3 ${item.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-primary leading-tight">{item.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      ))}

      {isPinSet ? (
        <button 
          type="button" 
          onClick={() => navigate('/settings/security')} 
          className="focus-ring group relative overflow-hidden flex w-full items-center justify-between gap-4 rounded-3xl p-5 text-left transition-all hover:scale-[0.99] active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.24)' }}
        >
          {/* Subtle glow effect */}
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl transition-opacity group-hover:bg-emerald-500/30"></div>
          
          <div className="relative flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-inner backdrop-blur-md border border-white/10">
              <Lock className="h-6 w-6 text-emerald-400 drop-shadow-sm" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-white">{t('more.lockScreen', 'Lock screen now')}</div>
              <div className="mt-1 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                PIN, timeout & lock options
              </div>
            </div>
          </div>
          <ChevronRight className="relative h-6 w-6 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-slate-300" />
        </button>
      ) : null}

      <Button variant="ghost" className="mt-2 text-rose-700 border border-rose-200 shadow-sm transition-colors font-bold" style={{ backgroundColor: '#ffe4e6' }} size="lg" fullWidth leftIcon={<LogOut className="h-5 w-5" />} onClick={handleLogout}>
        {t('more.logout', 'Logout from Shop')}
      </Button>
    </PageShell>
  );
};

export default MorePage;
