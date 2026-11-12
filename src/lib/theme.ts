import { create } from "zustand";
import { isReducedMotion } from "@/lib/motion";

/**
 * "black" is the dark theme on a plain, still black background (like Daylight 1.0): no sky, no sun,
 * no stars. It sets both the `dark` and `black` classes, so every dark style applies and `.black`
 * only overrides the colours.
 */
export type Theme = "system" | "light" | "dark" | "black";

const STORAGE_KEY = "theme";

function readStoredTheme(): Theme {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "black" ? value : "system";
}

export function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    theme === "black" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("black", theme === "black");
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    const apply = () => {
      applyTheme(theme);
      set({ theme });
    };
    // Cross-fade the whole window from the old look to the new one, instead of a hard flip.
    if (!isReducedMotion() && typeof document.startViewTransition === "function") document.startViewTransition(apply);
    else apply();
  },
}));

// Development only: lets screenshot scripts switch theme without touching the saved choice.
if (import.meta.env.DEV) {
  (window as unknown as { __daylight?: Record<string, unknown> }).__daylight = {
    ...(window as unknown as { __daylight?: Record<string, unknown> }).__daylight,
    applyTheme,
  };
}

/** Apply the saved theme and follow OS changes while set to "system". */
export function initTheme(): void {
  applyTheme(useTheme.getState().theme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useTheme.getState().theme === "system") applyTheme("system");
  });
}
