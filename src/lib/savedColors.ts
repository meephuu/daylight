import { create } from "zustand";
import { HEX_COLOR_PATTERN } from "@/lib/colors";

/**
 * Colours the owner added to a palette with the "+" swatch, kept in this PC's app storage. There are
 * separate palettes: "accent" for projects, habits, events and categories, and "notes" for post-its, so
 * a colour added in one never shows up in the other.
 */
export type PaletteName = "accent" | "notes";

const STORAGE_KEYS: Record<PaletteName, string> = { accent: "savedColors", notes: "savedNoteColors" };
/** Enough for a personal palette without the row turning into a wall of dots. */
export const MAX_SAVED_COLORS = 12;

function readSaved(palette: PaletteName): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS[palette]) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && HEX_COLOR_PATTERN.test(item))
      : [];
  } catch {
    return [];
  }
}

function writeSaved(palette: PaletteName, colors: string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS[palette], JSON.stringify(colors));
  } catch {
    // Still in the palette for this session.
  }
}

interface SavedColorsState {
  palettes: Record<PaletteName, string[]>;
  add: (palette: PaletteName, color: string) => void;
  remove: (palette: PaletteName, color: string) => void;
}

export const useSavedColors = create<SavedColorsState>((set, get) => ({
  palettes: { accent: readSaved("accent"), notes: readSaved("notes") },
  add: (palette, color) => {
    const value = color.toLowerCase();
    // Newest last; adding one that is already there just keeps it. The oldest goes when the list is full.
    const colors = [...get().palettes[palette].filter((item) => item !== value), value].slice(-MAX_SAVED_COLORS);
    writeSaved(palette, colors);
    set({ palettes: { ...get().palettes, [palette]: colors } });
  },
  remove: (palette, color) => {
    const colors = get().palettes[palette].filter((item) => item !== color.toLowerCase());
    writeSaved(palette, colors);
    set({ palettes: { ...get().palettes, [palette]: colors } });
  },
}));
