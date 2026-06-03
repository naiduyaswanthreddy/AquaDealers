import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AlertTriangle, LogOut } from 'lucide-react';

const ImpersonationBanner: React.FC = () => {
  const { impersonator, setImpersonator, clearSession } = useAuthStore();

  if (!impersonator) return null;

  const handleExit = () => {
    setImpersonator(null);
    clearSession();
    window.close(); // Close the impersonation tab
  };

  return (
    <div className="relative z-[100] flex flex-wrap items-center justify-center gap-4 bg-danger px-4 py-2 text-sm font-semibold text-white shadow-md">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4.5 w-4.5" />
        <span className="text-center">
          Admin Impersonation Mode (Read-Only) — Initiated by {impersonator}
        </span>
      </div>
      <button 
        onClick={handleExit}
        className="focus-ring flex cursor-pointer items-center gap-1.5 rounded bg-white/20 px-3 py-1 text-xs font-bold transition-colors hover:bg-white/30"
      >
        <LogOut className="h-3.5 w-3.5" /> Exit
      </button>
    </div>
  );
};

export default ImpersonationBanner;
