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
        "pane flex min-h-60 flex-col gap-2 p-2.5 transition-colors",
        // Inset: the week row scrolls sideways and would clip an outline drawn outside the box.
        today && "ring-2 ring-sky-accent/70 ring-inset",
        isOver && "ring-2 ring-sky-accent ring-inset",
      )}
    >
      <div className="flex items-start justify-between px-1 pt-1 pb-1">
        <div>
          <span className={cn("block text-xs font-semibold", today ? "text-foreground" : "text-muted-foreground")}>
            {DAY_SHORT[dayOfWeek]}
          </span>
          <span className="display-num block text-[30px]">{format(day, "d")}</span>
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
