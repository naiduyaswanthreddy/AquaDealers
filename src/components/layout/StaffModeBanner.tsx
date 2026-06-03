import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';

const StaffModeBanner: React.FC = () => {
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const setUser = useAuthStore((state) => state.setUser);
  const setOnboardingComplete = useAuthStore((state) => state.setOnboardingComplete);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { currentStaff, portalContext, clearStaffSession } = useStaffStore();

  if (!currentStaff || !portalContext) return null;

  const handleExit = () => {
    clearStaffSession();
    if (session) {
      navigate('/more');
      return;
    }

    setUser(null);
    setOnboardingComplete(false);
    clearSession();
    navigate('/login');
  };

  return (
    <div className="relative z-[100] flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <ShieldCheck className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-emerald-950">
            Staff Mode · {currentStaff.name}
          </div>
          <div className="truncate text-xs font-medium text-emerald-800/85">
            {portalContext.shopName} · {portalContext.branchName}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
        >
          Home
        </button>
        <button
          type="button"
          onClick={handleExit}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          Exit Staff Mode
        </button>
      </div>
    </div>
  );
};

export default StaffModeBanner;
