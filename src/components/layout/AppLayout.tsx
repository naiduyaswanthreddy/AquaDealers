import React, { useEffect } from 'react';
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

export const AppLayout: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const setBranches = useBranchStore((state) => state.setBranches);
  const setActiveBranch = useBranchStore((state) => state.setActiveBranch);
  const setAllBranches = useBranchStore((state) => state.setAllBranches);
  const currentStaff = useStaffStore((state) => state.currentStaff);
  const isExpired = useSubscriptionStore((state) => state.isExpired());
  const dealerId = user?.id || currentStaff?.dealerId || null;
  const navigate = useNavigate();

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

  const { pathname } = useLocation();
  const isFullScreenRoute = false; // We don't have any full screen routes that hide the sidebar anymore? Wait, let's keep it just in case.
  const isNoPaddingRoute = pathname.startsWith('/purchases/new') || pathname.startsWith('/bills/new');

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
        {!isFullScreenRoute && <BottomNav />}
      </div>
    </div>
  );
};

export default AppLayout;
