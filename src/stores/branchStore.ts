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
  /** Persisted color map keyed by branch ID — survives DB round-trips that return null color. */
  branchColors: Record<string, string | null>;

  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branch: Branch | null) => void;
  setAllBranches: (value: boolean) => void;
  getActiveBranchId: () => string | null;
  setBranchColor: (branchId: string, color: string | null) => void;
  
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
      branchColors: {},

      setBranches: (branches) => {
        const current = get().activeBranch;
        const storedColors = get().branchColors;

        /**
         * Merge helper: if the DB returned a branch without a color (column
         * may not exist yet in production), fall back to the color stored
         * locally so the theme never resets on refresh.
         */
        const mergeColor = (dbBranch: Branch): Branch => {
          const localColor = storedColors[dbBranch.id];
          if (dbBranch.color) {
            // DB has color — sync it into our local color map too
            if (dbBranch.color !== localColor) {
              storedColors[dbBranch.id] = dbBranch.color;
            }
            return dbBranch;
          }
          // DB has no color — use persisted local color
          return localColor ? { ...dbBranch, color: localColor } : dbBranch;
        };

        const freshBranches = branches.map(mergeColor);

        // Seed branchTemplateSettings from the DB branch record if no local value exists yet.
        const existingTemplates = get().branchTemplateSettings;
        const templateSeeds: Record<string, TemplateSettings> = {};
        for (const b of freshBranches) {
          if (!existingTemplates[b.id] && b.invoice_template) {
            templateSeeds[b.id] = {
              ...DEFAULT_TEMPLATE_SETTINGS,
              invoiceTemplate: b.invoice_template,
              statementTemplate: (b.statement_template as string) ?? DEFAULT_TEMPLATE_SETTINGS.statementTemplate,
              ...(b.template_settings as Partial<TemplateSettings> ?? {}),
            };
          }
        }

        if (current) {
          const fresh = freshBranches.find((b) => b.id === current.id);
          if (fresh) {
            set({
              branches: freshBranches,
              activeBranch: fresh,
              branchColors: { ...storedColors },
              ...(Object.keys(templateSeeds).length ? { branchTemplateSettings: { ...existingTemplates, ...templateSeeds } } : {}),
            });
            return;
          }
        }

        const main = freshBranches.find((b) => b.is_main);
        set({
          branches: freshBranches,
          activeBranch: main || null,
          isAllBranches: !main,
          branchColors: { ...storedColors },
          ...(Object.keys(templateSeeds).length ? { branchTemplateSettings: { ...existingTemplates, ...templateSeeds } } : {}),
        });
      },

      setBranchColor: (branchId, color) => {
        set((state) => {
          const updatedColors = { ...state.branchColors, [branchId]: color };
          const updatedBranches = state.branches.map((b) =>
            b.id === branchId ? { ...b, color } : b
          );
          const activeBranch =
            state.activeBranch?.id === branchId
              ? { ...state.activeBranch, color }
              : state.activeBranch;
          return { branchColors: updatedColors, branches: updatedBranches, activeBranch };
        });
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
        branchColors: state.branchColors,
      }),
    }
  )
);
