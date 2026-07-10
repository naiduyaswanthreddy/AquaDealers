import React, { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import ImpersonationBanner from './ImpersonationBanner';
import StaffModeBanner from './StaffModeBanner';
import BottomNav from './BottomNav';
import DesktopSidebar from './DesktopSidebar';
import { useAuthStore } from '@/stores/authStore';
import { useBranchStore } from '@/stores/branchStore';
import { useStaffStore } from '@/stores/staffStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { inventoryService } from '@/features/inventory/services/inventoryService';
import { toast } from 'sonner';
import { useOfflineBillSync } from '@/features/billing/offline/useOfflineBillSync';
import { applyBranchTheme } from '@/lib/branchTheme';

export const AppLayout: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  useOfflineBillSync();

  const activeBranch = useBranchStore((state) => state.activeBranch);
  const isAllBranches = useBranchStore((state) => state.isAllBranches);

  // Re-theme the app to the active branch's color; default blue for "All Shops".
  useEffect(() => {
    applyBranchTheme(isAllBranches ? null : activeBranch?.color);
    return () => applyBranchTheme(null);
  }, [activeBranch?.color, isAllBranches]);
  const setBranches = useBranchStore((state) => state.setBranches);
  const setActiveBranch = useBranchStore((state) => state.setActiveBranch);
  const setAllBranches = useBranchStore((state) => state.setAllBranches);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const portalContext = useStaffStore((state) => state.portalContext);
  const clearStaffSession = useStaffStore((state) => state.clearStaffSession);
  const isExpired = useSubscriptionStore((state) => state.isExpired());
  // In staff mode the staff's shop always wins — a dealer profile left in
  // state must never redirect reads/writes to a different shop.
  const dealerId = currentStaff?.dealerId || user?.id || null;
  const navigate = useNavigate();
  const hasProcessedExpiry = useRef(false);

  // Staff sessions are real server-side sessions now: re-validate on app start
  // and tab focus so deactivating a staff member or resetting their PIN ends
  // their session on the next check.
  useEffect(() => {
    if (!currentStaff) return;

    let cancelled = false;

    const endStaffSession = () => {
      const portalUrl = portalContext?.portalUrl || '/';
      const auth = useAuthStore.getState();
      clearStaffSession();
      if (!auth.session) {
        auth.setUser(null);
        auth.setOnboardingComplete(false);
        auth.clearSession();
      }
      toast.error('Your staff session has ended. Please enter your PIN again.');
      navigate(portalUrl, { replace: true });
    };

    const validate = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      // Sessions saved before the security update carry no token — re-login.
      if (!currentStaff.sessionToken) {
        endStaffSession();
        return;
      }

      try {
        const { data, error } = await supabase.rpc('staff_validate_session', {
          p_token: currentStaff.sessionToken,
        });
        if (cancelled || error) return; // network/server errors: keep working
        if (!data) endStaffSession();
      } catch {
        // Ignore transient failures; the next focus re-checks.
      }
    };

    validate();
    window.addEventListener('focus', validate);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', validate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStaff?.sessionToken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcut when typing in inputs/textareas
      const activeEl = document.activeElement as HTMLElement;
      const isInput = activeEl.tagName === 'INPUT' || 
                      activeEl.tagName === 'TEXTAREA' || 
                      activeEl.isContentEditable;
      
      if (isInput) return;

      // Global shortcut: press 'b' for new bill/invoice
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        navigate('/bills/new');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (!dealerId) return;

    const loadBranches = async () => {
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('dealer_id', dealerId)
          .eq('is_active', true)
          .order('is_main', { ascending: false });

        if (error) throw error;
        if (data) {
          const nextBranches = currentStaff?.branchIds.length
            ? data.filter((branch) => currentStaff.branchIds.includes(branch.id))
            : data;

          setBranches(nextBranches);

          if (currentStaff) {
            const selected =
              nextBranches.find((branch) => branch.id === currentStaff.branchId) ||
              nextBranches.find((branch) => branch.is_main) ||
              nextBranches[0] ||
              null;

            setAllBranches(false);
            setActiveBranch(selected);
          }
        }
      } catch (err) {
        console.error('Failed to load branches in AppLayout:', err);
      }
    };

    loadBranches();
  }, [dealerId, currentStaff, setBranches, setActiveBranch, setAllBranches]);

  // Auto-process expired inventory lots on app load (once per session)
  useEffect(() => {
    if (!dealerId || hasProcessedExpiry.current) return;
    hasProcessedExpiry.current = true;

    const processExpiry = async () => {
      try {
        const count = await inventoryService.processExpiredLots(dealerId);
        if (count > 0) {
          toast(`${count} expired lot${count > 1 ? 's' : ''} removed from stock`, {
            icon: '⚠️',
            duration: 5000,
          });
        }
      } catch (err) {
        // Silent fail — don't block app usage for expiry processing
        console.error('Failed to process expired lots:', err);
      }
    };

    processExpiry();
  }, [dealerId]);

  const { pathname } = useLocation();
  const isFullScreenRoute = false; // We don't have any full screen routes that hide the sidebar anymore? Wait, let's keep it just in case.
  // Daily Book pages own their full "paper" surface and hide the bottom nav
  // so the register metaphor stays unbroken.
  const isBookRoute = pathname === '/book' || pathname.startsWith('/book/');
  const isNoPaddingRoute = pathname.startsWith('/bills/new') || isBookRoute;

  return (
    <div className="min-h-dvh bg-transparent text-text-primary overflow-x-clip lg:flex">
      {!isFullScreenRoute && <DesktopSidebar />}
      
      <div className="flex-1 flex flex-col min-w-0">
        {isExpired && (
          <div className="bg-red-600 text-white p-3 text-center text-sm font-semibold sticky top-0 z-[100] shadow-md flex justify-center items-center gap-2">
            <span className="animate-pulse">⚠️</span> 
            Your subscription has expired. The app is in Read-Only mode. Please contact Admin/Sales to renew.
          </div>
        )}
        <StaffModeBanner />
        <ImpersonationBanner />
        
        <main className={cn(
          "mx-auto w-full flex-1",
          isFullScreenRoute || isNoPaddingRoute
            ? "p-0 max-w-none" 
            : "content-safe-bottom max-w-[var(--page-max-width)] px-[var(--page-gutter)] pt-0 pb-6 lg:max-w-[var(--page-max-width-desktop)] lg:pt-6 lg:px-8"
        )}>
          <Outlet />
        </main>
        {!isFullScreenRoute && !isBookRoute && <BottomNav />}
      </div>
    </div>
  );
};

export default AppLayout;
