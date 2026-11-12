import { create } from "zustand";

const STORAGE_KEY = "sidebarCompact";

function readCompact(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

interface SidebarState {
  /** The small sidebar: a thin rail of icons instead of icons with labels. */
  compact: boolean;
  setCompact: (compact: boolean) => void;
}

export const useSidebar = create<SidebarState>((set) => ({
  compact: readCompact(),
  setCompact: (compact) => {
    try {
      localStorage.setItem(STORAGE_KEY, compact ? "on" : "off");
    } catch {
      // The choice still applies for this session if storage is unavailable.
    }
    set({ compact });
  },
}));
