import { useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { HabitCheck } from "@/components/habits/HabitCheck";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHabitLogs, useHabits } from "@/hooks/useHabits";
import { toDateString, todayString } from "@/lib/dates";
import { computeStreak, dailyCap, groupLogsByHabit, logCountsByDate } from "@/lib/habits";
import { cn } from "@/lib/utils";

const DAYS_SHOWN = 7;

export function HabitStreakWidget() {
  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();

  const habits = useMemo(
    () => (habitsQuery.data ?? []).filter((habit) => !habit.archived),
    [habitsQuery.data],
  );
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);
  const today = todayString();
  const days = useMemo(() => {
    const end = parseISO(today);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => toDateString(addDays(end, i - (DAYS_SHOWN - 1))));
  }, [today]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Habits</CardTitle>
        <CardAction>
          <Link to="/habits" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {habits.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No habits yet. Add some on the Habits page.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {habits.map((habit) => {
              const logs = logsByHabit.get(habit.id) ?? [];
              const streak = computeStreak(habit, logs, today);
              const counts = logCountsByDate(logs);
              const todayCount = counts.get(today) ?? 0;
              const cap = dailyCap(habit);
              return (
                <li key={habit.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-medium">{habit.name}</span>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-0.5 text-xs tabular-nums",
                          streak.current > 0 ? "text-foreground/85" : "text-muted-foreground",
                        )}
                        title={`Current streak: ${streak.current}`}
                      >
                        <Flame className={cn("size-3.5", streak.current > 0 && "text-[#ff9a4d]")} />
                        {streak.current}
                      </span>
                    </div>
                    {/* The last seven days, in the habit's own colour: the streak's proof. */}
                    <div className="mt-1.5 flex gap-1" aria-label={`${habit.name}, last ${DAYS_SHOWN} days`}>
                      {days.map((date) => {
                        const count = counts.get(date) ?? 0;
                        const level = Math.min(1, count / cap);
                        return (
                          <span
                            key={date}
                            title={`${format(parseISO(date), "EEE d")}: ${count}`}
                            className="h-2.5 flex-1 rounded-[3px]"
                            style={{
                              backgroundColor:
                                level > 0
                                  ? `color-mix(in srgb, ${habit.color} ${Math.round(35 + level * 65)}%, transparent)`
                                  : "color-mix(in srgb, var(--foreground) 9%, transparent)",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <HabitCheck habit={habit} streak={streak} todayCount={todayCount} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
