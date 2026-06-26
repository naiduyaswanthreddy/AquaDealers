import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PinState {
  isPinSet: boolean;
  isLocked: boolean;
  lastActivity: number;
  timeoutMinutes: number;

  setPinSet: (value: boolean) => void;
  lock: () => void;
  unlock: () => void;
  recordActivity: () => void;
  setTimeoutMinutes: (minutes: number) => void;
  checkIdleTimeout: () => void;
}

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      isPinSet: false,
      isLocked: false,
      lastActivity: Date.now(),
      timeoutMinutes: 5,

      setPinSet: (isPinSet) => set({ isPinSet }),

      lock: () => set({ isLocked: true }),

      unlock: () => set({ isLocked: false, lastActivity: Date.now() }),

      recordActivity: () => set({ lastActivity: Date.now() }),

      setTimeoutMinutes: (timeoutMinutes) => set({ timeoutMinutes }),

      checkIdleTimeout: () => {
        const { isPinSet, isLocked, lastActivity, timeoutMinutes } = get();
        if (!isPinSet || isLocked) return;

        const idleMs = Date.now() - lastActivity;
        const timeoutMs = timeoutMinutes * 60 * 1000;

        if (idleMs >= timeoutMs) {
          set({ isLocked: true });
        }
      },
    }),
    {
      name: 'aquadealers-pin',
      partialize: (state) => ({
        isPinSet: state.isPinSet,
        timeoutMinutes: state.timeoutMinutes,
        lastActivity: state.lastActivity,
      }),
    }
  )
);
