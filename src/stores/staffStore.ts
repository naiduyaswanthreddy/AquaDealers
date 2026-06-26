import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StaffPermissions } from '@/types/database';

export interface StaffPortalContext {
  shopSlug: string;
  branchSlug: string;
  dealerId: string;
  branchId: string;
  shopName: string;
  branchName: string;
  portalUrl: string;
}

export interface StaffSession {
  id: string;
  name: string;
  phone: string | null;
  dealerId: string;
  branchId: string;
  branchIds: string[];
  permissions: StaffPermissions;
  defaultRoute: string;
}

interface StaffState {
  currentStaff: StaffSession | null;
  portalContext: StaffPortalContext | null;

  setStaffSession: (session: StaffSession, context: StaffPortalContext) => void;
  clearStaffSession: () => void;
}

const initialState = {
  currentStaff: null,
  portalContext: null,
};

export const useStaffStore = create<StaffState>()(
  persist(
    (set) => ({
      ...initialState,

      setStaffSession: (session, context) =>
        set({
          currentStaff: session,
          portalContext: context,
        }),

      clearStaffSession: () => set(initialState),
    }),
    {
      name: 'aquadealers-staff',
      partialize: (state) => ({
        currentStaff: state.currentStaff,
        portalContext: state.portalContext,
      }),
    }
  )
);

