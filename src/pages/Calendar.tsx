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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AddToCalendarDialog } from "@/components/calendar/AddToCalendarDialog";
import { CalendarItemFormDialog } from "@/components/calendar/CalendarItemFormDialog";
import { DayCell } from "@/components/calendar/DayCell";
import { EntryChip } from "@/components/calendar/EntryChip";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCalendarItems, useMoveCalendarItem, useOccurrenceStates } from "@/hooks/useCalendarItems";
import { useProjects } from "@/hooks/useProjects";
import { useSetTaskDueDate, useTasks } from "@/hooks/useTasks";
import { stateMap } from "@/lib/calendarItems";
import {
  formatRangeTitle,
  getVisibleDays,
  shiftCursor,
  WEEKDAY_LABELS,
  type CalendarMode,
} from "@/lib/calendar";
import { toDateString, todayString } from "@/lib/dates";
import type { CalendarItem, ItemKind } from "@/lib/db/calendarItems";
import type { Task } from "@/lib/db/tasks";
import { entriesByDate, type EntryKind, type ScheduleEntry } from "@/lib/schedule";

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dragging, setDragging] = useState<ScheduleEntry | null>(null);

  // What the "add" chooser is asking about, and which form is open after choosing.
  const [chooserDate, setChooserDate] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<{ task: Task | null; dueDate: string | null } | null>(null);
  const [itemForm, setItemForm] = useState<{
    item: CalendarItem | null;
    kind: ItemKind;
    date: string;
    occurrenceDate?: string;
  } | null>(null);

  const tasksQuery = useTasks();
  const itemsQuery = useCalendarItems();
  const statesQuery = useOccurrenceStates();
  const projectsQuery = useProjects();
  const setDueDate = useSetTaskDueDate();
  const moveItem = useMoveCalendarItem();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const states = useMemo(() => stateMap(statesQuery.data ?? []), [statesQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const days = useMemo(() => getVisibleDays(mode, cursor), [mode, cursor]);
  const entries = useMemo(
    () => entriesByDate(days.map(toDateString), tasks, items, states),
    [days, tasks, items, states],
  );

  // A small movement threshold keeps plain clicks on a chip from starting a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current?.entry as ScheduleEntry | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const entry = event.active.data.current?.entry as ScheduleEntry | undefined;
    setDragging(null);
    if (!entry || !event.over) return;
    const newDate = String(event.over.id);
    if (newDate === entry.date) return;
    if (entry.task) setDueDate.mutate({ id: entry.task.id, dueDate: newDate });
    else if (entry.occurrence) moveItem.mutate({ id: entry.occurrence.item.id, startDate: newDate });
  }

  function handleChoose(kind: EntryKind, date: string) {
    setChooserDate(null);
    if (kind === "task") setTaskForm({ task: null, dueDate: date });
    else setItemForm({ item: null, kind, date });
  }

  function handleEdit(entry: ScheduleEntry) {
    if (entry.task) setTaskForm({ task: entry.task, dueDate: null });
    else if (entry.occurrence) {
      const { item, date } = entry.occurrence;
      setItemForm({ item, kind: item.kind, date: item.startDate, occurrenceDate: date });
    }
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
          <Button onClick={() => setChooserDate(todayString())}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      {(tasksQuery.isError || itemsQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load the calendar: {String(tasksQuery.error ?? itemsQuery.error)}
        </p>
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
                entries={entries.get(toDateString(day)) ?? []}
                onAdd={setChooserDate}
                onEdit={handleEdit}
                onShowDay={showDay}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {dragging && <EntryChip entry={dragging} className="cursor-grabbing shadow-lg" />}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        Click a day to add a task, event or reminder. Click anything to edit it, or drag a task or one-off item to
        another day. Repeating items change through their edit dialog. Tasks without a due date are not shown here.
      </p>

      <AddToCalendarDialog date={chooserDate} onChoose={handleChoose} onClose={() => setChooserDate(null)} />

      <TaskFormDialog
        open={taskForm !== null}
        onOpenChange={(open) => !open && setTaskForm(null)}
        task={taskForm?.task ?? null}
        defaults={{ dueDate: taskForm?.dueDate ?? null }}
        projects={projects}
      />

      <CalendarItemFormDialog
        open={itemForm !== null}
        onOpenChange={(open) => !open && setItemForm(null)}
        item={itemForm?.item ?? null}
        kind={itemForm?.kind ?? "event"}
        defaultDate={itemForm?.date}
        occurrenceDate={itemForm?.occurrenceDate}
      />
    </div>
  );
}
