import { create } from "zustand";

/**
 * Whether the app animates. "system" follows Windows (Settings > Accessibility > Visual effects >
 * Animation effects); "on" and "off" override it for this app only.
 *
 * The answer is written to <html data-motion="full|reduce">. Everything reads that attribute instead of
 * the media query: the CSS in index.css, Tailwind's `motion-reduce:` variant (redefined there), and the
 * script-driven motion (stars, theme cross-fade) through isReducedMotion().
 */
export type MotionPreference = "system" | "on" | "off";

const STORAGE_KEY = "motion";
const QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): MotionPreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "on" || value === "off" ? value : "system";
  } catch {
    return "system";
  }
}

function resolve(preference: MotionPreference): "full" | "reduce" {
  if (preference === "on") return "full";
  if (preference === "off") return "reduce";
  return window.matchMedia(QUERY).matches ? "reduce" : "full";
}

function apply(preference: MotionPreference): void {
  document.documentElement.dataset.motion = resolve(preference);
}

/** True when the app should not move things around right now. */
export function isReducedMotion(): boolean {
  return document.documentElement.dataset.motion === "reduce";
}

/** Whether Windows itself asks for reduced motion (shown next to the setting). */
export function systemReducesMotion(): boolean {
  return window.matchMedia(QUERY).matches;
}

interface MotionState {
  preference: MotionPreference;
  setPreference: (preference: MotionPreference) => void;
}

export const useMotion = create<MotionState>((set) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Still applies for this session if storage is unavailable.
    }
    apply(preference);
    set({ preference });
  },
}));

/** Apply the saved choice, and keep following Windows while set to "system". */
export function initMotion(): void {
  apply(useMotion.getState().preference);
  window.matchMedia(QUERY).addEventListener("change", () => apply(useMotion.getState().preference));
}
