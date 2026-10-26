import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  /** Label of the optional action button, e.g. "Undo". */
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    // At most three are kept; Ctrl+Z always acts on the newest one with an action.
    set((state) => ({ toasts: [...state.toasts.slice(-2), { durationMs: 5000, ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function showToast(toast: Parameters<ToastState["show"]>[0]): number {
  return useToastStore.getState().show(toast);
}
