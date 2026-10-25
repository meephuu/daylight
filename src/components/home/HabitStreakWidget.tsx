import { useMemo } from "react";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { HabitCheck } from "@/components/habits/HabitCheck";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHabitLogs, useHabits } from "@/hooks/useHabits";
import { todayString } from "@/lib/dates";
import { computeStreak, groupLogsByHabit, logCountsByDate } from "@/lib/habits";
import { cn } from "@/lib/utils";

export function HabitStreakWidget() {
  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();

  const habits = useMemo(
    () => (habitsQuery.data ?? []).filter((habit) => !habit.archived),
    [habitsQuery.data],
  );
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);
  const today = todayString();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Habit streaks</CardTitle>
        <CardAction>
          <Link to="/habits" className="text-xs text-muted-foreground hover:text-foreground">
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
          <ul className="divide-y">
            {habits.map((habit) => {
              const logs = logsByHabit.get(habit.id) ?? [];
              const streak = computeStreak(habit, logs, today);
              const todayCount = logCountsByDate(logs).get(today) ?? 0;
              return (
                <li key={habit.id} className="flex items-center gap-3 py-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm">{habit.name}</span>
                  <span className="flex items-center gap-1 text-sm tabular-nums">
                    <Flame
                      className={cn("size-4", streak.current > 0 ? "text-orange-500" : "text-muted-foreground")}
                    />
                    {streak.current}
                  </span>
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
