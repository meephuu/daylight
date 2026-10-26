import { useMemo } from "react";
import { addDays, format, parseISO, startOfWeek, subWeeks } from "date-fns";
import { useSetHabitLogCount } from "@/hooks/useHabits";
import { toDateString, todayString } from "@/lib/dates";
import type { Habit } from "@/lib/db/habits";
import { dailyCap, nextCount } from "@/lib/habits";

const WEEKS = 26;
const WEEKDAY_ROW_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

interface HabitHeatmapProps {
  habit: Habit;
  countsByDate: Map<string, number>;
}

interface HeatmapDay {
  date: string;
  label: string;
  future: boolean;
}

/** GitHub-style grid: one column per week (Sun-Sat rows), oldest on the left. */
export function HabitHeatmap({ habit, countsByDate }: HabitHeatmapProps) {
  const setLog = useSetHabitLogCount();
  const today = todayString();

  const weeks = useMemo<HeatmapDay[][]>(() => {
    const firstSunday = startOfWeek(subWeeks(new Date(), WEEKS - 1), { weekStartsOn: 0 });
    return Array.from({ length: WEEKS }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const day = addDays(firstSunday, w * 7 + d);
        const date = toDateString(day);
        return { date, label: format(day, "MMM d, yyyy"), future: date > today };
      }),
    );
  }, [today]);

  // Label a column with the month name when the month changes from the previous column.
  const monthLabels = weeks.map((week, index) => {
    const month = format(parseISO(week[0]?.date ?? today), "MMM");
    const previous = index > 0 ? format(parseISO(weeks[index - 1]?.[0]?.date ?? today), "MMM") : null;
    return month !== previous ? month : "";
  });

  // A daily habit's intensity is relative to its daily target; weekly habits just show any activity.
  const intensityBase = habit.frequency === "daily" ? Math.max(habit.targetPerPeriod, 1) : 1;

  function handleClick(date: string, count: number) {
    setLog.mutate({ habitId: habit.id, date, count: nextCount(count, dailyCap(habit)) });
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div className="flex flex-col gap-[3px] pt-4 text-[10px] leading-3 text-muted-foreground">
        {WEEKDAY_ROW_LABELS.map((label, index) => (
          <span key={index} className="h-3">
            {label}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {weeks.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            <span className="h-3 text-[10px] leading-3 text-muted-foreground">{monthLabels[w]}</span>
            {week.map((day) => {
              if (day.future) return <span key={day.date} className="size-3" />;
              const count = countsByDate.get(day.date) ?? 0;
              const ratio = Math.min(count / intensityBase, 1);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => handleClick(day.date, count)}
                  title={`${day.label}: ${count}`}
                  aria-label={`${day.label}: ${count}`}
                  className="size-3 rounded-[3px] bg-muted outline-offset-1 hover:outline hover:outline-1 hover:outline-foreground/40"
                  style={
                    count > 0
                      ? { backgroundColor: habit.color, opacity: 0.35 + 0.65 * ratio }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
