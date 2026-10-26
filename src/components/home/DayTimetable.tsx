import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCalendarItems, useOccurrenceStates, useSetOccurrenceState } from "@/hooks/useCalendarItems";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import { formatTimeRange, stateMap } from "@/lib/calendarItems";
import { toDateString, todayString } from "@/lib/dates";
import { readableTextColor } from "@/lib/notes";
import { ENTRY_KIND_LABELS, entriesForDate, type ScheduleEntry } from "@/lib/schedule";
import { blockPosition, layoutTimeline } from "@/lib/timetable";
import { cn } from "@/lib/utils";

const LANE_HEIGHT = 48;

/** Minutes since midnight, refreshed every 30 s so the "now" marker moves. */
function useNowMinutes(): number {
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

export function DayTimetable() {
  const [date, setDate] = useState(todayString);
  const nowMinutes = useNowMinutes();

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
  const timeline = useMemo(() => layoutTimeline(entries), [entries]);

  const isToday = date === todayString();
  const day = parseISO(date);
  const hourStep = timeline.endHour - timeline.startHour > 12 ? 2 : 1;
  const hours: number[] = [];
  for (let hour = timeline.startHour; hour <= timeline.endHour; hour += hourStep) hours.push(hour);
  const axisPercent = (minutes: number) =>
    ((minutes - timeline.startHour * 60) / ((timeline.endHour - timeline.startHour) * 60)) * 100;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isToday ? "Today's timetable" : "Timetable"}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{format(day, "EEEE, MMMM d")}</span>
        </CardTitle>
        <CardAction className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, -1)))} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayString())}>
              Today
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setDate(toDateString(addDays(day, 1)))} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
          <Link to="/calendar" className="ml-1 text-xs text-muted-foreground hover:text-foreground">
            Calendar
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* The day as one wide bar; blocks are placed by time and sized by length. */}
        <div>
          <div
            className="relative rounded-md border-2 border-foreground/80 bg-background"
            style={{ height: timeline.lanes * LANE_HEIGHT + 8 }}
            role="img"
            aria-label={`Timetable for ${format(day, "EEEE, MMMM d")}`}
          >
            {hours.slice(1, -1).map((hour) => (
              <span
                key={hour}
                className="absolute top-0 bottom-0 w-px bg-border"
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
                    "absolute flex flex-col justify-center overflow-hidden rounded-md px-2 text-xs leading-tight",
                    entry.done && "opacity-50",
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: 4 + block.lane * LANE_HEIGHT,
                    height: LANE_HEIGHT - 4,
                    backgroundColor: entry.color,
                    color: readableTextColor(entry.color),
                  }}
                  title={`${entry.title}${range ? ` · ${range}` : ""}`}
                >
                  <span className={cn("truncate font-medium", entry.done && "line-through")}>{entry.title}</span>
                  {range && <span className="truncate opacity-80">{range}</span>}
                </div>
              );
            })}

            {isToday && nowMinutes >= timeline.startHour * 60 && nowMinutes <= timeline.endHour * 60 && (
              <span
                className="pointer-events-none absolute -top-1 -bottom-1 z-10 w-0.5 rounded bg-primary"
                style={{ left: `${axisPercent(nowMinutes)}%` }}
                title="Now"
              />
            )}
          </div>

          <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute -translate-x-1/2 tabular-nums"
                style={{ left: `${axisPercent(hour * 60)}%` }}
              >
                {String(hour % 24).padStart(2, "0")}
              </span>
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Nothing scheduled for this day. Add events and reminders from the{" "}
            <Link to="/calendar" className="underline">
              Calendar
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => {
              const range = formatTimeRange(entry.startTime, entry.endTime);
              const checkable = entry.kind === "task" || entry.kind === "reminder";
              return (
                <li key={entry.key} className="flex items-center gap-3 py-2">
                  <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">{range ?? "All day"}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className={cn("min-w-0 flex-1 truncate text-sm", entry.done && "text-muted-foreground line-through")}>
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ENTRY_KIND_LABELS[entry.kind]}</span>
                  {checkable ? (
                    <Checkbox
                      checked={entry.done}
                      onCheckedChange={() => toggle(entry)}
                      aria-label={entry.done ? "Mark as not done" : "Mark as done"}
                    />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
