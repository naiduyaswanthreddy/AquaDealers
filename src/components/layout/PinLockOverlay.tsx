import React, { useState, useEffect } from 'react';
import { Lock, Delete, LogOut } from 'lucide-react';
import { usePinStore } from '@/stores/pinStore';
import { useAuthStore } from '@/stores/authStore';
import { useStaffStore } from '@/stores/staffStore';
import { cn, hashPin } from '@/lib/utils';
import { ConfirmModal } from '@/components/ui';

export const PinLockOverlay: React.FC = () => {
  const { isLocked, isPinSet, unlock, checkIdleTimeout, recordActivity } = usePinStore();
  const { user, logout } = useAuthStore();
  const isStaffMode = useStaffStore((state) => !!state.currentStaff);
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);

  // Setup idle activity listener and timeout checks
  useEffect(() => {
    if (!isPinSet) return;

    const handleActivity = () => {
      recordActivity();
    };

    // Listen to user interactions
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Run idle check every 30 seconds
    const interval = setInterval(() => {
      checkIdleTimeout();
    }, 30000);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [isPinSet, recordActivity, checkIdleTimeout]);



  // Handle PIN code entry
  const handleKeypadPress = (digit: string) => {
    if (error) setError(false);
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);

      // Verify on 4th digit
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (error) setError(false);
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
    }
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Handle keyboard input
  useEffect(() => {
    if (!isLocked || !isPinSet || isStaffMode || isLogoutModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isPinSet, isStaffMode, isLogoutModalOpen, pin, error]);

  const verifyPin = async (enteredPin: string) => {
    if (!user?.pin_hash) {
      // If there's no pin_hash, something is wrong with state (isPinSet shouldn't be true)
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 600);
      return;
    }

    const hashedEnteredPin = await hashPin(enteredPin);

    if (hashedEnteredPin === user.pin_hash) {
      setPin('');
      setError(false);
      unlock();
    } else {
      // Trigger error shake
      setError(true);
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 600);
    }
  };

  const handleLogout = async () => {
    setPin('');
    setError(false);
    await logout();
    unlock(); // Dismiss overlay after logout
  };

  // Only render if locked and PIN has been set
  if (!isLocked || !isPinSet || isStaffMode) return null;

  return (
    <div className="fixed inset-0 bg-[#0F172A] z-99 flex flex-col justify-between items-center py-12 px-6 select-none animate-fade-in text-white">
      {/* Top Section */}
      <div className="flex flex-col items-center mt-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white shadow-lg mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          {user?.shop_name || 'AquaDealer'}
        </h1>
        <p className="text-sm text-slate-400">
          Enter 4-digit PIN to unlock
        </p>
      </div>

      {/* Middle Section — PIN dots */}
      <div className="flex flex-col items-center w-full">
        <div
          className={cn(
            'flex gap-6 mb-4 justify-center items-center h-8',
            error && 'animate-[shake_0.4s_ease-in-out]'
          )}
        >
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-150',
                error
                  ? 'border-red-500 bg-red-500'
                  : pin.length > idx
                  ? 'border-primary-light bg-primary-light scale-110 shadow-[0_0_8px_rgba(43,140,208,0.5)]'
                  : 'border-slate-600 bg-transparent'
              )}
            />
          ))}
        </div>
        <div className="h-6">
          {error && <span className="text-red-500 text-sm font-semibold animate-pulse">Wrong PIN</span>}
        </div>
      </div>

      {/* Keypad Section */}
      <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-4 gap-x-6">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleKeypadPress(digit)}
            className="w-16 h-16 text-2xl font-bold rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-colors focus:outline-none"
          >
            {digit}
          </button>
        ))}

        {/* Empty space/placeholder */}
        <div className="w-16 h-16" />

        <button
          type="button"
          onClick={() => handleKeypadPress('0')}
          className="w-16 h-16 text-2xl font-bold rounded-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-colors focus:outline-none"
        >
          0
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="w-16 h-16 rounded-full bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-colors text-slate-300 focus:outline-none"
          aria-label="Delete"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Section — Logout */}
      <button
        type="button"
        onClick={() => setIsLogoutModalOpen(true)}
        className="flex items-center gap-2 text-sm font-semibold text-rose-400 hover:text-rose-200 transition-colors focus:outline-none py-2.5 px-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 active:scale-[0.98]"
      >
        <LogOut className="w-4 h-4" />
        Logout from Shop
      </button>

      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out? You will need your password to log back in."
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
      />
    </div>
  );
};

export default PinLockOverlay;
