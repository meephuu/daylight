import { useEffect, useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { formatTrackTime, useCoverColor, useNowPlaying } from "@/lib/nowPlaying";
import { cn } from "@/lib/utils";

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** Three small bars that dance while music plays; still (and shorter) when it does not. */
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className={cn("eq-bar w-[3px] rounded-full bg-sky-accent", playing ? "eq-on" : "h-1")}
          style={{ animationDelay: `${bar * -0.35}s` }}
        />
      ))}
    </span>
  );
}

/**
 * The music on this PC: what Spotify is playing now, or the last song it played. The cover leads, the
 * card takes the cover's colour through the glass, and play/pause/skip work right here.
 */
export function NowPlayingCard() {
  const { track, receivedAt, last, control } = useNowPlaying();
  const shown = track ?? last;
  const art = shown?.art ?? null;
  const tint = useCoverColor(art);

  // Move the progress bar between polls while playing.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!track?.playing) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [track?.playing]);

  const duration = track?.durationMs ?? null;
  const position =
    track?.positionMs != null && duration
      ? Math.min(duration, track.positionMs + (track.playing ? performance.now() - receivedAt : 0))
      : null;

  const status = track ? (track.playing ? "Now playing" : "Paused") : "Last played";
  const live = track !== null;

  return (
    <section
      className="pane flex flex-col gap-4 p-5 transition-[background] duration-700"
      aria-labelledby="now-playing-title"
      style={
        tint
          ? {
              // The cover's colour, poured through the glass (kept light, so text stays readable).
              background: `linear-gradient(150deg, color-mix(in srgb, ${tint} 34%, transparent), color-mix(in srgb, ${tint} 8%, transparent) 75%), var(--glass-fill)`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="now-playing-title" className="flex items-center gap-2 font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
          {shown ? status : "Music"}
          {live && <Equalizer playing={track.playing} />}
        </h2>
        <span className="text-xs text-muted-foreground">
          {!live && last ? ago(last.seenAt) : "Spotify"}
        </span>
      </div>

      {shown ? (
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative size-[72px] shrink-0 overflow-hidden rounded-[8px] bg-foreground/10 shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)]">
            {art ? (
              <img src={art} alt="" className={cn("size-full object-cover transition-[filter] duration-500", !live && "grayscale-[0.35]")} />
            ) : (
              <Music2 className="absolute inset-0 m-auto size-7 text-foreground/50" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold leading-snug" title={shown.title}>
              {shown.title}
            </p>
            <p className="truncate text-sm text-foreground/75" title={shown.artist}>
              {shown.artist}
            </p>
            {shown.album && (
              <p className="truncate text-xs text-muted-foreground" title={shown.album}>
                {shown.album}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-[8px] bg-foreground/[0.07]">
            <Music2 className="size-6" aria-hidden="true" />
          </span>
          Play something on Spotify and it shows up here.
        </div>
      )}

      {live && (
        // Pinned to the bottom when the card is stretched to match Next up.
        <div className="mt-auto flex flex-col gap-3">
          {duration !== null && position !== null && (
            <div>
              <div
                className="h-1 overflow-hidden rounded-full bg-foreground/15"
                role="progressbar"
                aria-label="Track progress"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration / 1000)}
                aria-valuenow={Math.round(position / 1000)}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(position / duration) * 100}%`, backgroundColor: tint ?? "var(--sky-accent)" }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{formatTrackTime(position)}</span>
                <span>{formatTrackTime(duration)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void control("previous")}
              aria-label="Previous track"
              className="grid size-9 place-items-center rounded-full text-foreground/80 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SkipBack className="size-4" fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => void control("toggle")}
              aria-label={track.playing ? "Pause" : "Play"}
              className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_14px_-8px_rgb(0_0_0/0.45)] outline-none transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {track.playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
            </button>
            <button
              type="button"
              onClick={() => void control("next")}
              aria-label="Next track"
              className="grid size-9 place-items-center rounded-full text-foreground/80 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <SkipForward className="size-4" fill="currentColor" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
