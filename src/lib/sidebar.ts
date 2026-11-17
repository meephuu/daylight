import { create } from "zustand";

const STORAGE_KEY = "sidebarCompact";
const ORDER_KEY = "sidebarOrder";

/** The menu order the owner dragged into place (route paths), or [] for the default order. */
function readOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

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
  /** Route paths in the order the sidebar shows them; pages missing from it keep their default place at the end. */
  order: string[];
  setOrder: (order: string[]) => void;
  /** True while a menu item is being dragged (and while the items settle after the drop). */
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
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
  order: readOrder(),
  setOrder: (order) => {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      // The order still applies for this session if storage is unavailable.
    }
    set({ order });
  },
  dragging: false,
  setDragging: (dragging) => set({ dragging }),
}));

/** Sorts items by a saved order of paths; anything not in it follows, in its original order. */
export function applyOrder<T extends { to: string }>(items: T[], order: string[]): T[] {
  const rank = (item: T) => {
    const index = order.indexOf(item.to);
    return index === -1 ? order.length + items.indexOf(item) : index;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}
