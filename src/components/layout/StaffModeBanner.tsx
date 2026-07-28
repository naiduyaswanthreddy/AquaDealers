import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, Home } from 'lucide-react';
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
    // Floating pill above bottom nav; on desktop sits at bottom-right of content
    <div className="fixed z-[90] bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] lg:bottom-5 inset-x-0 lg:inset-x-auto lg:right-6 flex justify-center lg:justify-end pointer-events-none px-3">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-md px-3 py-2 max-w-xs w-full lg:w-auto">
        {/* Identity */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.78rem] font-bold text-slate-900 truncate leading-tight">
            {currentStaff.name}
          </div>
          <div className="text-[0.65rem] font-medium text-slate-500 truncate leading-tight">
            Staff · {portalContext.branchName}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="Home"
          >
            <Home className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-[0.72rem] font-bold text-rose-600 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaffModeBanner;
