import { useDroppable } from "@dnd-kit/core";
import { format, isToday, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { DraggableWorkoutCard } from "@/components/training/WorkoutCard";
import { Button } from "@/components/ui/button";
import type { Workout } from "@/lib/db/workouts";
import { DAY_SHORT, dayDropId, type WorkoutStatus } from "@/lib/training";
import { cn } from "@/lib/utils";

interface DayColumnProps {
  dayOfWeek: number;
  /** The calendar date this column shows, "YYYY-MM-DD". */
  date: string;
  workouts: Workout[];
  statusOf: (workout: Workout) => WorkoutStatus;
  onToggle: (workout: Workout) => void;
  onEdit: (workout: Workout) => void;
  onAdd: (dayOfWeek: number) => void;
}

export function DayColumn({ dayOfWeek, date, workouts, statusOf, onToggle, onEdit, onAdd }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(dayOfWeek) });
  const day = parseISO(date);
  const today = isToday(day);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-72 flex-col gap-2 rounded-lg border bg-card/50 p-2 transition-colors",
        today && "border-primary/60 bg-card",
        isOver && "bg-accent",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-sm font-semibold", today && "text-primary")}>{DAY_SHORT[dayOfWeek]}</span>
          <span className="text-xs text-muted-foreground">{format(day, "MMM d")}</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={() => onAdd(dayOfWeek)} aria-label={`Add workout on ${DAY_SHORT[dayOfWeek]}`}>
          <Plus className="size-3.5" />
        </Button>
      </div>

      {workouts.map((workout) => (
        <DraggableWorkoutCard
          key={workout.id}
          workout={workout}
          status={statusOf(workout)}
          onToggle={onToggle}
          onEdit={onEdit}
        />
      ))}

      {workouts.length === 0 && (
        <p className="m-auto text-xs text-muted-foreground">Rest day</p>
      )}
    </div>
  );
}
