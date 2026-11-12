import type { ReactNode } from "react";
import { Archive, ArchiveRestore, Flame, Pencil, Trash2 } from "lucide-react";
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
 * One habit as a pane. The streak is the single big number and leads the card; the name is a plain
 * pane title above it. History sits on the right as round cells in the habit's own colour.
 * Checking off today lives in the Today pane above, so the card carries no primary button; its
 * edit / archive / delete tools stay quiet until the card is hovered or focused.
 */
export function HabitCard({ habit, logs, onEdit, onToggleArchived, onDelete, leading }: HabitCardProps) {
  const today = todayString();
  const streak = computeStreak(habit, logs, today);
  const countsByDate = logCountsByDate(logs);
  const unit = habit.frequency === "daily" ? "day" : "week";
  const live = streak.current > 0;

  return (
    <article
      data-slot="card"
      className={cn("pane group/card grid gap-x-8 gap-y-5 p-6 md:grid-cols-[210px_1fr]", habit.archived && "opacity-60")}
    >
      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div className="flex items-start gap-1.5">
          {leading}
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-display text-[19px] leading-tight font-semibold tracking-[-0.02em]">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} aria-hidden="true" />
              <span className="truncate" title={habit.name}>
                {habit.name}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {habit.targetPerPeriod}× per {unit}
            </p>
          </div>
        </div>

        <div>
          <p className="flex items-baseline gap-2" title="Current streak">
            <span className={cn("display-num text-[44px] leading-none", !live && "text-muted-foreground")}>
              {streak.current}
            </span>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Flame className={cn("size-3.5 self-center", live ? "text-[#ff9a4d]" : "text-muted-foreground")} aria-hidden="true" />
              {unit}
              {streak.current === 1 ? "" : "s"} in a row
            </span>
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">best {streak.best}</span>
            <div
              className={cn(
                "-my-1 flex items-center text-muted-foreground transition-opacity duration-150",
                !habit.archived && "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
              )}
            >
              <Button variant="ghost" size="icon-sm" onClick={() => onEdit(habit)} aria-label={`Edit ${habit.name}`} title="Edit">
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleArchived(habit)}
                aria-label={habit.archived ? `Unarchive ${habit.name}` : `Archive ${habit.name}`}
                title={habit.archived ? "Unarchive" : "Archive"}
              >
                {habit.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onDelete(habit)} aria-label={`Delete ${habit.name}`} title="Delete">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 self-center">
        <HabitHeatmap habit={habit} countsByDate={countsByDate} />
      </div>
    </article>
  );
}
