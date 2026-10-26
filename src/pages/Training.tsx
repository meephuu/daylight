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
import { ProgressMeter } from "@/components/training/ProgressMeter";
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
  dayDropId,
  logKeys,
  recentWeeks,
  summarizeWeek,
  workoutDate,
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
      moveWorkout.mutate({ id: workout.id, dayOfWeek: target });
    }
  }

  const empty = !workoutsQuery.isPending && workouts.length === 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Training</h1>
          <p className="text-sm text-muted-foreground">{weekLabel(week.start)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(addWeeks(cursor, -1))} aria-label="Previous week">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(addWeeks(cursor, 1))} aria-label="Next week">
            <ChevronRight className="size-4" />
          </Button>
          {!isThisWeek && (
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              This week
            </Button>
          )}
          <Button variant="outline" onClick={() => setPlansOpen(true)}>
            <LayoutTemplate className="size-4" />
            Plans
          </Button>
          <Button onClick={() => openNew(new Date().getDay())}>
            <Plus className="size-4" />
            Add workout
          </Button>
        </div>
      </div>

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
                  onSelect={(chosen) => createWorkouts.mutate(chosen.workouts)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!empty && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Workouts done</p>
              <p className="text-3xl font-semibold">
                {summary.done}
                <span className="text-lg font-normal text-muted-foreground"> / {summary.planned}</span>
              </p>
              <ProgressMeter value={summary.done} max={summary.planned} label="Workouts done this week" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">Training time</p>
              <p className="mt-1 text-3xl font-semibold">{formatMinutes(summary.doneMinutes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">of {formatMinutes(summary.plannedMinutes)} planned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">On track</p>
              <p className="mt-1 text-3xl font-semibold">
                {summary.adherence === null ? "–" : `${Math.round(summary.adherence * 100)}%`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.due === 0
                  ? "Nothing due yet this week"
                  : `${summary.dueDone} of ${summary.due} workouts due so far`}
              </p>
            </CardContent>
          </Card>
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
                workouts={workouts.filter((workout) => workout.dayOfWeek === dayOfWeek)}
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

      <p className="text-xs text-muted-foreground">
        This is your repeating weekly plan: drag a workout to another day to move it, click it to edit its exercises,
        and tick it off each week. Changes to the plan apply to every week; completions are kept per week.
      </p>

      {!empty && (
        <Card>
          <CardHeader>
            <CardTitle>Recent weeks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {[...history].reverse().map((entry) => (
                <li key={entry.weekStart} className="flex items-center gap-4 text-sm">
                  <span className="w-28 shrink-0 text-muted-foreground">{weekLabel(entry.weekStart)}</span>
                  <ProgressMeter
                    value={entry.done}
                    max={entry.planned}
                    label={`Workouts done in week of ${entry.weekStart}`}
                    className="flex-1"
                  />
                  <span className="w-12 shrink-0 text-right tabular-nums">
                    {entry.done}/{entry.planned}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
      <WorkoutFormDialog open={formOpen} onOpenChange={setFormOpen} workout={editing} defaultDay={newDay} />
    </div>
  );
}
