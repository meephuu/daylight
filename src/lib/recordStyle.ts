import { create } from "zustand";
import { accentFromCover, isBlackCover } from "@/lib/nowPlaying";
import { liquidTexture, marbleTexture, splatterTexture } from "@/lib/vinylFinishes";

/**
 * How the record on the Music page looks: the vinyl's colour and finish, and what is printed on the
 * label. A per-PC preference (kept in local storage), changed from the record's style menu.
 */

export interface VinylColor {
  id: string;
  name: string;
  hex: string;
  /** Light vinyl shows its grooves fainter, and splatters in dark ink. */
  light?: boolean;
}

export const VINYL_COLORS: VinylColor[] = [
  { id: "black", name: "Classic black", hex: "#121318" },
  { id: "smoke", name: "Smoke", hex: "#4b4f5a" },
  { id: "cream", name: "Cream", hex: "#e8e2d4", light: true },
  { id: "red", name: "Red", hex: "#b4232f" },
  { id: "orange", name: "Orange", hex: "#d8711f" },
  { id: "yellow", name: "Yellow", hex: "#e3b53b", light: true },
  { id: "green", name: "Green", hex: "#2e7c55" },
  { id: "blue", name: "Blue", hex: "#2a4fb0" },
  { id: "purple", name: "Purple", hex: "#6b40a8" },
  { id: "pink", name: "Pink", hex: "#e17aa9", light: true },
];

/** "album" takes the playing cover's colour. */
export type VinylColorId = (typeof VINYL_COLORS)[number]["id"] | "album";
export type VinylFinish = "solid" | "clear" | "marble" | "splatter" | "liquid" | "split";
export type LabelStyle = "cover" | "art" | "black" | "white";

export interface RecordStyle {
  color: VinylColorId;
  finish: VinylFinish;
  label: LabelStyle;
}

export const CLASSIC_RECORD: RecordStyle = { color: "black", finish: "solid", label: "cover" };

const STORAGE_KEY = "recordStyle";

function readStyle(): RecordStyle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...CLASSIC_RECORD, ...(JSON.parse(raw) as Partial<RecordStyle>) } : CLASSIC_RECORD;
  } catch {
    return CLASSIC_RECORD;
  }
}

interface RecordStyleState extends RecordStyle {
  set: (change: Partial<RecordStyle>) => void;
}

export const useRecordStyle = create<RecordStyleState>((set, get) => ({
  ...readStyle(),
  set: (change) => {
    set(change);
    const { color, finish, label } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ color, finish, label }));
    } catch {
      // Still applies for this session.
    }
  },
}));

/** The CSS custom properties the record (`.vinyl`) and its run-out band are painted with. */
export interface VinylLook {
  /** The disc's own paint: a colour or a gradient, under the grooves. */
  fill: string;
  /**
   * Liquid finish only: the poured colour, and the glass it is poured into. The turning record draws the
   * liquid as a live layer over `glass` (so it can flow); swatches use `fill`, which has it at rest.
   */
  liquid: { color: string; glass: string } | null;
  /** How strongly the still light catches the record: glass shows its reflections more. */
  sheen: number;
  rim: string;
  runout: string;
  grooveDark: number;
  grooveLight: number;
}

export function vinylLook(style: RecordStyle, coverColor: string | null): VinylLook {
  const preset = VINYL_COLORS.find((item) => item.id === style.color);
  const base =
    style.color === "album" && coverColor
      ? isBlackCover(coverColor)
        ? "#141416"
        : accentFromCover(coverColor, true, { lightness: 40, minSaturation: 50 })
      : (preset ?? VINYL_COLORS[0]!).hex;
  const light = style.color === "album" ? false : !!preset?.light;
  const darker = `color-mix(in oklab, ${base}, black 40%)`;

  // Marble and splatter are inked in the vinyl's opposite: dark on light vinyl, pale on dark.
  const ink = light ? "#1d1d22" : "#f4f2ec";
  const texture = (image: string) => `${image} center / 100% 100% no-repeat`;

  const glass = `color-mix(in oklab, ${base} 10%, rgb(244 247 250 / 0.07))`;

  let fill = base;
  if (style.finish === "clear") {
    fill = `color-mix(in oklab, ${base} 68%, transparent)`;
  } else if (style.finish === "marble") {
    fill = `${texture(marbleTexture(ink))}, ${base}`;
  } else if (style.finish === "splatter") {
    fill = `${texture(splatterTexture(ink))}, ${base}`;
  } else if (style.finish === "liquid") {
    // Colour poured through clear vinyl: the clear parts are glass, with only a breath of the colour.
    fill = `${texture(liquidTexture(base))}, ${glass}`;
  } else if (style.finish === "split") {
    const other = light ? darker : `color-mix(in oklab, ${base}, white 55%)`;
    fill = `conic-gradient(from 90deg, ${base} 0 50%, ${other} 50% 100%)`;
  }

  const clear = style.finish === "clear";
  const liquid = style.finish === "liquid";
  return {
    fill,
    liquid: liquid ? { color: base, glass } : null,
    sheen: liquid ? 1.6 : 1,
    // Glass catches a little light on its edge.
    rim: liquid
      ? `color-mix(in oklab, ${base} 15%, rgb(255 255 255 / 0.14))`
      : clear
        ? `color-mix(in oklab, ${base} 80%, transparent)`
        : `color-mix(in oklab, ${base}, white 12%)`,
    // Liquid records are poured round a clear centre, so the run-out is glass too.
    runout: liquid
      ? `color-mix(in oklab, ${base} 8%, rgb(244 247 250 / 0.1))`
      : clear
        ? `color-mix(in oklab, ${base} 55%, transparent)`
        : `color-mix(in oklab, ${base}, black 55%)`,
    // Grooves are shading: full strength on black, softer on colour, where strong lines turn into stripes, and
    // faint on glass, which they would otherwise grey over.
    grooveDark: liquid ? 0.07 : style.color === "black" ? 0.3 : light ? 0.07 : 0.14,
    grooveLight: liquid ? 0.07 : style.color === "black" ? 0.035 : light ? 0.08 : 0.05,
  };
}
