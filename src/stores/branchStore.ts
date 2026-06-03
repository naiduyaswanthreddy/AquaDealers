import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Branch } from '@/types/database';

interface BranchState {
  branches: Branch[];
  activeBranch: Branch | null;
  isAllBranches: boolean;

  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branch: Branch | null) => void;
  setAllBranches: (value: boolean) => void;
  getActiveBranchId: () => string | null;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branches: [],
      activeBranch: null,
      isAllBranches: false,

      setBranches: (branches) => {
        set({ branches });
        const current = get().activeBranch;
        
        // If there is an active branch but it doesn't exist in the fetched branches, clear it
        const currentExists = current && branches.some((b) => b.id === current.id);
        
        if (!current || !currentExists) {
          const main = branches.find((b) => b.is_main);
          if (main) {
            set({ activeBranch: main, isAllBranches: false });
          } else {
            set({ activeBranch: null, isAllBranches: true });
          }
        }
      },

      setActiveBranch: (branch) =>
        set({ activeBranch: branch, isAllBranches: false }),

      setAllBranches: (value) =>
        set({ isAllBranches: value, activeBranch: value ? null : get().activeBranch }),

      getActiveBranchId: () => {
        const state = get();
        if (state.isAllBranches) return null;
        return state.activeBranch?.id || null;
      },
    }),
    {
      name: 'aquadealer-branch',
      partialize: (state) => ({
        activeBranch: state.activeBranch,
        isAllBranches: state.isAllBranches,
      }),
    }
  )
);
