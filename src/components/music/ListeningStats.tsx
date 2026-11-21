import { useMemo, useState } from "react";
import { addDays, addMonths, format, getDaysInMonth, parseISO, startOfWeek } from "date-fns";
import { Loader2, Music2, Play, UserRound } from "lucide-react";
import { PeriodStepper } from "@/components/PeriodStepper";
import { Segmented } from "@/components/Segmented";
import { useListeningDays, useSpotifyArtistImage, useSpotifyPlay, useTopArtists, useTopTracks } from "@/hooks/useMusic";
import { bangkokToday } from "@/lib/bangkok";
import type { TopArtist, TopTrack } from "@/lib/db/music";
import { canReadHistory, connectSpotify, explain, findTrack, useSpotify } from "@/lib/spotify";
import { showToast } from "@/lib/toast";
import { monthTitle, toDateString, weekTitle } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Range = "week" | "month";

/** 4 h 12 min, 35 min, under a minute. */
export function formatListening(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return ms > 0 ? "under 1 min" : "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * The days the chart shows: a week (Sunday first) or a month, in Bangkok; `offset` 0 is the current one,
 * -1 the one before, and so on.
 */
function rangeDays(range: Range, today: string, offset: number): string[] {
  const day = parseISO(today);
  if (range === "week") {
    const sunday = addDays(startOfWeek(day, { weekStartsOn: 0 }), offset * 7);
    return Array.from({ length: 7 }, (_, index) => toDateString(addDays(sunday, index)));
  }
  const first = addMonths(parseISO(`${today.slice(0, 7)}-01`), offset);
  return Array.from({ length: getDaysInMonth(first) }, (_, index) => toDateString(addDays(first, index)));
}

/** Time listened per day: one bar a day, today's label marked; hover a bar for its exact time. */
function DayBars({
  days,
  totals,
  today,
  range,
  label,
}: {
  days: string[];
  totals: Map<string, number>;
  today: string;
  range: Range;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((day) => totals.get(day) ?? 0), 1);
  const hovered = hover !== null ? days[hover] : undefined;

  return (
    <figure className="relative" aria-label={`Time listened per day, ${label}`}>
      <div className="flex h-[76px] items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
        {days.map((day, index) => {
          const ms = totals.get(day) ?? 0;
          const future = day > today;
          return (
            <div
              key={day}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(index)}
              role="img"
              aria-label={`${format(parseISO(day), "EEE d MMM")}: ${formatListening(ms)}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-[height,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  ms > 0 ? "bg-[var(--series-1)]" : "bg-foreground/12",
                  hover !== null && hover !== index && "opacity-55",
                )}
                style={{
                  height: ms > 0 ? `max(${(ms / max) * 100}%, 3px)` : future ? "0px" : "2px",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[11px] text-muted-foreground tabular-nums">
        {days.map((day, index) => {
          const date = parseISO(day);
          const isToday = day === today;
          // Every day in a week; in a month, the 1st and every 5th day (and today).
          const show = range === "week" || isToday || index === 0 || (index + 1) % 5 === 0;
          return (
            <span key={day} className={cn("flex-1 text-center", isToday && "font-semibold text-foreground")}>
              {show ? (range === "week" ? format(date, "EEEEE") : format(date, "d")) : ""}
            </span>
          );
        })}
      </div>
      {hovered && hover !== null && (
        <div
          className="glass-strong pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-[12px] px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
        >
          <span className="text-muted-foreground">{format(parseISO(hovered), "EEE d MMM")}</span>{" "}
          <span className="font-semibold tabular-nums">{formatListening(totals.get(hovered) ?? 0)}</span>
        </div>
      )}
    </figure>
  );
}

/**
 * The period's top artists: the first one large, with their photo (from Spotify when it is connected,
 * else the cover of their most-heard song), name and time; the runners-up beside it, each with a thin
 * meter measured against the first.
 */
function TopArtists({ artists }: { artists: TopArtist[] | undefined }) {
  const [first, ...rest] = artists ?? [];
  const { data: photo } = useSpotifyArtistImage(first?.artist ?? null);
  const picture = photo ?? first?.art ?? null;

  return (
    <section className="pane min-w-0 p-5" aria-labelledby="top-artists-title">
      <h2 id="top-artists-title" className="mb-3 font-display text-[17px] leading-tight font-semibold tracking-[-0.02em]">
        Top artists
      </h2>
      {!first ? (
        artists && <p className="text-sm text-muted-foreground">Artists show here once you hear a song for 30 seconds.</p>
      ) : (
        // The photo sets the block's height; the runners-up spread over the same height beside it.
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-stretch gap-4">
          {/* The first place: the photo takes two fifths of the card, which fills the height Top songs sets. */}
          <div className="flex w-full max-w-[180px] min-w-0 flex-col">
            <span className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[14px] bg-foreground/10 shadow-[0_12px_26px_-16px_rgb(0_0_0/0.8)] ring-1 ring-white/12">
              {picture ? (
                <img src={picture} alt="" className="size-full object-cover" draggable={false} />
              ) : (
                <UserRound className="size-1/2 text-foreground/45" aria-hidden="true" />
              )}
            </span>
            <p className="mt-2 truncate text-[14px] leading-tight font-semibold" title={first.artist}>
              {first.artist}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
              {formatListening(first.ms)} · {first.songs} {first.songs === 1 ? "song" : "songs"}
            </p>
          </div>

          {/* The rest, measured against the first. */}
          {rest.length === 0 ? (
            <p className="self-center text-xs text-muted-foreground">The only artist this period.</p>
          ) : (
            <ol className="flex min-w-0 flex-col gap-3.5 pt-0.5" start={2}>
              {rest.map((artist, index) => (
                <li key={artist.artist} className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="w-3 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 2}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={artist.artist}>
                      {artist.artist}
                    </span>
                    <span className="shrink-0 text-xs text-foreground/75 tabular-nums">{formatListening(artist.ms)}</span>
                  </div>
                  <div className="mt-1 ml-5 h-1 rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-[var(--series-1)]"
                      style={{ width: `${(artist.ms / first.ms) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * How much music this week or month, and what: time per day (one pane), then the top songs and the top
 * artists side by side (a pane each). Built from the history Daylight keeps of what Spotify played on this PC.
 */
export function ListeningStats({ beside }: { beside?: React.ReactNode }) {
  const [range, setRange] = useState<Range>("week");
  // 0: this week / month; -1: the one before, and so on.
  const [offset, setOffset] = useState(0);
  const today = bangkokToday();
  const days = useMemo(() => rangeDays(range, today, offset), [range, today, offset]);
  const from = days[0]!;
  // The day after the period: the queries count plays before it.
  const before = toDateString(addDays(parseISO(days[days.length - 1]!), 1));
  const { data: dayRows } = useListeningDays(from, before);
  const { data: tracks } = useTopTracks(from, before);
  const { data: artists } = useTopArtists(from, before);

  const totals = useMemo(() => new Map((dayRows ?? []).map((row) => [row.day, row.ms])), [dayRows]);
  const rangeTotal = days.reduce((sum, day) => sum + (totals.get(day) ?? 0), 0);
  const todayTotal = totals.get(today) ?? 0;
  const empty = dayRows !== undefined && rangeTotal === 0;
  const current = offset === 0;
  // "This week", "Last week", "8 – 14 Nov"; "This month", "Last month", "October".
  const title = range === "week" ? weekTitle(from, today) : monthTitle(from.slice(0, 7), today);
  // As it reads after a total: "this week", "last month", "8 – 14 Nov", "in October".
  const label = /^(This|Last) /.test(title) ? title.toLowerCase() : range === "month" ? `in ${title}` : title;

  // Playing a top song: found on Spotify by its title and artist, then played like a search result (its
  // album, from that song on), on this PC's Spotify.
  const connected = useSpotify((state) => state.auth !== null);
  // Sign-ins from before the phone history was added lack its permission until Spotify is connected again.
  const needsReconnect = useSpotify((state) => state.auth !== null && !canReadHistory(state.auth));
  const clientId = useSpotify((state) => state.auth?.clientId ?? "");
  const reconnecting = useSpotify((state) => state.connecting);
  const playOnSpotify = useSpotifyPlay();
  const [starting, setStarting] = useState<number | null>(null);
  const playTop = async (track: TopTrack) => {
    if (!connected) {
      showToast({ message: "Connect your Spotify account below to play songs from here." });
      return;
    }
    setStarting(track.id);
    try {
      const found = await findTrack(track.title, track.artist);
      if (!found) {
        showToast({ message: `Could not find "${track.title}" on Spotify.` });
        return;
      }
      const result = await playOnSpotify.mutateAsync(
        found.album?.uri ? { contextUri: found.album.uri, offsetUri: found.uri } : { uris: [found.uri] },
      );
      showToast({ message: result.thisPc ? `Playing "${track.title}"` : `Playing "${track.title}" on ${result.device}` });
    } catch (error) {
      showToast({ message: explain(error) });
    } finally {
      setStarting(null);
    }
  };

  return (
    <>
      {/* The player controls, then Listening beside them (stacked, controls first, in a narrow window). */}
      <div className="grid gap-3 lg:grid-cols-[minmax(300px,0.72fr)_minmax(0,1fr)]">
        {beside}
        <section className="pane flex flex-col gap-5 p-5" aria-labelledby="listening-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="listening-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
              Listening
            </h2>
            <PeriodStepper
              className="ml-auto"
              unit={range}
              canForward={!current}
              // No "This week" link here: the pane is too narrow for it beside the switch (the row would
              // wrap and jump); pressing Week / Month, even the one already chosen, goes back to the current period.
              onStep={(direction) => setOffset((value) => Math.min(0, value + direction))}
            />
            <Segmented
              size="sm"
              semantics="tabs"
              aria-label="Listening period"
              value={range}
              onChange={(next) => {
                setRange(next);
                setOffset(0);
              }}
              options={[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
            />
          </div>

          {/* Totals as type: two equal columns across the card, split by a hairline (left out for an
              earlier period with nothing in it, where they would only say 0 twice). */}
          <div className={cn("grid grid-cols-[1fr_auto_1fr] items-stretch gap-5", empty && !current && "hidden")}>
            <div className="min-w-0">
              <p className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {formatListening(current ? todayTotal : rangeTotal / days.length)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{current ? "today" : "a day on average"}</p>
            </div>
            <span className="w-px bg-foreground/12" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
                {formatListening(rangeTotal)}
              </p>
              <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
            </div>
          </div>

          {empty ? (
            current ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet this {range}. Daylight keeps a note of what Spotify plays on this PC, even from the tray, and it adds
                up here.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing played {label}.</p>
            )
          ) : (
            <DayBars days={days} totals={totals} today={today} range={range} label={label} />
          )}
          {needsReconnect && (
            <p className="text-xs text-muted-foreground">
              Count what you play on your phone too: Spotify needs one more permission.{" "}
              <button
                type="button"
                disabled={reconnecting}
                onClick={() => void connectSpotify(clientId)}
                className="font-medium text-foreground underline underline-offset-2 outline-none hover:text-sky-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                {reconnecting ? "Waiting for Spotify…" : "Connect again"}
              </button>
            </p>
          )}
        </section>
      </div>

      {/* The top songs and artists of the same period, each in its own pane. */}
      {!empty && (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="pane min-w-0 p-5" aria-labelledby="top-songs-title">
            <h2 id="top-songs-title" className="mb-3 font-display text-[17px] leading-tight font-semibold tracking-[-0.02em]">
              Top songs
            </h2>
            {tracks?.length === 0 && (
              <p className="text-sm text-muted-foreground">Songs show here once you hear one for 30 seconds.</p>
            )}
            <ol className="-mx-2 flex flex-col gap-0.5">
              {(tracks ?? []).map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => void playTop(track)}
                    disabled={starting !== null}
                    title={`Play "${track.title}"`}
                    className="group/song flex w-full min-w-0 items-center gap-2.5 rounded-[14px] px-2 py-1 text-left outline-none transition-colors hover:bg-foreground/[0.06] focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/[0.09] disabled:cursor-progress"
                  >
                    <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[5px] bg-foreground/10">
                      {track.art ? (
                        <img src={track.art} alt="" className="size-full object-cover" />
                      ) : (
                        <Music2 className="size-4 text-foreground/50" aria-hidden="true" />
                      )}
                      {/* A play mark over the cover on hover; a spinner while it starts. */}
                      <span
                        className={cn(
                          "absolute inset-0 grid place-items-center bg-black/45 text-white transition-opacity duration-150",
                          starting === track.id ? "opacity-100" : "opacity-0 group-hover/song:opacity-100 group-focus-visible/song:opacity-100",
                        )}
                        aria-hidden="true"
                      >
                        {starting === track.id ? (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                        ) : (
                          <Play className="ml-0.5 size-3.5" fill="currentColor" />
                        )}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] leading-snug font-medium">{track.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
                    </span>
                    <span
                      className="shrink-0 text-xs text-foreground/75 tabular-nums"
                      title={`${track.plays} ${track.plays === 1 ? "play" : "plays"}`}
                    >
                      {formatListening(track.ms)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <TopArtists artists={artists} />
        </div>
      )}
    </>
  );
}
