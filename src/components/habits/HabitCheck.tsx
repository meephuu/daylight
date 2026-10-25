import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSetHabitLogCount } from "@/hooks/useHabits";
import { todayString } from "@/lib/dates";
import type { Habit } from "@/lib/db/habits";
import type { StreakInfo } from "@/lib/habits";
import { cn } from "@/lib/utils";

interface HabitCheckProps {
  habit: Habit;
  streak: StreakInfo;
  /** Count logged today (not the weekly total). */
  todayCount: number;
}

/**
 * One tap checks off a once-a-day habit. Habits with a higher target (several sessions a day,
 * or a weekly goal) get - / + buttons so a session can be added or undone.
 */
export function HabitCheck({ habit, streak, todayCount }: HabitCheckProps) {
  const setLog = useSetHabitLogCount();
  const today = todayString();

  function setToday(count: number) {
    setLog.mutate({ habitId: habit.id, date: today, count: Math.max(0, count) });
  }

  if (habit.frequency === "daily" && habit.targetPerPeriod === 1) {
    const done = todayCount > 0;
    return (
      <Button
        variant={done ? "default" : "outline"}
        size="sm"
        onClick={() => setToday(done ? 0 : 1)}
        disabled={setLog.isPending}
        aria-pressed={done}
      >
        <Check className="size-4" />
        {done ? "Done" : "Check off"}
      </Button>
    );
  }

  const unit = habit.frequency === "daily" ? "today" : "this week";
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setToday(todayCount - 1)}
        disabled={setLog.isPending || todayCount === 0}
        aria-label="Remove one"
      >
        <Minus className="size-4" />
      </Button>
      <span
        className={cn(
          "min-w-20 text-center text-sm tabular-nums",
          streak.currentMet && "font-medium text-green-600 dark:text-green-400",
        )}
      >
        {streak.currentTotal}/{habit.targetPerPeriod} {unit}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setToday(todayCount + 1)}
        disabled={setLog.isPending}
        aria-label="Add one"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
