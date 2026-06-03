import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { getStaffFeatureMode } from '@/lib/staffAccess';
import { cn } from '@/lib/utils';

const DesktopNav: React.FC = () => {
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
    <header className="desktop-nav">
      <div className="desktop-nav__inner">
        <div className="desktop-nav__brand">
          <div className="desktop-nav__logo flex items-center justify-center p-1 bg-white" style={{ borderRadius: '1rem' }}>
            <img src="/logo.png" alt="AquaDealer Logo" className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="desktop-nav__eyebrow truncate">{user?.shop_name || user?.name || 'Dealer'}</div>
            <div className="desktop-nav__title truncate">
              {activeBranch?.name || 'Dealer Workspace'}
            </div>
          </div>
        </div>

        <nav className="desktop-nav__links" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isCenterItem = 'isCenter' in item && item.isCenter;
            const label = t(`nav.${item.label.toLowerCase()}`, item.label) as string;
            const mode = item.featureKey
              ? getStaffFeatureMode(item.featureKey, currentStaff?.permissions, !!currentStaff)
              : 'visible';

            if (mode === 'hidden' && !item.alwaysVisible) {
              return null;
            }

            if (isCenterItem) {
              return (
                mode === 'visible' ? (
                  <button
                    key={item.path}
                    type="button"
                    className="desktop-nav__link desktop-nav__link--center"
                    onClick={() => navigate(item.path)}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{label}</span>
                  </button>
                ) : (
                  <button
                    key={item.path}
                    type="button"
                    disabled
                    className="desktop-nav__link desktop-nav__link--center cursor-not-allowed opacity-60"
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{label}</span>
                  </button>
                )
              );
            }

            if (mode === 'disabled') {
              return (
                <button
                  key={item.path}
                  type="button"
                  disabled
                  className="desktop-nav__link cursor-not-allowed opacity-60"
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{label}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn('desktop-nav__link', isActive && 'desktop-nav__link--active')
                }
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="desktop-nav__actions">
          {user && branches.length > 0 ? (
            <div className="desktop-nav__branch">
              <select
                value={isAllBranches ? 'all' : activeBranch?.id || ''}
                onChange={handleBranchChange}
                className="focus-ring desktop-nav__select"
              >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
                {!currentStaff ? <option value="all">All Shops</option> : null}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            </div>
          ) : null}

        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
