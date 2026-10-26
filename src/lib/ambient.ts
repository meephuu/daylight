import { useEffect, useState } from "react";
import { create } from "zustand";

/**
 * TEMPORARY: set to false (or delete the panel) to remove the slide-up "time of day" tester.
 * The background itself always follows the real clock when the tester is not overriding it.
 */
export const SHOW_TIME_DEBUG_PANEL = true;

/** The soft glow behind the app: one blurry shape that moves and recolours through the day. */
export interface AmbientState {
  /** Centre, as a percentage of the window width / height (may sit outside 0-100 to bleed off-screen). */
  x: number;
  y: number;
  /** Size in vw units, so the shape scales with the window. */
  width: number;
  height: number;
  /** "#rrggbb" */
  color: string;
  opacity: number;
}

const MORNING: AmbientState = { x: 8, y: 4, width: 46, height: 46, color: "#FFBC82", opacity: 0.62 };
// A long ellipse at the top middle, a little higher than the morning circle.
const AFTERNOON: AmbientState = { x: 50, y: -4, width: 88, height: 26, color: "#D8F2FF", opacity: 0.5 };
const EVENING: AmbientState = { x: 92, y: 2, width: 44, height: 44, color: "#FF8153", opacity: 0.62 };

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

/**
 * Each look holds for a while, then slowly morphs into the next. The glow is fully gone by 20:00
 * and stays off until it fades back in from 04:00.
 */
const KEYFRAMES: { at: number; state: AmbientState }[] = [
  { at: at(4), state: { ...MORNING, opacity: 0 } }, // fades in from nothing, a little before the stars leave
  { at: at(6, 30), state: MORNING },
  { at: at(9), state: MORNING },
  { at: at(12), state: AFTERNOON },
  { at: at(14), state: AFTERNOON },
  { at: at(16), state: EVENING },
  { at: at(17, 30), state: EVENING },
  { at: at(20), state: { ...EVENING, opacity: 0 } }, // fades out: everything is dark by 20:00
];

const MINUTES_PER_DAY = 24 * 60;

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Gentle start and finish, so a transition never looks like it is switching on or off. */
const smooth = (t: number) => t * t * (3 - 2 * t);

function mix(from: AmbientState, to: AmbientState, t: number): AmbientState {
  const a = parseHex(from.color);
  const b = parseHex(to.color);
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    color: toHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]),
    opacity: lerp(from.opacity, to.opacity, t),
  };
}

/** The glow for a time of day, in minutes after midnight. */
export function ambientAt(minutes: number): AmbientState {
  const time = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const first = KEYFRAMES[0];
  const last = KEYFRAMES[KEYFRAMES.length - 1];
  if (!first || !last) throw new Error("No keyframes");
  if (time <= first.at) return { ...first.state, opacity: 0 };
  if (time >= last.at) return { ...last.state, opacity: 0 };

  for (let i = 1; i < KEYFRAMES.length; i += 1) {
    const from = KEYFRAMES[i - 1];
    const to = KEYFRAMES[i];
    if (from && to && time <= to.at) {
      return mix(from.state, to.state, smooth((time - from.at) / (to.at - from.at)));
    }
  }
  return { ...last.state, opacity: 0 };
}

/**
 * How visible the night stars are (0-1). They fade in while the evening glow is fading out
 * (17:30-19:30), stay all night, and are completely gone by 06:00 (fading from 05:00) while the
 * morning glow comes in. The overlaps mean the sky is never empty between the two.
 */
export function starsAt(minutes: number): number {
  const time = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (time >= at(19, 30) || time <= at(5)) return 1;
  if (time >= at(17, 30)) return smooth((time - at(17, 30)) / (at(19, 30) - at(17, 30)));
  if (time < at(6)) return smooth(1 - (time - at(5)) / (at(6) - at(5)));
  return 0;
}

export function periodName(minutes: number): "Morning" | "Afternoon" | "Evening" | "Night" {
  const time = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (time >= at(5) && time < at(12)) return "Morning";
  if (time >= at(12) && time < at(16)) return "Afternoon";
  if (time >= at(16) && time < at(20)) return "Evening";
  return "Night";
}

export function formatMinutes(minutes: number): string {
  const time = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}

interface AmbientTimeState {
  /** Minutes after midnight forced by the tester, or null to follow the real clock. */
  override: number | null;
  setOverride: (minutes: number | null) => void;
}

export const useAmbientTime = create<AmbientTimeState>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));

const NIGHT_STARS_KEY = "nightStars";

function readNightStars(): boolean {
  try {
    return localStorage.getItem(NIGHT_STARS_KEY) !== "off";
  } catch {
    return true;
  }
}

interface AmbientPrefsState {
  /** Show the twinkling stars at night. On by default. */
  nightStars: boolean;
  setNightStars: (on: boolean) => void;
}

export const useAmbientPrefs = create<AmbientPrefsState>((set) => ({
  nightStars: readNightStars(),
  setNightStars: (on) => {
    try {
      localStorage.setItem(NIGHT_STARS_KEY, on ? "on" : "off");
    } catch {
      // The choice still applies for this session if storage is unavailable.
    }
    set({ nightStars: on });
  },
}));

function realMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

/** The time the background should show: the tester's value if set, otherwise the real clock. */
export function useAmbientMinutes(): number {
  const override = useAmbientTime((state) => state.override);
  const [real, setReal] = useState(realMinutes);

  useEffect(() => {
    const id = window.setInterval(() => setReal(realMinutes()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return override ?? real;
}
