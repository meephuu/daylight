import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isToday as isTodayDate, parseISO } from "date-fns";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDayEntries, useNowMinutes } from "@/hooks/useDay";
import { formatTimeRange } from "@/lib/calendarItems";
import { toDateString, todayString } from "@/lib/dates";
import { readableTextColor } from "@/lib/notes";
import { layoutTimeline } from "@/lib/timetable";
import { cn } from "@/lib/utils";

/** Vertical scale of the agenda. */
const HOUR_PX = 48;

/**
 * The day as a column of hours. Every block is exactly as tall as it lasts, side by side when things
 * overlap, and a line marks now. Things with no time (all-day items, tasks due today) sit above the
 * hours as a short checklist. Done things stay, struck through.
 */
export function TodayAgenda() {
  const [date, setDate] = useState(todayString);
  const now = useNowMinutes();
  const { entries, toggle } = useDayEntries(date);
  const timeline = useMemo(() => layoutTimeline(entries), [entries]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const day = parseISO(date);
  const isToday = isTodayDate(day);
  const untimed = entries.filter((entry) => entry.startTime === null);
  const hours: number[] = [];
  for (let hour = timeline.startHour; hour <= timeline.endHour; hour += 1) hours.push(hour);
  const top = (minutes: number) => ((minutes - timeline.startHour * 60) / 60) * HOUR_PX;
  const height = (timeline.endHour - timeline.startHour) * HOUR_PX;
  const showNow = isToday && now >= timeline.startHour * 60 && now <= timeline.endHour * 60;

  // Open on the part of the day that matters: a little before now.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    // Open on what matters: the next block still to come (or now, if that is earlier); when everything
    // today is over, the last block; with nothing planned, now.
    const blocks = timeline.blocks;
    const next = blocks.find((block) => block.endMin > now);
    const last = blocks[blocks.length - 1];
    let target: number;
    if (!isToday) target = top(blocks[0]?.startMin ?? 8 * 60) - 24;
    else if (next) target = Math.min(top(now), top(next.startMin)) - 48;
    else if (last) target = top(last.startMin) - 48;
    else target = top(now) - 96;
    element.scrollTo({ top: Math.max(0, target) });
    // Only when the day changes, not every 30 s.
  }, [date]);

  return (
    <section className="pane flex h-full flex-col" aria-labelledby="agenda-title">
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="min-w-0">
          <h2 id="agenda-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
            {isToday ? "Today" : format(day, "EEEE")}
          </h2>
          <p className="text-xs text-muted-foreground">{format(day, "MMMM d")} · {entries.length === 0 ? "nothing planned" : `${entries.length} planned`}</p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, -1)))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayString())}>
              Today
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, 1)))} aria-label="Next day">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {untimed.length > 0 && (
        <ul className="mx-4 mb-2 flex flex-col gap-0.5 border-b border-foreground/10 pb-2">
          {untimed.map((entry) => {
            const checkable = entry.kind === "task" || entry.kind === "reminder";
            return (
              <li key={entry.key} className="flex h-9 items-center gap-3 rounded-xl px-2 hover:bg-foreground/[0.05]">
                {checkable ? (
                  <Checkbox
                    checked={entry.done}
                    onCheckedChange={() => toggle(entry)}
                    aria-label={entry.done ? `Mark ${entry.title} as not done` : `Mark ${entry.title} as done`}
                  />
                ) : (
                  <span className="size-[18px]" />
                )}
                <span className={cn("min-w-0 flex-1 truncate text-sm", entry.done && "text-muted-foreground line-through")}>{entry.title}</span>
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="w-12 shrink-0 text-right text-[11px] text-muted-foreground">All day</span>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-5" style={{ maxHeight: 520 }}>
        <div className="relative" style={{ height: height + 12 }}>
          {hours.map((hour) => (
            <div key={hour} className="absolute right-0 left-0 flex items-start gap-3" style={{ top: top(hour * 60) }}>
              <span className="-mt-2 w-10 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                {String(hour % 24).padStart(2, "0")}:00
              </span>
              <span className="mt-[-1px] h-px flex-1 bg-foreground/[0.08]" />
            </div>
          ))}

          {/* Blocks sit to the right of the hour labels; overlapping ones share the width. */}
          {/* Each lane is at most 220px wide, so a block reads as an entry, not a banner. */}
          <div
            className="absolute top-0 bottom-0 left-[52px]"
            style={{ width: `min(calc(100% - 52px), ${timeline.lanes * 220}px)` }}
          >
            {timeline.blocks.map((block) => {
              const { entry } = block;
              const range = formatTimeRange(entry.startTime, entry.endTime);
              const blockTop = top(block.startMin);
              const blockHeight = Math.max(30, ((block.endMin - block.startMin) / 60) * HOUR_PX - 3);
              const width = 100 / timeline.lanes;
              const tall = blockHeight >= 44;
              return (
                <div
                  key={entry.key}
                  className={cn(
                    "absolute flex overflow-hidden rounded-lg px-2.5 py-1.5 text-xs leading-tight shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
                    tall ? "flex-col justify-start" : "items-center gap-2",
                    entry.done && "opacity-45",
                  )}
                  style={{
                    top: blockTop + 1,
                    height: blockHeight,
                    left: `calc(${block.lane * width}% + 2px)`,
                    width: `calc(${width}% - 4px)`,
                    backgroundColor: `color-mix(in srgb, ${entry.color} 86%, transparent)`,
                    color: readableTextColor(entry.color),
                  }}
                  title={`${entry.title}${range ? ` · ${range}` : ""}`}
                >
                  <span className={cn("flex min-w-0 items-center gap-1 truncate text-[13px] font-semibold", entry.done && "line-through")}>
                    {entry.kind === "reminder" && <Bell className="size-3 shrink-0" />}
                    <span className="truncate">{entry.title}</span>
                  </span>
                  {range && <span className="shrink-0 truncate opacity-80">{range}</span>}
                </div>
              );
            })}
          </div>

          {showNow && (
            <div className="pointer-events-none absolute right-0 left-[44px] z-10 flex items-center" style={{ top: top(now) - 4 }}>
              <span className="size-2 rounded-full bg-sky-accent ring-2 ring-[color-mix(in_srgb,var(--sky-accent)_35%,transparent)]" />
              <span className="h-0.5 flex-1 rounded bg-sky-accent" />
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 && (
        <p className="px-6 pb-5 text-sm text-muted-foreground">
          A clear day. Plan something from the{" "}
          <Link to="/calendar" className="font-medium text-foreground underline underline-offset-4">
            Calendar
          </Link>
          .
        </p>
      )}
    </section>
  );
}
