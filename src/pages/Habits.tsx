import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { HabitCard } from "@/components/habits/HabitCard";
import { HabitFormDialog } from "@/components/habits/HabitFormDialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useDeleteHabit,
  useHabitLogs,
  useHabits,
  useReorderHabits,
  useSetHabitArchived,
} from "@/hooks/useHabits";
import type { Habit, HabitLog } from "@/lib/db/habits";
import { groupLogsByHabit } from "@/lib/habits";
import { cn } from "@/lib/utils";

interface SortableHabitProps {
  habit: Habit;
  logs: HabitLog[];
  onEdit: (habit: Habit) => void;
  onToggleArchived: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

/** A habit card that can be dragged by its grip (mouse, touch, or Space then the arrow keys). */
function SortableHabit({ habit, logs, onEdit, onToggleArchived, onDelete }: SortableHabitProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 [&>[data-slot=card]]:shadow-xl [&>[data-slot=card]]:ring-primary/50")}
    >
      <HabitCard
        habit={habit}
        logs={logs}
        onEdit={onEdit}
        onToggleArchived={onToggleArchived}
        onDelete={onDelete}
        leading={
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="-ml-1 cursor-grab touch-none rounded p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            aria-label={`Reorder ${habit.name}. Drag, or press Space and use the arrow keys.`}
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        }
      />
    </div>
  );
}

export default function HabitsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();
  const setArchived = useSetHabitArchived();
  const deleteHabit = useDeleteHabit();
  const reorder = useReorderHabits();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const habits = useMemo(() => habitsQuery.data ?? [], [habitsQuery.data]);
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);

  const active = habits.filter((habit) => !habit.archived);
  const archived = habits.filter((habit) => habit.archived);
  const sensors = useSensors(
    // A small movement first, so clicking buttons inside the card never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const ids = active.map((habit) => habit.id);
    const from = ids.indexOf(Number(dragged.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    reorder.mutate(arrayMove(ids, from, to));
  }

  const visible = showArchived ? habits : active;
  const archivedCount = habits.filter((habit) => habit.archived).length;

  function openForm(habit: Habit | null) {
    setEditing(habit);
    setFormOpen(true);
  }

  async function handleDelete(habit: Habit) {
    const confirmed = await confirm({
      title: "Delete habit?",
      description: `“${habit.name}” and all of its history will be permanently deleted. This can’t be undone. Archive it instead to keep the history.`,
      confirmLabel: "Delete habit",
    });
    if (confirmed) deleteHabit.mutate(habit.id);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">Habits</h1>
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

      {visible.length === 0 && !habitsQuery.isPending && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No habits yet. Click “New habit” to create your first one.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map((habit) => habit.id)} strategy={verticalListSortingStrategy}>
          {active.map((habit) => (
            <SortableHabit
              key={habit.id}
              habit={habit}
              logs={logsByHabit.get(habit.id) ?? []}
              onEdit={openForm}
              onToggleArchived={(h) => setArchived.mutate({ id: h.id, archived: !h.archived })}
              onDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </DndContext>

      {showArchived &&
        archived.map((habit) => (
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
        Click a square in the heatmap to log (or cycle) that day, e.g. to fill in a day you missed. Drag a card by its grip to change the order.
      </p>

      <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} habit={editing} />
      {confirmDialog}
    </div>
  );
}
