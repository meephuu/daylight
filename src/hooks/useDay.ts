import { useEffect, useMemo, useState } from "react";
import { useCalendarItems, useOccurrenceStates, useSetOccurrenceState } from "@/hooks/useCalendarItems";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import { stateMap } from "@/lib/calendarItems";
import { entriesForDate, type ScheduleEntry } from "@/lib/schedule";

/** Minutes since midnight, refreshed every 30 s so "now" markers move. */
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

/** A day's tasks, events and reminders, plus the action that checks one off (or back on). */
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
