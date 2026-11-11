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
import { addWeeks, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, LayoutTemplate, Plus } from "lucide-react";
import { DayColumn } from "@/components/training/DayColumn";
import { PlanCard } from "@/components/training/PlanCard";
import { PlansDialog } from "@/components/training/PlansDialog";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { WorkoutCardBody } from "@/components/training/WorkoutCard";
import { WorkoutFormDialog } from "@/components/training/WorkoutFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useCreateWorkouts,
  useMoveWorkout,
  useSetWorkoutDone,
  useWorkoutLogs,
  useWorkouts,
} from "@/hooks/useWorkouts";
import { todayString } from "@/lib/dates";
import type { Workout } from "@/lib/db/workouts";
import { formatMinutes } from "@/lib/dates";
import { weekRange } from "@/lib/review";
import {
  compareWorkouts,
  dayDropId,
  logKeys,
  recentWeeks,
  summarizeWeek,
  workoutDate,
  workoutsForWeek,
  workoutStatus,
  WORKOUT_TEMPLATES,
} from "@/lib/training";

const HISTORY_WEEKS = 6;

function weekLabel(weekStart: string): string {
  const start = parseISO(weekStart);
  const end = parseISO(workoutDate(weekStart, 6));
  const sameMonth = start.getMonth() === end.getMonth();
  return `${format(start, "MMM d")} – ${format(end, sameMonth ? "d" : "MMM d")}`;
}

export default function TrainingPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [newDay, setNewDay] = useState(0);
  const [dragging, setDragging] = useState<Workout | null>(null);
  // The day a card was just dropped on. The saved move reaches the screen a moment after the drop, and until
  // then the card (and the drop animation heading for it) would still be in its old column.
  const [movedTo, setMovedTo] = useState<Record<number, number>>({});

  const workoutsQuery = useWorkouts();
  const logsQuery = useWorkoutLogs();
  const moveWorkout = useMoveWorkout();
  const setDone = useSetWorkoutDone();
  const createWorkouts = useCreateWorkouts();

  const workouts = useMemo(() => workoutsQuery.data ?? [], [workoutsQuery.data]);
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);
  const doneKeys = useMemo(() => logKeys(logs), [logs]);

  const today = todayString();
  const week = useMemo(() => weekRange(cursor), [cursor]);
  const isThisWeek = week.days.includes(today);

  // The plan keeps older versions of every workout; only the ones in force during the viewed week are shown.
  const weekWorkouts = useMemo(
    () =>
      workoutsForWeek(workouts, week.start)
        .map((workout) => (movedTo[workout.id] === undefined ? workout : { ...workout, dayOfWeek: movedTo[workout.id] as number }))
        .sort(compareWorkouts),
    [workouts, week.start, movedTo],
  );
  const summary = useMemo(() => summarizeWeek(workouts, logs, week.start, today), [workouts, logs, week.start, today]);
  const history = useMemo(
    () => recentWeeks(workouts, logs, weekRange(new Date()).start, HISTORY_WEEKS),
    [workouts, logs],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const statusOf = (workout: Workout) => workoutStatus(workout, week.start, doneKeys, today);

  function openNew(dayOfWeek: number) {
    setEditing(null);
    setNewDay(dayOfWeek);
    setFormOpen(true);
  }

  function openEdit(workout: Workout) {
    setEditing(workout);
    setFormOpen(true);
  }

  function handleToggle(workout: Workout) {
    const done = statusOf(workout) !== "done";
    // Ticked today when viewing the current week; otherwise on the day it was planned for.
    const doneDate = isThisWeek ? today : workoutDate(week.start, workout.dayOfWeek);
    setDone.mutate({ workoutId: workout.id, weekStart: week.start, doneDate, done });
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current?.workout as Workout | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const workout = event.active.data.current?.workout as Workout | undefined;
    setDragging(null);
    if (!workout || !event.over) return;
    const target = Number(String(event.over.id).replace("day-", ""));
    if (Number.isInteger(target) && target !== workout.dayOfWeek) {
      setMovedTo((current) => ({ ...current, [workout.id]: target }));
      moveWorkout.mutate(
        { id: workout.id, dayOfWeek: target, weekStart: week.start },
        {
          onSettled: () =>
            setMovedTo((current) => {
              const { [workout.id]: _settled, ...rest } = current;
              return rest;
            }),
        },
      );
    }
  }

  const empty = !workoutsQuery.isPending && workouts.length === 0;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-4">
      <PageHeader
        title="Training"
        summary={`${isThisWeek ? "This week" : "Week of"} ${weekLabel(week.start)}`}
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addWeeks(cursor, -1))} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Button>
            {!isThisWeek && (
              <Button variant="ghost" onClick={() => setCursor(new Date())}>
                This week
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setCursor(addWeeks(cursor, 1))} aria-label="Next week">
              <ChevronRight className="size-4" />
            </Button>
            <span className="mx-1 h-5 w-px bg-foreground/15" aria-hidden="true" />
            <Button variant="ghost" onClick={() => setPlansOpen(true)}>
              <LayoutTemplate className="size-4" />
              Plans
            </Button>
            <Button onClick={() => openNew(new Date().getDay())} className="ml-1">
              <Plus className="size-4" />
              Add workout
            </Button>
          </>
        }
      />

      {(workoutsQuery.isError || logsQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load your training plan: {String(workoutsQuery.error ?? logsQuery.error)}
        </p>
      )}

      {empty && (
        <Card>
          <CardHeader>
            <CardTitle>Start from a plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Pick a starter week and change anything you like afterwards, or add your own workouts with the + on
              any day.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {WORKOUT_TEMPLATES.map((template) => (
                <PlanCard
                  key={template.id}
                  template={template}
                  disabled={createWorkouts.isPending}
                  onSelect={(chosen) => createWorkouts.mutate({ inputs: chosen.workouts, weekStart: week.start })}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!empty && (
        // The week in three numbers, set on the sky. The first carries its proof: one dot per planned workout.
        <div className="flex flex-wrap items-end gap-x-14 gap-y-4 px-1 pb-1">
          <div>
            <p className="display-num text-[56px]">
              {summary.done}
              <span className="text-[32px] text-foreground/50">/{summary.planned}</span>
            </p>
            <div className="mt-2 flex gap-1.5" aria-label={`${summary.done} of ${summary.planned} workouts done this week`}>
              {Array.from({ length: summary.planned }, (_, index) => (
                <span
                  key={index}
                  className={cn("size-2.5 rounded-full", index < summary.done ? "bg-sky-accent" : "bg-foreground/20")}
                />
              ))}
            </div>
            <p className="mt-1.5 text-sm text-foreground/75">workouts done</p>
          </div>
          <div>
            <p className="display-num text-[56px]">{formatMinutes(summary.doneMinutes)}</p>
            <p className="mt-2 text-sm text-foreground/75">of {formatMinutes(summary.plannedMinutes)} planned</p>
          </div>
          <div>
            <p className="display-num text-[56px]">
              {summary.adherence === null ? "–" : `${Math.round(summary.adherence * 100)}%`}
            </p>
            <p className="mt-2 text-sm text-foreground/75">
              {summary.due === 0 ? "nothing due yet" : `on track · ${summary.dueDone} of ${summary.due} due so far`}
            </p>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[880px] grid-cols-7 gap-2">
            {week.days.map((date, dayOfWeek) => (
              <DayColumn
                key={dayDropId(dayOfWeek)}
                dayOfWeek={dayOfWeek}
                date={date}
                workouts={weekWorkouts.filter((workout) => workout.dayOfWeek === dayOfWeek)}
                statusOf={statusOf}
                onToggle={handleToggle}
                onEdit={openEdit}
                onAdd={openNew}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {dragging && (
            <WorkoutCardBody
              workout={dragging}
              status={statusOf(dragging)}
              onToggle={handleToggle}
              className="cursor-grabbing shadow-lg"
            />
          )}
        </DragOverlay>
      </DndContext>

      <p className="px-1 text-xs text-foreground/70">
        This is your repeating weekly plan: drag a workout to another day to move it, click it to edit its exercises,
        and tick it off each week. A change applies from the week you are viewing onward; earlier weeks keep the
        plan they had.
      </p>

      {!empty && (
        <Card>
          <CardHeader>
            <CardTitle>Recent weeks</CardTitle>
          </CardHeader>
          <CardContent>
            {/* One column per week, oldest on the left; the fill is the share of planned workouts done. */}
            <ul className="flex items-end gap-3" aria-label="Workouts done per week">
              {history.map((entry) => {
                const fraction = entry.planned === 0 ? 0 : Math.min(1, entry.done / entry.planned);
                const current = entry.weekStart === week.start;
                return (
                  <li key={entry.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {entry.done}
                      <span className="font-normal text-muted-foreground">/{entry.planned}</span>
                    </span>
                    <div
                      className="relative flex h-32 w-full max-w-16 items-end overflow-hidden rounded-2xl bg-foreground/[0.07]"
                      role="img"
                      aria-label={`Week of ${weekLabel(entry.weekStart)}: ${entry.done} of ${entry.planned}`}
                    >
                      <div
                        className={cn("w-full rounded-2xl transition-[height] duration-500", current ? "bg-sky-accent" : "bg-[var(--series-1)]")}
                        style={{ height: `${fraction * 100}%` }}
                      />
                    </div>
                    <span className={cn("truncate text-xs", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
                      {weekLabel(entry.weekStart)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} weekStart={week.start} />
      <WorkoutFormDialog open={formOpen} onOpenChange={setFormOpen} workout={editing} defaultDay={newDay} weekStart={week.start} />
    </div>
  );
}
