import { create } from 'zustand';

interface AdminUIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activePanel: string | null;
  setActivePanel: (panel: string | null) => void;
}

export const useAdminUIStore = create<AdminUIState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
