import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdminUser } from '../types';
import { setAdminSessionToken } from '@/lib/sessionTokens';

interface AdminAuthState {
  adminUser: AdminUser | null;
  isAuthenticated: boolean;
  sessionToken: string | null;

  setAdminUser: (user: AdminUser | null) => void;
  login: (user: AdminUser) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser: null,
      isAuthenticated: false,
      sessionToken: null,

      setAdminUser: (user) => set({ adminUser: user, isAuthenticated: !!user }),

      // admin_login returns a session_token column; keep it so every admin RPC
      // can prove the session server-side (sent as the x-admin-token header).
      login: (user) => {
        const token = (user as AdminUser & { session_token?: string }).session_token || null;
        setAdminSessionToken(token);
        set({ adminUser: user, isAuthenticated: true, sessionToken: token });
      },

      logout: () => {
        setAdminSessionToken(null);
        set({ adminUser: null, isAuthenticated: false, sessionToken: null });
      },
    }),
    {
      name: 'aquadealers-admin-auth',
      partialize: (state) => ({
        adminUser: state.adminUser,
        isAuthenticated: state.isAuthenticated,
        sessionToken: state.sessionToken,
      }),
      onRehydrateStorage: () => (state) => {
        setAdminSessionToken(state?.sessionToken || null);
      },
    }
  )
);
