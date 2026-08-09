import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  FileBarChart,
  GitBranch,
  Lock,
  LogOut,
  NotebookPen,
  PiggyBank,
  Settings,
  Users2,
  Wallet,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
  ArrowLeftRight,
  Undo2,
  History,
  FileText,
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
    description?: string;
    icon: React.ElementType;
    color: string;
    cardBg: string;
    chevronBg: string;
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
      title: 'Money & Daily Operations',
      items: [
        { path: '/book', label: t('nav.dailyBook', 'Daily Book'), description: 'Record and track all daily transactions easily', icon: NotebookPen, color: 'bg-amber-100 text-amber-700', cardBg: 'bg-amber-50 border-amber-200/60', chevronBg: 'bg-amber-100 text-amber-600', featureKey: 'reports' },
        { path: '/cashbook', label: t('nav.cashbook', 'Cash Book'), description: 'Manage cash in hand and track cash flow', icon: PiggyBank, color: 'bg-success-light text-success', cardBg: 'bg-emerald-50 border-emerald-200/60', chevronBg: 'bg-emerald-100 text-emerald-600', featureKey: 'cashbook' },
        { path: '/expenses', label: t('nav.shopExpenses', 'Shop Expenses'), description: 'Track and manage all shop expenses', icon: Wallet, color: 'bg-danger-light text-danger', cardBg: 'bg-rose-50 border-rose-200/60', chevronBg: 'bg-rose-100 text-rose-500', featureKey: 'expenses' },
      ],
    },
    {
      title: 'Goods & Supply Chain',
      items: [
        { path: '/suppliers', label: t('nav.suppliersRegistry', 'Suppliers Registry'), description: 'View and manage your suppliers list', icon: Users2, color: 'bg-primary/10 text-primary', cardBg: 'bg-blue-50 border-blue-200/60', chevronBg: 'bg-blue-100 text-blue-600', featureKey: 'suppliers' },
        { path: '/transfers', label: 'Stock Transfers', description: 'Transfer stock between branches', icon: ArrowLeftRight, color: 'bg-sky-100 text-sky-700', cardBg: 'bg-sky-50 border-sky-200/60', chevronBg: 'bg-sky-100 text-sky-600', featureKey: 'inventory' },
        { path: '/inventory/rate-adjustment', label: 'Rate Diff Tool', description: 'Adjust and compare product rates', icon: TrendingUp, color: 'bg-violet-100 text-violet-600', cardBg: 'bg-violet-50 border-violet-200/60', chevronBg: 'bg-violet-100 text-violet-600' },
      ],
    },
    {
      title: 'Records & Bills',
      items: [
        { path: '/estimates', label: 'Estimates', description: 'Create and view price estimates', icon: FileText, color: 'bg-amber-100 text-amber-700', cardBg: 'bg-amber-50 border-amber-200/60', chevronBg: 'bg-amber-100 text-amber-600', featureKey: 'billHistory' as StaffFeatureKey },
        { path: '/bills', label: t('nav.allBills', 'All Bills'), description: 'View and manage all your bills', icon: ReceiptText, color: 'bg-indigo-100 text-indigo-600', cardBg: 'bg-indigo-50 border-indigo-200/60', chevronBg: 'bg-indigo-100 text-indigo-600', featureKey: 'billHistory' },
        { path: '/returns', label: 'Returns', description: 'Handle product returns', icon: Undo2, color: 'bg-orange-100 text-orange-700', cardBg: 'bg-orange-50 border-orange-200/60', chevronBg: 'bg-orange-100 text-orange-600', featureKey: 'billHistory' },
        { path: '/transactions', label: 'Transactions', description: 'Track all transactions', icon: History, color: 'bg-amber-100 text-amber-700', cardBg: 'bg-amber-50 border-amber-200/60', chevronBg: 'bg-amber-100 text-amber-600', featureKey: 'transactions' },
      ],
    },
    {
      title: t('more.settingsAdmin', 'Settings & Administration'),
      items: [
        { path: '/reports', label: t('nav.reports', 'Reports'), description: 'View business reports and analytics', icon: FileBarChart, color: 'bg-info-light text-primary', cardBg: 'bg-blue-50 border-blue-200/60', chevronBg: 'bg-blue-100 text-blue-600', featureKey: 'reports' },
        { path: '/branches', label: t('more.manageShops', 'Manage Shops'), description: 'Manage branches and shops', icon: GitBranch, color: 'bg-surface text-text-primary', cardBg: 'bg-slate-50 border-slate-200/60', chevronBg: 'bg-slate-100 text-slate-500', featureKey: 'branches' },
        { path: '/settings', label: t('nav.appSettings', 'App Settings'), description: 'Configure app preferences', icon: Settings, color: 'bg-warning-light text-warning', cardBg: 'bg-yellow-50 border-yellow-200/60', chevronBg: 'bg-yellow-100 text-yellow-600', featureKey: 'settings' },
        { path: '/staff', label: t('more.staff', 'Staff'), description: 'Manage staff and permissions', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700', cardBg: 'bg-emerald-50 border-emerald-200/60', chevronBg: 'bg-emerald-100 text-emerald-600', featureKey: 'staffManagement' },
      ],
    },
  ];

  return (
    <PageShell width="full">
      <PageHeader title={t('nav.more', 'More')} />

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
          <div className={section.items.length === 3 ? 'grid grid-cols-2 lg:grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
            {section.items.map((item, idx) => {
              const Icon = item.icon;
              const mode = item.featureKey
                ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
                : 'visible';
              const isWide = section.items.length === 3 && idx === 0;
              const spanClass = isWide ? 'col-span-2 lg:col-span-1' : '';

              if (mode === 'hidden') return null;

              if (mode === 'disabled') {
                return (
                  <div key={item.path} className={`focus-ring opacity-65 rounded-2xl border p-4 ${item.cardBg} ${spanClass} ${isWide ? 'flex flex-row items-center gap-4' : 'flex flex-col items-start gap-3'}`}>
                    {isWide ? (
                      <>
                        <div className={`rounded-2xl p-4 ${item.color} flex-shrink-0`}><Icon className="h-8 w-8" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-bold text-slate-900 leading-tight">{item.label}</div>
                        </div>
                        <Lock className="h-5 w-5 text-slate-400 flex-shrink-0" />
                      </>
                    ) : (
                      <>
                        <div className={`rounded-2xl p-3 ${item.color}`}><Icon className="h-6 w-6" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 leading-tight">{item.label}</div>
                                                  </div>
                        <div className="text-[0.6rem] font-black uppercase tracking-wider text-slate-400">Restricted</div>
                      </>
                    )}
                  </div>
                );
              }

              return (
                <Link key={item.path} to={item.path} className={`focus-ring rounded-2xl border transition-all active:scale-[0.98] hover:shadow-md p-4 ${item.cardBg} ${spanClass} ${isWide ? 'flex flex-row items-center gap-4' : 'flex flex-col items-start gap-3'}`}>
                  {isWide ? (
                    <>
                      <div className={`rounded-2xl p-4 ${item.color} flex-shrink-0`}><Icon className="h-8 w-8" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-bold text-slate-900 leading-tight">{item.label}</div>
                                              </div>
                    </>
                  ) : (
                    <>
                      <div className={`rounded-2xl p-3 ${item.color}`}><Icon className="h-6 w-6" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 leading-tight">{item.label}</div>
                                              </div>
                    </>
                  )}
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

      <VersionFooter />
    </PageShell>
  );
};

interface VersionInfo { version: string; build: number; commit: string; builtAt: string; }

const VersionFooter: React.FC = () => {
  const [info, setInfo] = React.useState<VersionInfo | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    fetch('/version.json', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setInfo(d))
      .catch(() => { /* silent — version is nice-to-have */ });
  }, []);

  const copy = async () => {
    if (!info) return;
    const line = `AquaDealer v${info.version} · build #${info.build} · ${info.commit} · ${info.builtAt}`;
    try { await navigator.clipboard.writeText(line); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* no-op */ }
  };

  if (!info) return null;
  return (
    <button
      type="button"
      onClick={copy}
      title="Tap to copy build info"
      className="mt-6 mx-auto block text-center text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
    >
      v{info.version} · build #{info.build} · <span className="font-mono">{info.commit}</span>
      {copied && <span className="ml-2 text-emerald-600">copied ✓</span>}
    </button>
  );
};

export default MorePage;
