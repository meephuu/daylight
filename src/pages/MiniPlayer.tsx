import { useEffect, useLayoutEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowUpRight, Music2, Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { applySharedSkyColors, showMainWindow, SKY_COLORS_KEY } from "@/lib/miniTimer";
import { coverColorOf, inApp, livePosition, trackKey, useNowPlayingStore, type Track } from "@/lib/nowPlaying";
import { cn } from "@/lib/utils";

const ICON_BUTTON =
  "grid size-[22px] place-items-center rounded-full text-foreground/60 outline-none transition-colors hover:bg-foreground/12 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60";

const SKIP_BUTTON =
  "grid size-8 shrink-0 place-items-center rounded-full text-foreground/75 outline-none transition-[color,background-color,scale] duration-150 hover:bg-foreground/12 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-90 disabled:pointer-events-none disabled:opacity-35";

const POLL_MS = 1500;

/**
 * Reads Spotify on its own (the same Rust commands as the main window's NowPlayingService), so the mini
 * player follows the music while Daylight is hidden in the tray. It only reads: the listening history is
 * still written by the main window alone. The cover is fetched once per song, and its colour with it.
 */
function useMiniNowPlaying() {
  const [track, setTrack] = useState<Track | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!inApp()) return;
    let stopped = false;
    let timer: number | undefined;
    let artFor: { key: string; art: string | null } | null = null;
    const poll = async () => {
      try {
        let next = await invoke<Track | null>("now_playing", { includeArt: false });
        if (next) {
          const key = trackKey(next);
          if (artFor?.key !== key) {
            const withArt = await invoke<Track | null>("now_playing", { includeArt: true });
            if (withArt) next = withArt;
            artFor = { key, art: next.art };
            const art = next.art;
            if (art) coverColorOf(art).then((value) => !stopped && artFor?.key === key && setColor(value), () => setColor(null));
            else setColor(null);
          } else {
            next = { ...next, art: artFor.art };
          }
        }
        if (!stopped) {
          setTrack(next);
          setReceivedAt(performance.now());
        }
      } catch {
        // Spotify busy or closed: the next round tries again.
      }
      if (!stopped) timer = window.setTimeout(poll, POLL_MS);
    };
    void poll();
    // A press answers at once and checks back soon after.
    pollNow = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 350);
    };
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  const control = (action: "toggle" | "next" | "previous") => {
    if (action === "toggle" && track) {
      setTrack({ ...track, playing: !track.playing, positionMs: livePosition(track, receivedAt) });
      setReceivedAt(performance.now());
    }
    invoke("media_control", { action, value: null })
      .catch(() => {})
      .finally(() => pollNow());
  };

  return { track, receivedAt, color, control };
}

let pollNow: () => void = () => {};

/** Re-renders every half second while playing, so the progress line moves. */
function useTicking(on: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 500);
    return () => window.clearInterval(id);
  }, [on]);
}

/**
 * The mini player (its own small window, always on top of other apps, opened from the Music page; see
 * src-tauri music_mini). The same slab of glass as the mini timer: the cover, the song and artist with a
 * thin line for where the song is (in the cover's colour), and previous / play-pause / next. Close and
 * "open Daylight" come up on hover. Drag it anywhere.
 */
export default function MiniPlayer() {
  const { track, receivedAt, color, control } = useMiniNowPlaying();
  const last = useNowPlayingStore((state) => state.last);
  const playing = track?.playing ?? false;
  useTicking(playing);
  const position = livePosition(track, receivedAt);
  const share = track?.durationMs && position !== null ? position / track.durationMs : 0;
  const live = track !== null;
  const shown = track ?? last;
  const lineColor = color ?? "var(--sky-accent)";

  // A see-through window: only the slab is drawn.
  useLayoutEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  // The sky colours of the main window (the glass is tinted with them).
  useEffect(() => {
    applySharedSkyColors();
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKY_COLORS_KEY) applySharedSkyColors();
    };
    const onFocus = () => applySharedSkyColors();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="dark h-screen w-screen p-1 text-foreground select-none">
      <div
        data-tauri-drag-region
        className="group relative flex h-full items-center gap-3 rounded-[22px] pr-2.5 pl-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.08)]"
        style={{
          // The mini timer's glass (the hour's sky mixed into deep navy at 93%), its faint wash in the
          // cover's colour instead of the sky accent while a song is on.
          background: `linear-gradient(160deg, color-mix(in srgb, ${live && color ? color : "var(--sky-accent)"} 18%, transparent), transparent 70%), color-mix(in srgb, color-mix(in srgb, var(--sky-mid) 40%, rgb(8 11 32)) 93%, transparent)`,
          transition: "background 600ms",
        }}
      >
        {/* The cover; a new song's cover fades in. */}
        <span
          data-tauri-drag-region
          className="relative grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-white/10 shadow-[0_0_0_1px_rgb(255_255_255/0.06),0_0_12px_-4px_rgb(0_0_0/0.6)]"
        >
          {shown?.art ? (
            <img
              key={trackKey(shown)}
              src={shown.art}
              alt=""
              draggable={false}
              data-tauri-drag-region
              className={cn("fade-in size-full object-cover transition-[filter,opacity] duration-300", !live && "opacity-60 grayscale-[0.4]")}
            />
          ) : (
            <Music2 className="size-5 text-foreground/50" aria-hidden="true" />
          )}
        </span>

        {/* The song, the artist, and where the song is. */}
        <div data-tauri-drag-region className="flex min-w-0 flex-1 flex-col">
          <span data-tauri-drag-region className="truncate text-[15px] leading-tight font-semibold text-white" title={shown?.title}>
            {shown?.title ?? "Nothing playing"}
          </span>
          <span data-tauri-drag-region className="mt-0.5 truncate text-[12px] text-muted-foreground" title={shown?.artist}>
            {live ? track.artist : shown ? `${shown.artist} · Spotify is closed` : "Play something in Spotify"}
          </span>
          <span className="mt-2 block h-[3px] overflow-hidden rounded-full bg-white/12" aria-hidden="true">
            <span
              className={cn("block h-full rounded-full", playing && "transition-[width] duration-500 ease-linear")}
              style={{ width: `${share * 100}%`, backgroundColor: lineColor }}
            />
          </span>
        </div>

        {/* Previous / play-pause / next. */}
        <div className="flex shrink-0 items-center gap-0.5 pt-3">
          <button type="button" className={SKIP_BUTTON} disabled={!live} onClick={() => control("previous")} aria-label="Previous song" title="Previous song">
            <SkipBack className="size-[15px]" fill="currentColor" />
          </button>
          <button
            type="button"
            disabled={!live}
            onClick={() => control("toggle")}
            aria-label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play"}
            className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_16px_-8px_rgb(0_0_0/0.6)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="ml-0.5 size-4" fill="currentColor" />}
          </button>
          <button type="button" className={SKIP_BUTTON} disabled={!live} onClick={() => control("next")} aria-label="Next song" title="Next song">
            <SkipForward className="size-[15px]" fill="currentColor" />
          </button>
        </div>

        {/* On hover: back to Daylight, close. */}
        <div className="absolute top-1 right-2 flex gap-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" className={ICON_BUTTON} onClick={showMainWindow} aria-label="Open Daylight" title="Open Daylight">
            <ArrowUpRight className="size-3" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            onClick={() => void getCurrentWindow().close().catch(() => {})}
            aria-label="Close the mini player"
            title="Close the mini player"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
