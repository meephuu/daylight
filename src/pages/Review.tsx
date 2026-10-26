import { useMemo, useState } from "react";
import { addWeeks, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HabitHeatmap } from "@/components/review/HabitHeatmap";
import { MoneyPanel } from "@/components/review/MoneyPanel";
import { ReviewHero } from "@/components/review/ReviewHero";
import { TasksPanel } from "@/components/review/TasksPanel";
import { WeekStrip } from "@/components/review/WeekStrip";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { useExpenseSettings, useExpenses } from "@/hooks/useExpenses";
import { useHabitLogs, useHabits } from "@/hooks/useHabits";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useWorkoutLogs, useWorkouts } from "@/hooks/useWorkouts";
import { todayString } from "@/lib/dates";
import { confirmedOnly, pendingOnly } from "@/lib/expenses";
import { groupLogsByHabit } from "@/lib/habits";
import { weekRange } from "@/lib/review";
import { buildWeekReport, previousWeekRange, type WeekInputs } from "@/lib/weekReport";

export default function ReviewPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const range = useMemo(() => weekRange(cursor), [cursor]);
  const today = todayString();

  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const habitsQuery = useHabits();
  const logsQuery = useHabitLogs();
  const workoutsQuery = useWorkouts();
  const workoutLogsQuery = useWorkoutLogs();
  const expensesQuery = useExpenses();
  const categoriesQuery = useCategories();
  const settings = useExpenseSettings();

  const projectsById = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])), [projectsQuery.data]);
  const categoriesById = useMemo(() => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category])), [categoriesQuery.data]);
  const logsByHabit = useMemo(() => groupLogsByHabit(logsQuery.data ?? []), [logsQuery.data]);
  const workoutLogs = useMemo(() => workoutLogsQuery.data ?? [], [workoutLogsQuery.data]);
  const workouts = useMemo(() => workoutsQuery.data ?? [], [workoutsQuery.data]);
  const confirmed = useMemo(() => confirmedOnly(expensesQuery.data ?? []), [expensesQuery.data]);
  const pending = useMemo(() => pendingOnly(expensesQuery.data ?? []), [expensesQuery.data]);

  const inputs = useMemo<WeekInputs>(
    () => ({
      tasks: tasksQuery.data ?? [],
      habits: (habitsQuery.data ?? []).filter((habit) => !habit.archived),
      logsByHabit,
      workouts,
      workoutLogs,
      expenses: confirmed,
      categoriesById,
      budgetSatang: settings.budgetSatang,
    }),
    [tasksQuery.data, habitsQuery.data, logsByHabit, workouts, workoutLogs, confirmed, categoriesById, settings.budgetSatang],
  );
  const report = useMemo(() => buildWeekReport(inputs, range, today), [inputs, range, today]);
  const previous = useMemo(() => buildWeekReport(inputs, previousWeekRange(range), today), [inputs, range, today]);
  const weekExpenses = useMemo(
    () => confirmed.filter((expense) => expense.date >= range.start && expense.date <= range.end),
    [confirmed, range],
  );

  const isThisWeek = range.days.includes(today);
  const isFutureWeek = range.start > today;
  const title = `${format(parseISO(range.start), "MMM d")} – ${format(parseISO(range.end), "MMM d, yyyy")}`;
  const loadError = [tasksQuery, habitsQuery, expensesQuery, workoutsQuery].find((query) => query.isError);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Weekly review</h1>
          <p className="text-sm text-muted-foreground">{title}</p>
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
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">Could not load all data: {String(loadError.error)}</p>}

      <ReviewHero report={report} previous={previous} isFutureWeek={isFutureWeek} />

      {/* Keyed by week so the selected day starts from this week's today / best day. */}
      <WeekStrip
        key={range.start}
        report={report}
        today={today}
        workouts={workouts}
        workoutLogs={workoutLogs}
        expenses={weekExpenses}
        categoriesById={categoriesById}
      />

      <TasksPanel report={report} today={today} projectsById={projectsById} />
      <HabitHeatmap report={report} today={today} logsByHabit={logsByHabit} />
      <MoneyPanel report={report} previous={previous} today={today} pending={pending} hasBudget={settings.budgetSatang !== null} />
    </div>
  );
}
