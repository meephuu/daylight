import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

/**
 * The mini timer: a small window that floats on top of other apps (src-tauri focus_mini, the /mini route).
 * It only shows the timer; its buttons send the same events as the tray menu to the main window, which
 * owns the timer.
 */
export function openMiniTimer(open = true): void {
  invoke("focus_mini", { open }).catch(() => {});
}

export function sendTimerCommand(command: "focus-toggle" | "focus-skip"): void {
  emit(command).catch(() => {});
}

export function showMainWindow(): void {
  invoke("show_main").catch(() => {});
}

/**
 * The mini timer has no sky of its own, so the main window shares its live sky colours (the accent and
 * the sky the glass is tinted with, including the Black theme's) through storage, and the mini window
 * puts them on its own root.
 */
export const SKY_COLORS_KEY = "miniSkyColors";
const SHARED_VARS = ["--sky-accent", "--sky-top", "--sky-mid"] as const;

export function shareSkyColors(): void {
  const style = getComputedStyle(document.documentElement);
  const colors = Object.fromEntries(SHARED_VARS.map((name) => [name, style.getPropertyValue(name).trim()]));
  try {
    const value = JSON.stringify(colors);
    if (localStorage.getItem(SKY_COLORS_KEY) !== value) localStorage.setItem(SKY_COLORS_KEY, value);
  } catch {
    // The mini timer keeps its default colours.
  }
}

export function applySharedSkyColors(): void {
  try {
    const colors = JSON.parse(localStorage.getItem(SKY_COLORS_KEY) ?? "{}") as Record<string, string>;
    for (const name of SHARED_VARS) {
      if (colors[name]) document.documentElement.style.setProperty(name, colors[name]);
    }
  } catch {
    // Keeps its default colours.
  }
}
