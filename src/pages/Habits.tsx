import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { HabitCard } from "@/components/habits/HabitCard";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { Button } from "@/components/ui/button";
import {
  useCreateHabit,
  useDeleteHabit,
  useHabitLogs,
  useHabits,
  useSetHabitArchived,
} from "@/hooks/useHabits";
import type { Habit } from "@/lib/db/habits";
import { groupLogsByHabit, HABIT_PRESETS } from "@/lib/habits";

export default function HabitsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();
  const createHabit = useCreateHabit();
  const setArchived = useSetHabitArchived();
  const deleteHabit = useDeleteHabit();

  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data]);
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);

  const visible = habits.filter((habit) => showArchived || !habit.archived);
  const archivedCount = habits.filter((habit) => habit.archived).length;
  const missingPresets = HABIT_PRESETS.filter(
    (preset) => !habits.some((habit) => habit.name.toLowerCase() === preset.name.toLowerCase()),
  );

  function openForm(habit: Habit | null) {
    setEditing(habit);
    setFormOpen(true);
  }

  function handleDelete(habit: Habit) {
    if (window.confirm(`Delete habit "${habit.name}" and all of its history?`)) {
      deleteHabit.mutate(habit.id);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Habits</h1>
        <Button onClick={() => openForm(null)}>
          <Plus className="size-4" />
          New habit
        </Button>
      </div>

      {(habitsQuery.isError || logsQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load habits: {String(habitsQuery.error ?? logsQuery.error)}
        </p>
      )}

      {missingPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {habits.length === 0 ? "Start with:" : "Quick add:"}
          </span>
          {missingPresets.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => createHabit.mutate(preset)}
              disabled={createHabit.isPending}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: preset.color }} />
              {preset.name}
            </Button>
          ))}
        </div>
      )}

      {visible.length === 0 && !habitsQuery.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No habits yet. Pick one above or create your own.
        </p>
      )}

      {visible.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          logs={logsByHabit.get(habit.id) ?? []}
          onEdit={openForm}
          onToggleArchived={(h) => setArchived.mutate({ id: h.id, archived: !h.archived })}
          onDelete={handleDelete}
        />
      ))}

      {archivedCount > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Click a square in the heatmap to log (or cycle) that day, e.g. to fill in a day you missed.
      </p>

      <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} habit={editing} />
    </div>
  );
}
