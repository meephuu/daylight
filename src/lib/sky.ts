/**
 * The living sky behind Daylight 2.0.
 *
 * The sky is anchored to the real sun: sunrise, solar noon and sunset are computed for Bangkok for
 * today's date, and each phase of the sky (dawn, morning, noon, golden hour, dusk, night) sits at a
 * fixed offset from them. Between two phases every colour blends smoothly, so the window changes
 * colour minute by minute through the day.
 */

/** Bangkok. The app's data, weeks and money are all Bangkok-based (see lib/bangkok.ts). */
const LATITUDE = 13.7563;
const LONGITUDE = 100.5018;

const MINUTES_PER_DAY = 24 * 60;

export interface SunTimes {
  /** Local minutes after midnight. */
  sunrise: number;
  noon: number;
  sunset: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** NOAA's low-precision solar position formulas: accurate to a minute or two, plenty for a sky. */
export function sunTimes(date: Date = new Date()): SunTimes {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const lat = toRad(LATITUDE);
  const hourAngle = toDeg(
    Math.acos(Math.cos(toRad(90.833)) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)),
  );
  // UTC minutes, then shifted into the machine's local time.
  const offset = -date.getTimezoneOffset();
  const wrap = (m: number) => ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return {
    sunrise: wrap(720 - 4 * (LONGITUDE + hourAngle) - eqTime + offset),
    noon: wrap(720 - 4 * LONGITUDE - eqTime + offset),
    sunset: wrap(720 - 4 * (LONGITUDE - hourAngle) - eqTime + offset),
  };
}

export interface SkyColors {
  /** Gradient stops, top of the window to the bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** The sun (or afterglow): a large soft light. Position in % of the window. */
  glow: string;
  glowX: number;
  glowY: number;
  glowOpacity: number;
  /** A saturated colour of the hour, for small lit details (active nav, the next-up slab). */
  accent: string;
}

export interface SkyState extends SkyColors {
  /** 0-1: how much of the night sky (stars) shows. */
  stars: number;
  phase: SkyPhaseName;
}

export type SkyPhaseName =
  | "Night"
  | "First light"
  | "Sunrise"
  | "Morning"
  | "Midday"
  | "Afternoon"
  | "Golden hour"
  | "Sunset"
  | "Dusk"
  | "Evening";

interface Phase {
  name: SkyPhaseName;
  /** Minutes after midnight, computed from today's sun times. */
  at: (sun: SunTimes) => number;
  stars: number;
  dark: SkyColors;
  light: SkyColors;
}

/*
 * Two renditions of every phase. Dark (the owner's usual theme) keeps the sky deep enough for light
 * text on clear glass; light lifts the same hues toward a bright, airy sky for dark text on white glass.
 */
const PHASES: Phase[] = [
  {
    name: "Night",
    at: (sun) => sun.noon - 12 * 60, // solar midnight
    stars: 1,
    dark: { top: "#03061a", mid: "#0a1236", bottom: "#161b4d", glow: "#3a4bb8", glowX: 80, glowY: 8, glowOpacity: 0.18, accent: "#8ea2ff" },
    light: { top: "#3d4b8c", mid: "#6c74ad", bottom: "#a7a8d2", glow: "#c9d0ff", glowX: 80, glowY: 8, glowOpacity: 0.35, accent: "#5a63c9" },
  },
  {
    name: "First light",
    at: (sun) => sun.sunrise - 50,
    stars: 0.7,
    dark: { top: "#0b1238", mid: "#2b2768", bottom: "#5b3170", glow: "#ff7a59", glowX: 10, glowY: 104, glowOpacity: 0.32, accent: "#ff8e75" },
    light: { top: "#5a63b0", mid: "#a891c8", bottom: "#f3b9b0", glow: "#ffb59a", glowX: 10, glowY: 104, glowOpacity: 0.5, accent: "#d9644f" },
  },
  {
    name: "Sunrise",
    at: (sun) => sun.sunrise + 5,
    stars: 0,
    dark: { top: "#1d2b70", mid: "#74468f", bottom: "#ff8763", glow: "#ffb27a", glowX: 12, glowY: 92, glowOpacity: 0.62, accent: "#ffab6b" },
    light: { top: "#7e93d9", mid: "#d7a6c8", bottom: "#ffd0a8", glow: "#ffd59e", glowX: 12, glowY: 92, glowOpacity: 0.75, accent: "#e0742f" },
  },
  {
    name: "Morning",
    at: (sun) => sun.sunrise + 100,
    stars: 0,
    dark: { top: "#173f8f", mid: "#3a6dbf", bottom: "#d79a7c", glow: "#ffd49a", glowX: 18, glowY: 34, glowOpacity: 0.45, accent: "#ffc46b" },
    light: { top: "#6fa6ec", mid: "#a9cdf3", bottom: "#ffe3c6", glow: "#fff0c9", glowX: 18, glowY: 34, glowOpacity: 0.7, accent: "#d98a1a" },
  },
  {
    name: "Midday",
    at: (sun) => sun.noon,
    stars: 0,
    dark: { top: "#0d3a8c", mid: "#1f63b8", bottom: "#4f9ad6", glow: "#ffffff", glowX: 55, glowY: -6, glowOpacity: 0.22, accent: "#5ed0ff" },
    light: { top: "#4f9ef0", mid: "#94cdf8", bottom: "#e2f3fd", glow: "#ffffff", glowX: 55, glowY: -6, glowOpacity: 0.6, accent: "#1f7fd6" },
  },
  {
    name: "Afternoon",
    at: (sun) => sun.sunset - 150,
    stars: 0,
    dark: { top: "#123a88", mid: "#2c69b5", bottom: "#7aa6d4", glow: "#ffe8b8", glowX: 74, glowY: 14, glowOpacity: 0.3, accent: "#63c8ff" },
    light: { top: "#5b9be6", mid: "#a3c9ef", bottom: "#eef0e6", glow: "#fff1cf", glowX: 74, glowY: 14, glowOpacity: 0.6, accent: "#2a78c9" },
  },
  {
    name: "Golden hour",
    at: (sun) => sun.sunset - 60,
    stars: 0,
    dark: { top: "#24357f", mid: "#8a5a9e", bottom: "#ffa060", glow: "#ffb46b", glowX: 86, glowY: 52, glowOpacity: 0.6, accent: "#ffb05a" },
    light: { top: "#6f86d1", mid: "#e0a9b9", bottom: "#ffd09a", glow: "#ffcf8f", glowX: 86, glowY: 52, glowOpacity: 0.75, accent: "#d9701a" },
  },
  {
    name: "Sunset",
    at: (sun) => sun.sunset - 8,
    stars: 0,
    dark: { top: "#1e2165", mid: "#9a3f7d", bottom: "#ff7448", glow: "#ff8a4d", glowX: 90, glowY: 90, glowOpacity: 0.62, accent: "#ff8a5c" },
    light: { top: "#5f6bc0", mid: "#e091b2", bottom: "#ffb48a", glow: "#ffad7a", glowX: 90, glowY: 90, glowOpacity: 0.7, accent: "#d9542f" },
  },
  {
    name: "Dusk",
    at: (sun) => sun.sunset + 45,
    stars: 0.45,
    dark: { top: "#0f1445", mid: "#38296c", bottom: "#863a6a", glow: "#ff6a5a", glowX: 92, glowY: 104, glowOpacity: 0.3, accent: "#ff7a9a" },
    light: { top: "#4b55a3", mid: "#8f7fbf", bottom: "#dda0b8", glow: "#ffa0a0", glowX: 92, glowY: 104, glowOpacity: 0.45, accent: "#c94a7a" },
  },
  {
    name: "Evening",
    at: (sun) => sun.sunset + 120,
    stars: 1,
    dark: { top: "#050a24", mid: "#0e1640", bottom: "#231f5c", glow: "#5a4bd0", glowX: 85, glowY: 100, glowOpacity: 0.16, accent: "#a08cff" },
    light: { top: "#414c90", mid: "#7276b5", bottom: "#b1a8d6", glow: "#c9c0ff", glowX: 85, glowY: 100, glowOpacity: 0.35, accent: "#6a55d0" },
  },
];

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Gentle start and finish so a phase change never looks like a switch. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Blends in linear light, which keeps sunset oranges and blues from going muddy halfway. */
function mixColor(a: string, b: string, t: number): string {
  const lin = (c: number) => Math.pow(c / 255, 2.2);
  const gam = (c: number) => Math.pow(c, 1 / 2.2) * 255;
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex([gam(lerp(lin(ca[0]), lin(cb[0]), t)), gam(lerp(lin(ca[1]), lin(cb[1]), t)), gam(lerp(lin(ca[2]), lin(cb[2]), t))]);
}

function mixColors(a: SkyColors, b: SkyColors, t: number): SkyColors {
  return {
    top: mixColor(a.top, b.top, t),
    mid: mixColor(a.mid, b.mid, t),
    bottom: mixColor(a.bottom, b.bottom, t),
    glow: mixColor(a.glow, b.glow, t),
    glowX: lerp(a.glowX, b.glowX, t),
    glowY: lerp(a.glowY, b.glowY, t),
    glowOpacity: lerp(a.glowOpacity, b.glowOpacity, t),
    accent: mixColor(a.accent, b.accent, t),
  };
}

const wrapDay = (m: number) => ((m % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

/** The sky at a time of day (minutes after midnight), for the dark or light theme. */
export function skyAt(minutes: number, dark: boolean, sun: SunTimes = sunTimes()): SkyState {
  const time = wrapDay(minutes);
  const points = PHASES.map((phase) => ({ phase, at: wrapDay(phase.at(sun)) })).sort((a, b) => a.at - b.at);

  // Find the two phases around `time`, wrapping across midnight.
  let fromIndex = points.length - 1;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (point && point.at <= time) fromIndex = i;
  }
  const from = points[fromIndex];
  const to = points[(fromIndex + 1) % points.length];
  if (!from || !to) throw new Error("Sky has no phases");

  const span = wrapDay(to.at - from.at) || MINUTES_PER_DAY;
  const t = smooth(wrapDay(time - from.at) / span);
  const fromColors = dark ? from.phase.dark : from.phase.light;
  const toColors = dark ? to.phase.dark : to.phase.light;
  const colors = mixColors(fromColors, toColors, t);
  // The accent is a single saturated hue; halfway between two different hues it turns muddy, so it
  // holds the current phase's colour and only turns over in the last stretch before the next phase.
  const accentT = smooth(Math.min(1, Math.max(0, (t - 0.7) / 0.3)));
  return {
    ...colors,
    accent: mixColor(fromColors.accent, toColors.accent, accentT),
    stars: lerp(from.phase.stars, to.phase.stars, t),
    phase: from.phase.name,
  };
}

/** "06:12" */
export function formatClock(minutes: number): string {
  const time = wrapDay(Math.round(minutes));
  return `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}

function formatSpan(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/**
 * The title bar's live readout: what the sky is doing and how long until the next sun event,
 * e.g. "Golden hour · sunset in 42 min" or "Night · sunrise in 6 h 10 min".
 */
export function skyReadout(minutes: number, sun: SunTimes = sunTimes()): string {
  const time = wrapDay(minutes);
  const phase = skyAt(time, true, sun).phase;
  if (time < sun.sunrise) return `${phase} · sunrise in ${formatSpan(sun.sunrise - time)}`;
  if (time < sun.sunset) return `${phase} · sunset in ${formatSpan(sun.sunset - time)}`;
  return `${phase} · sunrise in ${formatSpan(MINUTES_PER_DAY - time + sun.sunrise)}`;
}
