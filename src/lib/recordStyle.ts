import { create } from "zustand";
import { accentFromCover } from "@/lib/nowPlaying";

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
export type VinylFinish = "solid" | "clear" | "marble" | "splatter" | "split";
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
  rim: string;
  runout: string;
  grooveDark: number;
  grooveLight: number;
}

/** Fixed spots for the splatter finish (x %, y %, size %), the same on every record. */
const SPLATTER: [number, number, number][] = [
  [22, 30, 1.1], [31, 18, 0.6], [68, 22, 0.9], [78, 41, 1.3], [84, 63, 0.7], [70, 80, 1.0], [52, 88, 0.6],
  [33, 79, 1.2], [17, 64, 0.8], [12, 44, 0.6], [40, 12, 0.5], [60, 12, 0.7], [88, 30, 0.5], [26, 52, 0.4],
  [74, 55, 0.5], [45, 75, 0.45], [58, 70, 0.4], [15, 25, 0.45],
];

export function vinylLook(style: RecordStyle, coverColor: string | null): VinylLook {
  const preset = VINYL_COLORS.find((item) => item.id === style.color);
  const base =
    style.color === "album" && coverColor
      ? accentFromCover(coverColor, true, { lightness: 40, minSaturation: 50 })
      : (preset ?? VINYL_COLORS[0]!).hex;
  const light = style.color === "album" ? false : !!preset?.light;
  const lighter = `color-mix(in oklab, ${base}, white 38%)`;
  const darker = `color-mix(in oklab, ${base}, black 40%)`;

  let fill = base;
  if (style.finish === "clear") {
    fill = `color-mix(in oklab, ${base} 68%, transparent)`;
  } else if (style.finish === "marble") {
    fill = [
      `radial-gradient(ellipse 55% 38% at 28% 32%, ${lighter}, transparent 70%)`,
      `radial-gradient(ellipse 42% 60% at 74% 62%, ${darker}, transparent 70%)`,
      `radial-gradient(ellipse 35% 28% at 62% 22%, color-mix(in oklab, ${base}, white 62%), transparent 70%)`,
      `radial-gradient(ellipse 40% 30% at 30% 78%, ${lighter}, transparent 72%)`,
      `radial-gradient(ellipse 30% 45% at 18% 55%, ${darker}, transparent 70%)`,
      base,
    ].join(", ");
  } else if (style.finish === "splatter") {
    const ink = light ? "rgb(20 20 24 / 0.85)" : "rgb(250 250 248 / 0.9)";
    fill = [
      ...SPLATTER.map(([x, y, size]) => `radial-gradient(circle at ${x}% ${y}%, ${ink} 0 ${size}%, transparent ${size + 0.25}%)`),
      base,
    ].join(", ");
  } else if (style.finish === "split") {
    const other = light ? darker : `color-mix(in oklab, ${base}, white 55%)`;
    fill = `conic-gradient(from 90deg, ${base} 0 50%, ${other} 50% 100%)`;
  }

  const clear = style.finish === "clear";
  return {
    fill,
    rim: clear ? `color-mix(in oklab, ${base} 80%, transparent)` : `color-mix(in oklab, ${base}, white 12%)`,
    runout: clear ? `color-mix(in oklab, ${base} 55%, transparent)` : `color-mix(in oklab, ${base}, black 55%)`,
    // Grooves are shading: full strength on black, softer on colour, where strong lines turn into stripes.
    grooveDark: style.color === "black" ? 0.3 : light ? 0.07 : 0.14,
    grooveLight: style.color === "black" ? 0.035 : light ? 0.08 : 0.05,
  };
}
