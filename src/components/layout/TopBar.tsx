import React from 'react';
import { Bell, ChevronDown, Store } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';

export const TopBar: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const {
    branches,
    activeBranch,
    isAllBranches,
    setActiveBranch,
    setAllBranches,
  } = useBranchStore();

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'all') {
      setAllBranches(true);
    } else {
      const selected = branches.find((b) => b.id === value);
      if (selected) {
        setActiveBranch(selected);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/86 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[var(--app-topbar-height)] w-full max-w-[var(--page-max-width)] items-center gap-3 px-[var(--page-gutter)]">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-light text-white shadow-[0_12px_24px_rgba(20,103,159,0.2)]">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-primary/75">AquaDealer</div>
            <div className="truncate text-base font-extrabold tracking-[-0.03em] text-text-primary">
              {activeBranch?.name || currentStaff?.name || user?.name || 'Dealer Workspace'}
            </div>
          </div>
        </div>

        {user && branches.length > 0 ? (
          <div className="relative hidden min-w-0 flex-1 items-center sm:flex">
            <select
              value={isAllBranches ? 'all' : activeBranch?.id || ''}
              onChange={handleBranchChange}
              className="focus-ring min-h-11 w-full appearance-none rounded-2xl border border-border bg-surface px-4 pr-10 text-sm font-semibold text-text-primary"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {!currentStaff ? <option value="all">All Shops</option> : null}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-text-muted" />
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="focus-ring relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-text-secondary hover:bg-surface"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
