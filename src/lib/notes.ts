import type { Note } from "@/lib/db/notes";

export const NOTE_COLORS = [
  { name: "Yellow", value: "#fde68a" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#ddd6fe" },
  { name: "Teal", value: "#99f6e4" },
  { name: "Grey", value: "#e7e5e4" },
];

export const DEFAULT_NOTE_COLOR = "#fde68a";
/** Size of a new post-it (also what migration 005 grew the never-resized ones to). */
export const DEFAULT_NOTE_WIDTH = 280;
export const DEFAULT_NOTE_HEIGHT = 260;
export const MIN_NOTE_WIDTH = 160;
export const MIN_NOTE_HEIGHT = 120;

/** Pinned notes always sit above unpinned ones; a note being dragged sits above everything. */
export const PINNED_Z_BASE = 1_000_000;
export const DRAGGING_Z = 2_000_000;

export function noteZIndex(note: Note): number {
  return (note.pinned ? PINNED_Z_BASE : 0) + note.zIndex;
}

/** Near-black or white text, whichever reads better on the given #rrggbb background. */
export function readableTextColor(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "#1c1917";
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => {
    const channel = parseInt(part ?? "0", 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  return luminance > 0.4 ? "#1c1917" : "#ffffff";
}

export function noteMatches(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return note.title.toLowerCase().includes(needle) || note.content.toLowerCase().includes(needle);
}
