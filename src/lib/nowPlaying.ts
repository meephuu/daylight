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
export async function coverColorOf(art: string): Promise<string | null> {
  const image = await loadImage(art);
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, 12, 12);
  const data = ctx.getImageData(0, 0, 12, 12).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const light = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    if (light < 28 || light > 235) continue;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n += 1;
  }
  return n > 0 ? `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})` : null;
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
