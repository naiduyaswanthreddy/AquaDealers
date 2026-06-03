import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
  const isFullScreenRoute = pathname.startsWith('/bills/new') || pathname.startsWith('/purchases/new');

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
          isFullScreenRoute 
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
