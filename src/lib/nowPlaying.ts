import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { bangkokDateTime } from "@/lib/bangkok";
import { startPlay, updatePlay, upsertTrack } from "@/lib/db/music";
import { queryClient } from "@/lib/queryClient";

/** What Spotify is playing on this PC, as the Rust side reads it from Windows' media controls. */
export interface Track {
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  positionMs: number | null;
  durationMs: number | null;
  /** Cover as a data: URL. */
  art: string | null;
  shuffle: boolean | null;
  repeat: RepeatMode | null;
  canSeek: boolean;
  canShuffle: boolean;
  canRepeat: boolean;
}

export type RepeatMode = "off" | "track" | "list";

/** The last track seen, kept so the card can say "last played" when Spotify is closed. */
export interface LastTrack {
  title: string;
  artist: string;
  album: string;
  art: string | null;
  seenAt: number;
}

export type MediaAction = "toggle" | "next" | "previous";

const POLL_VISIBLE_MS = 2000;
/** Hidden in the tray, the app still keeps the listening history, just less often and without covers. */
const POLL_HIDDEN_MS = 6000;
const LAST_KEY = "lastSpotifyTrack";
const SKY_TINT_KEY = "musicSkyTint";

export const inApp = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const trackKey = (track: { title: string; artist: string }) => `${track.title}\u0000${track.artist}`;

function readLast(): LastTrack | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastTrack) : null;
  } catch {
    return null;
  }
}

function writeLast(track: LastTrack): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(track));
  } catch {
    // Only a convenience: without storage the card just forgets after a restart.
  }
}

interface NowPlayingState {
  track: Track | null;
  /** performance.now() of the last reading, to move the progress between polls. */
  receivedAt: number;
  last: LastTrack | null;
  /** The playing cover's colour (see coverColorOf), shared by the Music page and the sky. */
  coverColor: string | null;
  /** Album colour in the sky (Music page setting). */
  skyTint: boolean;
  setSkyTint: (on: boolean) => void;
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "on";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "on" : "off");
  } catch {
    // Still applies for this session.
  }
}

export const useNowPlayingStore = create<NowPlayingState>((set) => ({
  track: null,
  receivedAt: 0,
  last: readLast(),
  coverColor: null,
  skyTint: readFlag(SKY_TINT_KEY, false),
  setSkyTint: (on) => {
    writeFlag(SKY_TINT_KEY, on);
    set({ skyTint: on });
  },
}));

/** Where the song is now: the last reading moved on by the time since, while playing. */
export function livePosition(track: Track | null, receivedAt: number): number | null {
  if (!track || track.positionMs == null || !track.durationMs) return null;
  return Math.min(track.durationMs, track.positionMs + (track.playing ? performance.now() - receivedAt : 0));
}

let pollSoon: () => void = () => {};

async function send(action: string, value?: number) {
  if (!inApp()) return;
  try {
    await invoke<boolean>("media_control", { action, value: value ?? null });
  } finally {
    window.setTimeout(() => pollSoon(), 350);
  }
}

/** Play/pause, skip, seek, shuffle and repeat. Each answers the click at once; the next poll confirms. */
export const media = {
  control(action: MediaAction) {
    if (action === "toggle") {
      useNowPlayingStore.setState((state) => {
        if (!state.track) return {};
        // Freeze or restart the progress where it is now.
        const position = livePosition(state.track, state.receivedAt);
        return { track: { ...state.track, playing: !state.track.playing, positionMs: position }, receivedAt: performance.now() };
      });
    }
    return send(action);
  },
  seek(positionMs: number) {
    useNowPlayingStore.setState((state) =>
      state.track ? { track: { ...state.track, positionMs }, receivedAt: performance.now() } : {},
    );
    return send("seek", positionMs);
  },
  setShuffle(on: boolean) {
    useNowPlayingStore.setState((state) => (state.track ? { track: { ...state.track, shuffle: on } } : {}));
    return send("shuffle", on ? 1 : 0);
  },
  setRepeat(mode: RepeatMode) {
    useNowPlayingStore.setState((state) => (state.track ? { track: { ...state.track, repeat: mode } } : {}));
    return send("repeat", mode === "track" ? 1 : mode === "list" ? 2 : 0);
  },
};

/** The now-playing state for components; polling happens once, in <NowPlayingService />. */
export function useNowPlaying() {
  const track = useNowPlayingStore((state) => state.track);
  const receivedAt = useNowPlayingStore((state) => state.receivedAt);
  const last = useNowPlayingStore((state) => state.last);
  return { track, receivedAt, last, control: media.control };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * A cover's colour: the average of its mid-tone pixels (very dark and very light ones are skipped, so a
 * black border or white type does not wash it out).
 */
export const BLACK_COVER = "rgb(6 6 8)";

export function isBlackCover(color: string | null): boolean {
  return color === BLACK_COVER;
}

export async function coverColorOf(art: string): Promise<string | null> {
  const image = await loadImage(art);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Like Spotify: pick the most vivid prominent hue, not the muddy average of everything. Each pixel votes
  // for its hue bucket with a weight that grows with saturation squared, so a small vivid detail (green
  // type on a beige cover, a red jacket) beats a large pale or brownish area.
  const BUCKETS = 24;
  const weight = new Array<number>(BUCKETS).fill(0);
  const sums = Array.from({ length: BUCKETS }, () => [0, 0, 0, 0]); // r, g, b, weight
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let an = 0;
  let dark = 0;
  let vivid = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 90) dark += 1;
    if (max - min >= 0.18 * max && max >= 45) vivid += 1;
    if (max < 30 || min > 235) continue;
    ar += r;
    ag += g;
    ab += b;
    an += 1;
    const delta = max - min;
    const sat = delta / max;
    if (sat < 0.18 || max < 45) continue;
    let hue = 0;
    if (delta > 0) {
      if (max === r) hue = ((g - b) / delta) % 6;
      else if (max === g) hue = (b - r) / delta + 2;
      else hue = (r - g) / delta + 4;
    }
    const bucket = Math.floor((((hue * 60) + 360) % 360) / (360 / BUCKETS)) % BUCKETS;
    const w = sat * sat * (0.4 + max / 255 * 0.6);
    weight[bucket]! += w;
    const s = sums[bucket]!;
    s[0]! += r * w;
    s[1]! += g * w;
    s[2]! += b * w;
    s[3]! += w;
  }
  // A black-and-white cover with black dominant is simply black (no grey average).
  const total = size * size;
  if (vivid < total * 0.12 && dark > total * 0.45) return BLACK_COVER;
  // Neighbouring buckets count together, so one hue split across a bucket edge is not outvoted.
  let best = -1;
  let bestScore = 0;
  for (let k = 0; k < BUCKETS; k++) {
    const score = weight[k]! + 0.5 * (weight[(k + 1) % BUCKETS]! + weight[(k + BUCKETS - 1) % BUCKETS]!);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best >= 0 && sums[best]![3]! > 0) {
    const s = sums[best]!;
    return `rgb(${Math.round(s[0]! / s[3]!)} ${Math.round(s[1]! / s[3]!)} ${Math.round(s[2]! / s[3]!)})`;
  }
  // A grey or black-and-white cover: the plain average of what is left.
  return an > 0 ? `rgb(${Math.round(ar / an)} ${Math.round(ag / an)} ${Math.round(ab / an)})` : null;
}

/** A small JPEG of the cover for the history (a few KB instead of the 200 KB original). */
async function thumbnail(art: string, size = 96): Promise<string | null> {
  try {
    const image = await loadImage(art);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

export function useCoverColor(art: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!art) {
      setColor(null);
      return;
    }
    let cancelled = false;
    coverColorOf(art)
      .then((value) => !cancelled && setColor(value))
      .catch(() => !cancelled && setColor(null));
    return () => {
      cancelled = true;
    };
  }, [art]);
  return color;
}

/** "rgb(r g b)" -> [r, g, b]. */
function parseRgb(color: string): [number, number, number] | null {
  const match = color.match(/rgb\((\d+) (\d+) (\d+)\)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * The cover colour made usable as the app's accent (small lit details): saturated enough to read as a
 * colour, light on dark glass and deep on light glass.
 */
export function accentFromCover(color: string, dark: boolean, tone?: { lightness: number; minSaturation: number }): string {
  const rgb = parseRgb(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((value) => value / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  hue = Math.round(((hue * 60) + 360) % 360);
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  // A grey cover stays grey-ish rather than inventing a hue.
  const s = delta < 0.04 ? 12 : Math.max(tone?.minSaturation ?? 55, Math.round(saturation * 100));
  return `hsl(${hue} ${s}% ${tone?.lightness ?? (dark ? 72 : 42)}%)`;
}

/** Black or white text, whichever reads on this colour. */
export function inkOn(color: string | null): "dark" | "light" {
  const rgb = color ? parseRgb(color) : null;
  if (!rgb) return "light";
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.33 ? "dark" : "light";
}

export function formatTrackTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------------------------------------- */

interface PlayLog {
  key: string;
  playId: number | null;
  creating: boolean;
  listened: number;
  saved: number;
  at: number;
  position: number | null;
}

/** Plays are saved every this much new listening (and when the song changes). */
const SAVE_EVERY_MS = 15_000;

/**
 * Polls Spotify for the whole app (every 2 s while the window is visible, every 6 s from the tray), fetches
 * the cover only when the song changes, and writes the listening history: one play per song start, with
 * how long it was actually heard. Mount once, in the layout.
 */
export function NowPlayingService() {
  const artFor = useRef<{ key: string; art: string | null } | null>(null);
  const log = useRef<PlayLog | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!inApp()) return;
    let stopped = false;
    let timer: number | undefined;

    const write = (job: () => Promise<unknown>) => {
      writes.current = writes.current.then(job).catch(() => {
        // History is best effort; the player keeps working without it.
      });
    };

    const save = (entry: PlayLog, refresh = false) => {
      if (entry.playId === null || entry.listened === entry.saved) return;
      const { playId, listened } = entry;
      entry.saved = listened;
      write(async () => {
        await updatePlay(playId, listened);
        if (refresh) await queryClient.invalidateQueries({ queryKey: ["music"] });
      });
    };

    const record = (track: Track | null) => {
      const now = Date.now();
      const previous = log.current;
      if (!track) {
        if (previous) save(previous, true);
        log.current = null;
        return;
      }
      const key = trackKey(track);
      // The same song started again (repeat, or played twice): a new play.
      const restarted =
        previous?.key === key &&
        track.positionMs !== null &&
        previous.position !== null &&
        track.positionMs + 5000 < previous.position &&
        track.positionMs < 10_000;
      let entry = previous;
      if (!entry || entry.key !== key || restarted) {
        if (entry) save(entry, true);
        entry = { key, playId: null, creating: false, listened: 0, saved: 0, at: now, position: track.positionMs };
        log.current = entry;
      } else if (track.playing) {
        // Between polls; capped so a sleep or a stalled poll never counts as listening.
        entry.listened += Math.min(now - entry.at, 15_000);
      }
      entry.at = now;
      entry.position = track.positionMs;

      if (track.playing && entry.playId === null && !entry.creating) {
        entry.creating = true;
        const started = entry;
        const startedAt = bangkokDateTime();
        const art = track.art;
        write(async () => {
          const thumb = art ? await thumbnail(art) : null;
          const trackId = await upsertTrack({ title: track.title, artist: track.artist, album: track.album, art: thumb });
          started.playId = await startPlay(trackId, startedAt, track.durationMs);
          started.creating = false;
        });
      }
      if (entry.listened - entry.saved >= SAVE_EVERY_MS) save(entry, true);
    };

    const poll = async () => {
      try {
        let next = await invoke<Track | null>("now_playing", { includeArt: false });
        if (next) {
          const key = trackKey(next);
          if (artFor.current?.key !== key) {
            const withArt = await invoke<Track | null>("now_playing", { includeArt: true });
            if (withArt) next = withArt;
            artFor.current = { key, art: next.art };
            const art = next.art;
            if (art) {
              coverColorOf(art)
                .then((coverColor) => artFor.current?.key === key && useNowPlayingStore.setState({ coverColor }))
                .catch(() => useNowPlayingStore.setState({ coverColor: null }));
            } else {
              useNowPlayingStore.setState({ coverColor: null });
            }
          } else {
            next = { ...next, art: artFor.current.art };
          }
          const seen: LastTrack = { title: next.title, artist: next.artist, album: next.album, art: next.art, seenAt: Date.now() };
          writeLast(seen);
          useNowPlayingStore.setState({ last: seen });
        }
        useNowPlayingStore.setState({ track: next, receivedAt: performance.now() });
        record(next);
      } catch {
        // Media controls unavailable for a moment: keep showing what we had.
      }
    };

    // One poll at a time: a request while one is running (a click) just runs again right after it.
    let running = false;
    let again = false;
    const loop = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      window.clearTimeout(timer);
      do {
        again = false;
        await poll();
      } while (again && !stopped);
      running = false;
      if (stopped) return;
      timer = window.setTimeout(loop, document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
    };
    pollSoon = () => void loop();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loop();
    };
    void loop();
    document.addEventListener("visibilitychange", onVisibility);
    const flush = () => log.current && save(log.current);
    window.addEventListener("beforeunload", flush);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      pollSoon = () => {};
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, []);

  return null;
}
