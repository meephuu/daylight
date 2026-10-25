import { Archive, ArchiveRestore, Flame, Pencil, Trash2 } from "lucide-react";
import { HabitCheck } from "@/components/habits/HabitCheck";
import { HabitHeatmap } from "@/components/habits/HabitHeatmap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
}

export function HabitCard({ habit, logs, onEdit, onToggleArchived, onDelete }: HabitCardProps) {
  const today = todayString();
  const streak = computeStreak(habit, logs, today);
  const countsByDate = logCountsByDate(logs);
  const unit = habit.frequency === "daily" ? "day" : "week";

  return (
    <Card className={cn(habit.archived && "opacity-60")}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-medium">{habit.name}</h2>
            <p className="text-xs text-muted-foreground">
              {habit.targetPerPeriod}× per {unit}
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-sm" title="Current streak">
            <Flame
              className={cn("size-4", streak.current > 0 ? "text-orange-500" : "text-muted-foreground")}
            />
            <span className="font-semibold tabular-nums">{streak.current}</span>
            <span className="text-xs text-muted-foreground">
              {unit}
              {streak.current === 1 ? "" : "s"} · best {streak.best}
            </span>
          </div>

          {!habit.archived && (
            <HabitCheck habit={habit} streak={streak} todayCount={countsByDate.get(today) ?? 0} />
          )}

          <div className="flex">
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit(habit)} aria-label="Edit habit">
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onToggleArchived(habit)}
              aria-label={habit.archived ? "Unarchive habit" : "Archive habit"}
            >
              {habit.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onDelete(habit)} aria-label="Delete habit">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <HabitHeatmap habit={habit} countsByDate={countsByDate} />
      </CardContent>
    </Card>
  );
}
