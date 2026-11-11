import type { ReactNode } from "react";
import { Archive, ArchiveRestore, Flame, Pencil, Trash2 } from "lucide-react";
import { HabitCheck } from "@/components/habits/HabitCheck";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { Button } from "@/components/ui/button";
import { todayString } from "@/lib/dates";
import type { Habit, HabitLog } from "@/lib/db/habits";
import { computeStreak, logCountsByDate } from "@/lib/habits";
import { cn } from "@/lib/utils";

interface HabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  onEdit: (habit: Habit) => void;
  onToggleArchived: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  /** Shown before the name; the Habits page puts the drag handle here. */
  leading?: ReactNode;
}

/**
 * One habit as a pane: its identity and streak on the left (the streak is the big number), and its
 * history on the right as a field of round cells in the habit's own colour.
 */
export function HabitCard({ habit, logs, onEdit, onToggleArchived, onDelete, leading }: HabitCardProps) {
  const today = todayString();
  const streak = computeStreak(habit, logs, today);
  const countsByDate = logCountsByDate(logs);
  const unit = habit.frequency === "daily" ? "day" : "week";

  return (
    <article data-slot="card" className={cn("pane grid gap-6 p-6 md:grid-cols-[230px_1fr]", habit.archived && "opacity-60")}>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start gap-2">
          {leading}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-[22px] leading-tight font-semibold tracking-[-0.025em]">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} aria-hidden="true" />
              <span className="truncate">{habit.name}</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {habit.targetPerPeriod}× per {unit}
            </p>
          </div>
        </div>

        <div className="flex items-end gap-2" title="Current streak">
          <span className="display-num text-[52px]">{streak.current}</span>
          <span className="pb-1 text-sm leading-tight text-foreground/80">
            <span className="flex items-center gap-1 font-medium">
              <Flame className={cn("size-4", streak.current > 0 ? "text-[#ff9a4d]" : "text-muted-foreground")} aria-hidden="true" />
              {unit}
              {streak.current === 1 ? "" : "s"} in a row
            </span>
            <span className="text-xs text-muted-foreground">best {streak.best}</span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1">
          {!habit.archived && <HabitCheck habit={habit} streak={streak} todayCount={countsByDate.get(today) ?? 0} />}
          <Button variant="ghost" size="icon-sm" onClick={() => onEdit(habit)} aria-label={`Edit ${habit.name}`}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleArchived(habit)}
            aria-label={habit.archived ? `Unarchive ${habit.name}` : `Archive ${habit.name}`}
          >
            {habit.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(habit)} aria-label={`Delete ${habit.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-w-0 self-center">
        <HabitHeatmap habit={habit} countsByDate={countsByDate} />
      </div>
    </article>
  );
}
