/**
 * Daylight 1.0's background, for the Black theme: a plain black window with one very blurry glow that
 * moves and recolours through the day (an orange circle top left in the morning, a pale-blue ellipse
 * across the top in the afternoon, a red-orange circle top right in the evening), gone by 20:00, with
 * the stars taking over at night. Values and timings are the original app's, unchanged.
 */

export interface GlowState {
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

const MORNING: GlowState = { x: 8, y: 4, width: 46, height: 46, color: "#FFBC82", opacity: 0.62 };
const AFTERNOON: GlowState = { x: 50, y: -4, width: 88, height: 26, color: "#D8F2FF", opacity: 0.5 };
const LATE_AFTERNOON: GlowState = { x: 92, y: 2, width: 44, height: 44, color: "#F9A05A", opacity: 0.62 };
const EVENING: GlowState = { x: 92, y: 2, width: 44, height: 44, color: "#FF8153", opacity: 0.62 };

const at = (hours: number, minutes = 0) => hours * 60 + minutes;
const MINUTES_PER_DAY = 24 * 60;

/** Each look holds for a while, then slowly morphs into the next. Off from 20:00 until 04:00. */
const KEYFRAMES: { at: number; state: GlowState }[] = [
  { at: at(4), state: { ...MORNING, opacity: 0 } },
  { at: at(6, 30), state: MORNING },
  { at: at(9), state: MORNING },
  { at: at(12), state: AFTERNOON },
  { at: at(15), state: AFTERNOON },
  { at: at(16, 30), state: LATE_AFTERNOON },
  { at: at(18), state: { ...EVENING, opacity: 0.555 } },
  { at: at(20), state: { ...EVENING, opacity: 0 } },
];

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (minutes: number) => ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

function mix(from: GlowState, to: GlowState, t: number): GlowState {
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
export function classicGlowAt(minutes: number): GlowState {
  const time = wrap(minutes);
  const first = KEYFRAMES[0]!;
  const last = KEYFRAMES[KEYFRAMES.length - 1]!;
  if (time <= first.at) return { ...first.state, opacity: 0 };
  if (time >= last.at) return { ...last.state, opacity: 0 };
  for (let i = 1; i < KEYFRAMES.length; i += 1) {
    const from = KEYFRAMES[i - 1]!;
    const to = KEYFRAMES[i]!;
    if (time <= to.at) return mix(from.state, to.state, smooth((time - from.at) / (to.at - from.at)));
  }
  return { ...last.state, opacity: 0 };
}

/**
 * How visible the night stars are (0-1): fading in 17:30-19:30 as the evening glow fades, all night,
 * and gone by 06:00 (fading from 05:00) as the morning glow comes in.
 */
export function classicStarsAt(minutes: number): number {
  const time = wrap(minutes);
  if (time >= at(19, 30) || time <= at(5)) return 1;
  if (time >= at(17, 30)) return smooth((time - at(17, 30)) / (at(19, 30) - at(17, 30)));
  if (time < at(6)) return smooth(1 - (time - at(5)) / (at(6) - at(5)));
  return 0;
}
