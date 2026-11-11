import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarItems, useOccurrenceStates, useSetOccurrenceState } from "@/hooks/useCalendarItems";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import { formatTimeRange, stateMap, timeToMinutes } from "@/lib/calendarItems";
import { toDateString, todayString } from "@/lib/dates";
import { readableTextColor } from "@/lib/notes";
import { ENTRY_KIND_LABELS, entriesForDate, type ScheduleEntry } from "@/lib/schedule";
import { blockPosition, layoutTimeline } from "@/lib/timetable";
import { cn } from "@/lib/utils";

const LANE_HEIGHT = 46;

/** Minutes since midnight, refreshed every 30 s so the "now" marker moves. */
export function useNowMinutes(): number {
  const read = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };
  const [minutes, setMinutes] = useState(read);
  useEffect(() => {
    const id = window.setInterval(() => setMinutes(read()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return minutes;
}

/** Today's (or another day's) tasks, events and reminders, plus the action that checks one off. */
export function useDayEntries(date: string) {
  const tasksQuery = useTasks();
  const itemsQuery = useCalendarItems();
  const statesQuery = useOccurrenceStates();
  const setTaskStatus = useSetTaskStatus();
  const setOccurrenceState = useSetOccurrenceState();

  const states = useMemo(() => stateMap(statesQuery.data ?? []), [statesQuery.data]);
  const entries = useMemo(
    () => entriesForDate(date, tasksQuery.data ?? [], itemsQuery.data ?? [], states),
    [date, tasksQuery.data, itemsQuery.data, states],
  );

  function toggle(entry: ScheduleEntry) {
    if (entry.task) {
      setTaskStatus.mutate({ id: entry.task.id, status: entry.done ? "todo" : "done" });
    } else if (entry.occurrence && entry.kind === "reminder") {
      setOccurrenceState.mutate({
        itemId: entry.occurrence.item.id,
        date: entry.date,
        state: entry.done ? null : "done",
      });
    }
  }

  return { entries, toggle };
}

/** Total minutes of the day that have a real start and end (events), for the "planned" summary. */
function plannedMinutes(entries: ScheduleEntry[]): number {
  return entries.reduce((sum, entry) => {
    const start = timeToMinutes(entry.startTime);
    const end = timeToMinutes(entry.endTime);
    return start !== null && end !== null && end > start ? sum + (end - start) : sum;
  }, 0);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

interface DayTimetableProps {
  /** The page greeting, shown at the top of the slab. */
  title: string;
  message: string;
}

/**
 * Home's lead slab: the greeting, then the day drawn as one strip where every block is exactly as
 * long as it lasts and the part of the day already gone is dimmed, then the day's list (where
 * reminders and tasks are checked off). Done things stay in place, struck through.
 */
export function DayTimetable({ title, message }: DayTimetableProps) {
  const [date, setDate] = useState(todayString);
  const nowMinutes = useNowMinutes();
  const { entries, toggle } = useDayEntries(date);
  const timeline = useMemo(() => layoutTimeline(entries), [entries]);

  const isToday = date === todayString();
  const day = parseISO(date);
  const hourStep = timeline.endHour - timeline.startHour > 12 ? 2 : 1;
  const hours: number[] = [];
  for (let hour = timeline.startHour; hour <= timeline.endHour; hour += hourStep) hours.push(hour);
  const axisPercent = (minutes: number) =>
    ((minutes - timeline.startHour * 60) / ((timeline.endHour - timeline.startHour) * 60)) * 100;
  const nowPercent = Math.min(100, Math.max(0, axisPercent(nowMinutes)));
  const showNow = isToday && nowMinutes >= timeline.startHour * 60 && nowMinutes <= timeline.endHour * 60;

  const open = entries.filter((entry) => !entry.done).length;
  const planned = plannedMinutes(entries);

  return (
    <section className="@container glass flex h-full flex-col gap-5 rounded-2xl p-6" aria-labelledby="home-greeting">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 id="home-greeting" className="text-[32px] leading-tight font-semibold tracking-[-0.025em]">
            {title}
          </h1>
          <p className="mt-1 text-[15px] text-foreground/80">{message}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, -1)))} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDate(todayString())}
            disabled={isToday}
            className="min-w-36 font-semibold disabled:opacity-100"
          >
            {isToday ? format(day, "EEEE, MMMM d") : format(day, "EEE, MMM d")}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, 1)))} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-4 text-xs text-muted-foreground">
          <span>
            {entries.length === 0
              ? "Nothing scheduled"
              : `${entries.length} ${entries.length === 1 ? "thing" : "things"}${open < entries.length ? ` · ${open} still open` : ""}${planned > 0 ? ` · ${formatDuration(planned)} of events` : ""}`}
          </span>
          {!isToday && (
            <button type="button" className="font-medium text-foreground/80 hover:text-foreground" onClick={() => setDate(todayString())}>
              Back to today
            </button>
          )}
        </div>

        {/* The day as one strip: blocks are placed by time and sized by length. */}
        <div
          className="relative overflow-hidden rounded-xl bg-foreground/[0.06] shadow-[inset_0_0_0_1px_var(--glass-rim)] dark:bg-white/[0.06]"
          style={{ height: timeline.lanes * LANE_HEIGHT + 8 }}
          role="img"
          aria-label={`Timetable for ${format(day, "EEEE, MMMM d")}`}
        >
          {/* The part of today that has already gone, dimmed. */}
          {showNow && (
            <span
              className="absolute inset-y-0 left-0 bg-foreground/[0.05] dark:bg-black/[0.14]"
              style={{ width: `${nowPercent}%` }}
            />
          )}

          {hours.slice(1, -1).map((hour) => (
            <span
              key={hour}
              className="absolute top-0 bottom-0 w-px bg-foreground/[0.07]"
              style={{ left: `${axisPercent(hour * 60)}%` }}
            />
          ))}

          {timeline.blocks.map((block) => {
            const { left, width } = blockPosition(block, timeline);
            const { entry } = block;
            const range = formatTimeRange(entry.startTime, entry.endTime);
            return (
              <div
                key={entry.key}
                className={cn(
                  "absolute flex flex-col justify-center overflow-hidden rounded-lg px-2.5 text-xs leading-tight shadow-[inset_0_1px_0_rgb(255_255_255/0.45),inset_0_0_0_1px_rgb(255_255_255/0.12)]",
                  entry.done && "opacity-45",
                )}
                style={{
                  left: `calc(${left}% + 2px)`,
                  width: `calc(${width}% - 4px)`,
                  top: 4 + block.lane * LANE_HEIGHT,
                  height: LANE_HEIGHT - 4,
                  backgroundColor: `color-mix(in srgb, ${entry.color} 84%, transparent)`,
                  color: readableTextColor(entry.color),
                }}
                title={`${entry.title}${range ? ` · ${range}` : ""}`}
              >
                <span className={cn("truncate font-semibold", entry.done && "line-through")}>{entry.title}</span>
                {range && <span className="truncate opacity-80">{range}</span>}
              </div>
            );
          })}

          {showNow && (
            <span
              className="now-line pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 -translate-x-1/2 rounded bg-sky-accent shadow-[2px_0_8px_rgb(0_0_0/0.25)]"
              style={{ left: `${nowPercent}%` }}
              title="Now"
            />
          )}
        </div>

        <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground">
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 tabular-nums first:translate-x-0 last:-translate-x-full"
              style={{ left: `${axisPercent(hour * 60)}%` }}
            >
              {String(hour % 24).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A clear day. Add events and reminders from the{" "}
          <Link to="/calendar" className="font-medium text-foreground underline underline-offset-4">
            Calendar
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-x-6 gap-y-0.5 @3xl:grid-cols-2">
          {entries.map((entry) => {
            const range = formatTimeRange(entry.startTime, entry.endTime);
            const checkable = entry.kind === "task" || entry.kind === "reminder";
            return (
              <li key={entry.key} className="flex h-9 items-center gap-3 rounded-lg px-2 hover:bg-foreground/[0.05]">
                <span className="w-[92px] shrink-0 text-xs text-muted-foreground tabular-nums">{range ?? "All day"}</span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className={cn("min-w-0 flex-1 truncate text-sm", entry.done && "text-muted-foreground line-through")}>
                  {entry.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{ENTRY_KIND_LABELS[entry.kind]}</span>
                {checkable ? (
                  <Checkbox
                    checked={entry.done}
                    onCheckedChange={() => toggle(entry)}
                    aria-label={entry.done ? `Mark ${entry.title} as not done` : `Mark ${entry.title} as done`}
                  />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
