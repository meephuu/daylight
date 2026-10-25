import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayCell } from "@/components/calendar/DayCell";
import { TaskChip } from "@/components/calendar/TaskChip";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjects } from "@/hooks/useProjects";
import { useSetTaskDueDate, useTasks } from "@/hooks/useTasks";
import {
  formatRangeTitle,
  getVisibleDays,
  groupTasksByDate,
  shiftCursor,
  WEEKDAY_LABELS,
  type CalendarMode,
} from "@/lib/calendar";
import { toDateString } from "@/lib/dates";
import type { Task } from "@/lib/db/tasks";

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dragging, setDragging] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null);

  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const setDueDate = useSetTaskDueDate();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const days = useMemo(() => getVisibleDays(mode, cursor), [mode, cursor]);
  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);

  // A small movement threshold keeps plain clicks on a chip from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    setDragging(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    setDragging(null);
    if (!task || !event.over) return;
    const newDate = String(event.over.id);
    if (newDate !== task.dueDate) setDueDate.mutate({ id: task.id, dueDate: newDate });
  }

  function openNew(date: string) {
    setEditing(null);
    setNewTaskDate(date);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setNewTaskDate(null);
    setFormOpen(true);
  }

  function showDay(day: Date) {
    setCursor(day);
    setMode("week");
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{formatRangeTitle(mode, days, cursor)}</h1>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(value) => setMode(value as CalendarMode)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(shiftCursor(mode, cursor, -1))}
            aria-label={`Previous ${mode}`}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(shiftCursor(mode, cursor, 1))}
            aria-label={`Next ${mode}`}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {tasksQuery.isError && (
        <p className="text-sm text-destructive">Could not load tasks: {String(tasksQuery.error)}</p>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="overflow-hidden rounded-lg border-t border-l bg-card">
          <div className="grid grid-cols-7">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-r border-b px-2 py-1.5 text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {days.map((day) => (
              <DayCell
                key={toDateString(day)}
                day={day}
                cursor={cursor}
                mode={mode}
                tasks={tasksByDate.get(toDateString(day)) ?? []}
                projectsById={projectsById}
                onAdd={openNew}
                onEdit={openEdit}
                onShowDay={showDay}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {dragging && (
            <TaskChip
              task={dragging}
              project={dragging.projectId === null ? undefined : projectsById.get(dragging.projectId)}
              className="cursor-grabbing shadow-lg"
            />
          )}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        Click a day to add a task, click a task to edit it, or drag a task to another day to
        reschedule. Tasks without a due date are not shown here.
      </p>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        defaults={{ dueDate: newTaskDate }}
        projects={projects}
      />
    </div>
  );
}
