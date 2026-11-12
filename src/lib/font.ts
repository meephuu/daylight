import { create } from "zustand";

/**
 * The display face: the greeting, page and pane titles, and big numbers. Written to
 * <html data-font="…">; index.css swaps the family and the settings that suit each face.
 */
export type DisplayFont = "instrument" | "sora";

export const DISPLAY_FONTS: { value: DisplayFont; label: string; family: string }[] = [
  { value: "sora", label: "Sora", family: "'Sora Variable', sans-serif" },
  { value: "instrument", label: "Instrument Serif", family: "'Instrument Serif', serif" },
];

const STORAGE_KEY = "displayFont";

function readFont(): DisplayFont {
  try {
    // Sora is the default; Instrument Serif only when chosen.
    return localStorage.getItem(STORAGE_KEY) === "instrument" ? "instrument" : "sora";
  } catch {
    return "sora";
  }
}

function apply(font: DisplayFont): void {
  document.documentElement.dataset.font = font;
}

interface FontState {
  font: DisplayFont;
  setFont: (font: DisplayFont) => void;
}

export const useDisplayFont = create<FontState>((set) => ({
  font: readFont(),
  setFont: (font) => {
    try {
      localStorage.setItem(STORAGE_KEY, font);
    } catch {
      // Still applies for this session if storage is unavailable.
    }
    apply(font);
    set({ font });
  },
}));

export function initDisplayFont(): void {
  apply(useDisplayFont.getState().font);
}
