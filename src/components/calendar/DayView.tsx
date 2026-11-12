import { useMemo } from "react";
import { format, isSameDay, isToday as isTodayDate } from "date-fns";
import { Bell } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNowMinutes } from "@/hooks/useDay";
import { useSetOccurrenceState } from "@/hooks/useCalendarItems";
import { useSetTaskStatus } from "@/hooks/useTasks";
import { weekOf } from "@/lib/calendar";
import { formatTimeRange, minutesToTime, timeToMinutes } from "@/lib/calendarItems";
import { toDateString } from "@/lib/dates";
import { readableTextColor } from "@/lib/notes";
import { ENTRY_KIND_LABELS, type ScheduleEntry } from "@/lib/schedule";
import { layoutTimeline } from "@/lib/timetable";
import { cn } from "@/lib/utils";

/** Vertical scale: one hour of the day. */
const HOUR_PX = 56;
/** Room above the first hour line, so its label (centred on the line) is never cut off. */
const PAD_TOP = 12;
/** The hour labels' column. */
const GUTTER_PX = 60;
/** A lane is at most this wide, so a block reads as an entry, not a banner. */
const MAX_LANE_PX = 440;

interface DayViewProps {
  day: Date;
  /** Entries for every day of the day's week (the strip shows which days have something). */
  entriesByDate: Map<string, ScheduleEntry[]>;
  onPickDay: (day: Date) => void;
  onAdd: (date: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
}

/** Total minutes covered by timed entries that have an end, counting overlaps once. */
function plannedMinutes(entries: ScheduleEntry[]): number {
  const spans = entries
    .map((entry) => [timeToMinutes(entry.startTime), timeToMinutes(entry.endTime)] as const)
    .filter((span): span is readonly [number, number] => span[0] !== null && span[1] !== null && span[1] > span[0])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reach = -1;
  for (const [start, end] of spans) {
    if (end <= reach) continue;
    total += end - Math.max(start, reach);
    reach = end;
  }
  return total;
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return "None";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  // Compact, so it fits one line in the narrow side pane.
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * One day, in full. The main pane is the day as a column of hours: blocks as tall as they last, side by
 * side when they overlap, all-day things above the hours and a line at now. The side pane moves through
 * the week and lists the day in order as a checklist.
 */
export function DayView({ day, entriesByDate, onPickDay, onAdd, onEdit }: DayViewProps) {
  const date = toDateString(day);
  const entries = useMemo(() => entriesByDate.get(date) ?? [], [entriesByDate, date]);
  const timeline = useMemo(() => layoutTimeline(entries), [entries]);
  const now = useNowMinutes();
  const isToday = isTodayDate(day);

  const setTaskStatus = useSetTaskStatus();
  const setOccurrenceState = useSetOccurrenceState();
  function toggle(entry: ScheduleEntry) {
    if (entry.task) setTaskStatus.mutate({ id: entry.task.id, status: entry.done ? "todo" : "done" });
    else if (entry.occurrence && entry.kind === "reminder") {
      setOccurrenceState.mutate({ itemId: entry.occurrence.item.id, date: entry.date, state: entry.done ? null : "done" });
    }
  }

  const untimed = entries.filter((entry) => entry.startTime === null);
  const checkable = (entry: ScheduleEntry) => entry.kind === "task" || entry.kind === "reminder";
  const open = entries.filter((entry) => checkable(entry) && !entry.done).length;
  const done = entries.filter((entry) => checkable(entry) && entry.done).length;
  const planned = plannedMinutes(entries);

  const hours: number[] = [];
  for (let hour = timeline.startHour; hour <= timeline.endHour; hour += 1) hours.push(hour);
  const top = (minutes: number) => PAD_TOP + ((minutes - timeline.startHour * 60) / 60) * HOUR_PX;
  const gridHeight = (timeline.endHour - timeline.startHour) * HOUR_PX;
  const showNow = isToday && now >= timeline.startHour * 60 && now <= timeline.endHour * 60;
  const laneWidth = `min(calc((100% - ${GUTTER_PX}px) / ${timeline.lanes}), ${MAX_LANE_PX}px)`;

  return (
    <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
      {/* ---------------------------------------------------------------- the day */}
      <section className="pane flex min-w-0 flex-col overflow-hidden" aria-label={`Schedule for ${format(day, "EEEE, MMMM d")}`}>
        {untimed.length > 0 && (
          <div className="flex items-start gap-3 border-b border-foreground/10 px-5 py-3">
            <span className="w-[44px] shrink-0 pt-1.5 text-right text-[11px] text-muted-foreground">All day</span>
            <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {untimed.map((entry) => (
                <li
                  key={entry.key}
                  className="flex h-8 max-w-full items-center gap-2 rounded-full bg-foreground/[0.06] pr-3 pl-2 text-sm dark:bg-white/[0.07]"
                >
                  {checkable(entry) ? (
                    <Checkbox
                      checked={entry.done}
                      onCheckedChange={() => toggle(entry)}
                      aria-label={entry.done ? `Mark ${entry.title} as not done` : `Mark ${entry.title} as done`}
                    />
                  ) : (
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className={cn("strike truncate text-left outline-none focus-visible:underline", entry.done && "strike-on text-muted-foreground")}
                  >
                    {entry.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clicking empty time adds something to this day. */}
        <div className="cursor-pointer px-4 pt-2 pb-5" onClick={() => onAdd(date)} title="Click to add to this day">
          <div className="relative" style={{ height: PAD_TOP + gridHeight + 8 }}>
            {hours.map((hour) => (
              <div key={hour} className="absolute right-0 left-0" style={{ top: top(hour * 60) }}>
                <div className="flex items-start gap-3">
                  <span className="-mt-2 w-[44px] shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                    {minutesToTime((hour % 24) * 60)}
                  </span>
                  <span className="h-px flex-1 bg-foreground/[0.09]" />
                </div>
                {/* A fainter half-hour line, so times between the hours can be read off the grid. */}
                {hour < timeline.endHour && (
                  <span
                    className="absolute right-0 h-px border-t border-dashed border-foreground/[0.06]"
                    style={{ top: HOUR_PX / 2, left: GUTTER_PX - 4 }}
                  />
                )}
              </div>
            ))}

            <div className="absolute top-0 bottom-0" style={{ left: GUTTER_PX, right: 0 }}>
              {timeline.blocks.map((block) => {
                const { entry } = block;
                const range = formatTimeRange(entry.startTime, entry.endTime);
                const height = Math.max(32, ((block.endMin - block.startMin) / 60) * HOUR_PX - 4);
                const roomy = height >= 76;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(entry);
                    }}
                    className={cn(
                      "absolute flex flex-col items-start overflow-hidden rounded-xl px-3 py-2 text-left leading-tight shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_14px_-10px_rgb(0_0_0/0.5)] outline-none",
                      "transition-[filter,translate] duration-150 hover:-translate-y-px hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/50",
                      entry.done && "opacity-45",
                    )}
                    style={{
                      top: top(block.startMin) + 2,
                      height,
                      left: `calc(${laneWidth} * ${block.lane} + 2px)`,
                      width: `calc(${laneWidth} - 4px)`,
                      backgroundColor: `color-mix(in srgb, ${entry.color} 86%, transparent)`,
                      color: readableTextColor(entry.color),
                    }}
                    title={`${entry.title}${range ? ` · ${range}` : ""}`}
                  >
                    <span className={cn("flex max-w-full items-center gap-1.5 text-[14px] font-semibold", entry.done && "line-through")}>
                      {entry.kind === "reminder" && <Bell className="size-3.5 shrink-0" aria-hidden="true" />}
                      <span className="truncate">{entry.title}</span>
                    </span>
                    {range && <span className="mt-0.5 text-xs opacity-85 tabular-nums">{range}</span>}
                    {roomy && <span className="mt-auto text-[11px] opacity-75">{ENTRY_KIND_LABELS[entry.kind]}</span>}
                  </button>
                );
              })}
            </div>

            {showNow && (
              <div className="pointer-events-none absolute right-0 left-0 z-10 flex items-center" style={{ top: top(now) - 9 }}>
                <span className="w-[52px] shrink-0 text-right">
                  <span className="rounded-full bg-sky-accent px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums shadow-[0_2px_8px_-2px_var(--sky-accent)] dark:text-[#0b1033]">
                    {minutesToTime(now)}
                  </span>
                </span>
                <span className="ml-1 h-0.5 flex-1 rounded bg-sky-accent" />
              </div>
            )}
          </div>
        </div>

        {entries.length === 0 && (
          <p className="-mt-2 px-6 pb-5 text-sm text-muted-foreground">Nothing planned. Click anywhere on the day to add something.</p>
        )}
      </section>

      {/* ---------------------------------------------------------------- the side */}
      <aside className="flex min-w-0 flex-col gap-3 md:sticky md:top-12">
        <section className="pane p-3" aria-label="This week">
          <div className="grid grid-cols-7 gap-0.5">
            {weekOf(day).map((other) => {
              const otherEntries = entriesByDate.get(toDateString(other)) ?? [];
              const selected = isSameDay(other, day);
              const today = isTodayDate(other);
              return (
                <button
                  key={other.toISOString()}
                  type="button"
                  onClick={() => onPickDay(other)}
                  aria-pressed={selected}
                  aria-label={`${format(other, "EEEE, MMMM d")}${otherEntries.length ? `, ${otherEntries.length} planned` : ""}`}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl py-2 outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected
                      ? "bg-white/85 shadow-[inset_0_1px_0_var(--glass-edge)] dark:bg-white/[0.14]"
                      : "hover:bg-white/40 dark:hover:bg-white/[0.07]",
                  )}
                >
                  <span className="text-[11px] text-muted-foreground">{format(other, "EEEEE")}</span>
                  <span className={cn("font-display text-[17px] font-semibold tabular-nums", today && "text-sky-accent")}>{other.getDate()}</span>
                  <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                    {otherEntries.slice(0, 3).map((entry) => (
                      <span key={entry.key} className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="pane flex flex-col gap-4 p-5" aria-labelledby="day-list-title">
          <h2 id="day-list-title" className="font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
            {isToday ? "Today" : format(day, "EEEE")}
          </h2>

          {/* The day's numbers, set as type with hairlines between them. */}
          <dl className="grid grid-cols-3 divide-x divide-foreground/10 text-center">
            <div className="px-1">
              <dt className="text-[11px] text-muted-foreground">Planned</dt>
              <dd className="mt-0.5 text-sm font-semibold whitespace-nowrap tabular-nums">{formatDuration(planned)}</dd>
            </div>
            <div className="px-1">
              <dt className="text-[11px] text-muted-foreground">To do</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{open}</dd>
            </div>
            <div className="px-1">
              <dt className="text-[11px] text-muted-foreground">Done</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{done}</dd>
            </div>
          </dl>

          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">A clear day.</p>
          ) : (
            <ol className="-mx-2 flex flex-col">
              {entries.map((entry) => (
                <li key={entry.key} className="flex min-h-9 items-center gap-2.5 rounded-xl px-2 hover:bg-foreground/[0.05]">
                  {checkable(entry) ? (
                    <Checkbox
                      checked={entry.done}
                      onCheckedChange={() => toggle(entry)}
                      aria-label={entry.done ? `Mark ${entry.title} as not done` : `Mark ${entry.title} as done`}
                    />
                  ) : (
                    <span className="flex size-[18px] shrink-0 items-center justify-center" aria-hidden="true">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className="min-w-0 flex-1 truncate text-left text-sm outline-none focus-visible:underline"
                  >
                    {/* The strike is drawn on the words only, not across the whole row. */}
                    <span className={cn("strike", entry.done && "strike-on text-muted-foreground")}>{entry.title}</span>
                  </button>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{entry.startTime ?? "All day"}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
