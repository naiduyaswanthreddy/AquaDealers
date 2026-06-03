import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '@/lib/constants';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { cn } from '@/lib/utils';

const isCenterItem = (item: any): boolean =>
  'isCenter' in item && item.isCenter === true;

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const currentStaff = useStaffStore((state) => state.currentStaff);

  // Hide bottom nav on full-screen billing/purchasing wizard steps to allow space for checkout bars
  if (location.pathname === '/bills/new' || location.pathname === '/purchases/new') {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/98 shadow-[0_-10px_26px_rgba(20,54,84,0.08)] pb-[var(--safe-bottom)] lg:hidden">
      <div className="mx-auto max-w-[var(--page-max-width)] h-[var(--app-bottom-nav-height,4.85rem)]">
        <div className="relative flex h-full items-center justify-center px-1">
          <div className="absolute inset-x-0 top-0 h-px bg-border/70" />
          <div className="grid h-full w-full grid-cols-5 items-end pb-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const label = (item as any).label === 'New Bill' || (item as any).label === 'Bill' ? 'BILL' : (item as any).label.toUpperCase();
              const mode = item.featureKey
                ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
                : 'visible';

              if (mode === 'hidden' && !item.alwaysVisible) {
                return <div key={item.path} className="h-full w-full" />;
              }
              
              if (isCenterItem(item)) {
                return (
                  mode === 'visible' ? (
                    <div key={item.path} className="relative z-10 flex h-full flex-col items-center justify-end gap-1 pb-1">
                      <span className="mt-auto text-[0.78rem] font-extrabold tracking-[0.08em] text-primary uppercase">
                        {t(`nav.${label.toLowerCase()}`, label) as string}
                      </span>
                    </div>
                  ) : (
                    <div key={item.path} className="relative z-10 flex h-full flex-col items-center justify-end gap-1 pb-1 opacity-60">
                      <span className="mt-auto text-[0.78rem] font-extrabold tracking-[0.08em] text-text-muted uppercase">
                        {t(`nav.${label.toLowerCase()}`, label) as string}
                      </span>
                    </div>
                  )
                );
              }

              if (mode === 'disabled') {
                return (
                  <button
                    key={item.path}
                    type="button"
                    disabled
                    className="focus-ring mt-auto flex h-full flex-col items-center justify-end gap-1 rounded-xl pb-1 text-[0.78rem] font-bold tracking-[0.06em] uppercase text-text-muted opacity-60"
                  >
                    <Icon className="mb-0.5 h-[1.45rem] w-[1.45rem] stroke-[2]" />
                    <span>{t(`nav.${label.toLowerCase()}`, label) as string}</span>
                  </button>
                );
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring mt-auto flex h-full flex-col items-center justify-end gap-1 rounded-xl pb-1 text-[0.78rem] font-bold tracking-[0.06em] uppercase transition-all',
                      isActive ? 'text-blue-600 font-extrabold' : 'text-text-secondary hover:text-blue-600'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('mb-0.5 h-[1.45rem] w-[1.45rem]', isActive ? 'stroke-[2.5] text-blue-600' : 'stroke-[2] text-text-secondary')} />
                      <span>{t(`nav.${label.toLowerCase()}`, label) as string}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {NAV_ITEMS.map((item) => {
            if (!isCenterItem(item)) {
              return null;
            }

            const Icon = item.icon;
            const label = (item as any).label === 'New Bill' || (item as any).label === 'Bill' ? 'BILL' : (item as any).label.toUpperCase();
            const mode = item.featureKey
              ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
              : 'visible';

            if (mode === 'hidden' && !item.alwaysVisible) {
              return null;
            }

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="focus-ring absolute bottom-[1.6rem] left-1/2 z-30 flex h-[4.5rem] w-[4.5rem] -translate-x-1/2 items-center justify-center rounded-full border-[5px] border-white shadow-[0_14px_28px_rgba(20,103,159,0.28)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: 'var(--color-primary)',
                  color: '#ffffff',
                }}
                aria-label={t(`nav.${label.toLowerCase()}`, label) as string}
                disabled={mode !== 'visible'}
              >
                <Icon className="h-7 w-7 stroke-[2.8]" style={{ color: '#ffffff' }} />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
