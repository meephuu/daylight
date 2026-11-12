import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { formatTrackTime, inApp, media, type RepeatMode, type Track } from "@/lib/nowPlaying";
import { cn } from "@/lib/utils";

const ROUND_BUTTON =
  "relative grid size-9 shrink-0 place-items-center rounded-full text-foreground/80 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35";

/** A toggle that is on: lit in the accent, with a dot under it (so it never relies on colour alone). */
function OnDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-sky-accent transition-[opacity,scale] duration-200",
        on ? "opacity-100" : "scale-0 opacity-0",
      )}
    />
  );
}

/**
 * Spotify's own volume in the Windows mixer (not the PC's volume). Read every few seconds so a change
 * in the mixer or in Spotify shows here too; set while dragging.
 */
function useSpotifyVolume() {
  const [volume, setVolume] = useState<number | null>(null);
  const dragging = useRef(false);
  const pending = useRef<number | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!inApp()) return;
    let cancelled = false;
    const read = async () => {
      if (dragging.current || sending.current) return;
      try {
        const value = await invoke<number | null>("spotify_volume");
        if (!cancelled && !dragging.current) setVolume(value);
      } catch {
        // Mixer unavailable for a moment.
      }
    };
    void read();
    const id = window.setInterval(read, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  // One request in flight; the latest value wins.
  const flush = async () => {
    if (sending.current) return;
    sending.current = true;
    while (pending.current !== null) {
      const level = pending.current;
      pending.current = null;
      try {
        await invoke("set_spotify_volume", { level });
      } catch {
        break;
      }
    }
    sending.current = false;
  };

  const set = (level: number) => {
    setVolume(level);
    pending.current = level;
    void flush();
  };

  return { volume, set, dragging };
}

interface PlayerControlsProps {
  track: Track | null;
  position: number | null;
  /** The cover's colour, for the progress line. */
  color: string | null;
  art: string | null;
  className?: string;
}

export function PlayerControls({ track, position, color, art, className }: PlayerControlsProps) {
  const live = track !== null;
  const duration = track?.durationMs ?? null;
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? position ?? 0;
  const { volume, set: setVolume, dragging } = useSpotifyVolume();
  const beforeMute = useRef(0.6);

  const repeat: RepeatMode = track?.repeat ?? "off";
  const nextRepeat: Record<RepeatMode, RepeatMode> = { off: "list", list: "track", track: "off" };
  const repeatLabel: Record<RepeatMode, string> = {
    off: "Repeat is off",
    list: "Repeating the playlist",
    track: "Repeating this song",
  };

  const commitSeek = () => {
    if (scrub !== null) void media.seek(scrub);
    setScrub(null);
  };

  const VolumeIcon = volume === null || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className={cn("pane flex flex-col gap-3 px-5 pt-4 pb-3.5", className)}>
      {/* The song (the label on the record turns, so it is repeated here to read). */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-foreground/10 shadow-[0_6px_14px_-8px_rgb(0_0_0/0.6)]">
          {art ? (
            <img src={art} alt="" className={cn("size-full object-cover", !live && "grayscale-[0.35]")} draggable={false} />
          ) : (
            <Music2 className="size-5 text-foreground/50" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-snug font-semibold" title={track?.title}>
            {track?.title ?? "Spotify is not playing"}
          </p>
          <p className="truncate text-[13px] text-foreground/70" title={track?.artist}>
            {track ? track.artist : "Open Spotify on this PC and play something."}
          </p>
        </div>
      </div>

      {/* Where the song is: drag or click to jump. */}
      <div>
        <input
          type="range"
          className="music-range block w-full"
          min={0}
          max={duration ?? 1}
          step={1000}
          value={duration ? shown : 0}
          disabled={!live || !duration || !track?.canSeek}
          style={
            {
              "--fill": duration ? `${(shown / duration) * 100}%` : "0%",
              "--range-color": color ?? "var(--sky-accent)",
            } as React.CSSProperties
          }
          onChange={(event) => setScrub(Number(event.currentTarget.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          onBlur={() => setScrub(null)}
          aria-label="Song position"
          aria-valuetext={duration ? `${formatTrackTime(shown)} of ${formatTrackTime(duration)}` : undefined}
        />
        <div className="mt-0.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>{duration ? formatTrackTime(shown) : "-:--"}</span>
          <span>{duration ? formatTrackTime(duration) : "-:--"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          className={cn(ROUND_BUTTON, track?.shuffle && "text-sky-accent hover:text-sky-accent")}
          disabled={!live || !track?.canShuffle}
          onClick={() => void media.setShuffle(!track?.shuffle)}
          aria-pressed={!!track?.shuffle}
          aria-label="Shuffle"
          title={track?.shuffle ? "Shuffle is on" : "Shuffle is off"}
        >
          <Shuffle className="size-4" />
          <OnDot on={!!track?.shuffle} />
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={ROUND_BUTTON}
            disabled={!live}
            onClick={() => void media.control("previous")}
            aria-label="Previous song"
          >
            <SkipBack className="size-[18px]" fill="currentColor" />
          </button>
          <button
            type="button"
            disabled={!live}
            onClick={() => void media.control("toggle")}
            aria-label={track?.playing ? "Pause" : "Play"}
            className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_18px_-8px_rgb(0_0_0/0.5)] outline-none transition-transform duration-150 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            {track?.playing ? (
              <Pause className="size-5" fill="currentColor" />
            ) : (
              <Play className="ml-0.5 size-5" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className={ROUND_BUTTON}
            disabled={!live}
            onClick={() => void media.control("next")}
            aria-label="Next song"
          >
            <SkipForward className="size-[18px]" fill="currentColor" />
          </button>
        </div>

        <button
          type="button"
          className={cn(ROUND_BUTTON, repeat !== "off" && "text-sky-accent hover:text-sky-accent")}
          disabled={!live || !track?.canRepeat}
          onClick={() => void media.setRepeat(nextRepeat[repeat])}
          aria-label={`${repeatLabel[repeat]}. Change repeat`}
          title={repeatLabel[repeat]}
        >
          {repeat === "track" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
          <OnDot on={repeat !== "off"} />
        </button>
      </div>

      {/* Spotify's own volume (the Windows mixer), a row of its own. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn(ROUND_BUTTON, "size-8")}
          disabled={volume === null}
          onClick={() => {
            if (volume === null) return;
            if (volume > 0) {
              beforeMute.current = volume;
              setVolume(0);
            } else {
              setVolume(beforeMute.current || 0.6);
            }
          }}
          aria-label={volume === 0 ? "Unmute Spotify" : "Mute Spotify"}
          title={volume === null ? "Spotify's volume shows once it plays sound" : undefined}
        >
          <VolumeIcon className="size-4" />
        </button>
        <input
          type="range"
          className="music-range min-w-0 flex-1"
          min={0}
          max={100}
          step={1}
          value={Math.round((volume ?? 0) * 100)}
          disabled={volume === null}
          style={{ "--fill": `${Math.round((volume ?? 0) * 100)}%` } as React.CSSProperties}
          onPointerDown={() => (dragging.current = true)}
          onPointerUp={() => (dragging.current = false)}
          onChange={(event) => setVolume(Number(event.currentTarget.value) / 100)}
          aria-label="Spotify volume"
          aria-valuetext={volume === null ? "Unknown" : `${Math.round(volume * 100)}%`}
        />
        <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
          {volume === null ? "" : `${Math.round(volume * 100)}%`}
        </span>
      </div>
    </div>
  );
}
