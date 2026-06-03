import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AdminUser } from '../types';

interface AdminAuthState {
  adminUser: AdminUser | null;
  isAuthenticated: boolean;
  
  setAdminUser: (user: AdminUser | null) => void;
  login: (user: AdminUser) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminUser: null,
      isAuthenticated: false,

      setAdminUser: (user) => set({ adminUser: user, isAuthenticated: !!user }),

      login: (user) => set({ adminUser: user, isAuthenticated: true }),

      logout: () => set({ adminUser: null, isAuthenticated: false }),
    }),
    {
      name: 'aquadealer-admin-auth',
      partialize: (state) => ({
        adminUser: state.adminUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
