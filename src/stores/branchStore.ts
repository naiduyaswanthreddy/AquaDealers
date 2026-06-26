import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Branch } from '@/types/database';

export interface TemplateSettings {
  invoiceTemplate: string;
  statementTemplate: string;
  showLogo: boolean;
  showShopAddress: boolean;
  showTax: boolean;
  showSignatureLine: boolean;
}

const DEFAULT_TEMPLATE_SETTINGS: TemplateSettings = {
  invoiceTemplate: 'template1',
  statementTemplate: 'statement1',
  showLogo: true,
  showShopAddress: true,
  showTax: true,
  showSignatureLine: true,
};

interface BranchState {
  branches: Branch[];
  activeBranch: Branch | null;
  isAllBranches: boolean;
  branchTemplateSettings: Record<string, TemplateSettings>;

  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branch: Branch | null) => void;
  setAllBranches: (value: boolean) => void;
  getActiveBranchId: () => string | null;
  
  getTemplateSettings: (branchId: string) => TemplateSettings;
  updateTemplateSettings: (branchId: string, settings: Partial<TemplateSettings>) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      branches: [],
      activeBranch: null,
      isAllBranches: false,
      branchTemplateSettings: {},

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
      
      getTemplateSettings: (branchId) => {
        return get().branchTemplateSettings[branchId] || DEFAULT_TEMPLATE_SETTINGS;
      },
      
      updateTemplateSettings: (branchId, settings) => {
        set((state) => ({
          branchTemplateSettings: {
            ...state.branchTemplateSettings,
            [branchId]: {
              ...(state.branchTemplateSettings[branchId] || DEFAULT_TEMPLATE_SETTINGS),
              ...settings,
            },
          },
        }));
      },
    }),
    {
      name: 'aquadealers-branch',
      partialize: (state) => ({
        activeBranch: state.activeBranch,
        isAllBranches: state.isAllBranches,
        branchTemplateSettings: state.branchTemplateSettings,
      }),
    }
  )
);
