import { addDays, parseISO, startOfWeek } from "date-fns";
import { daysInMonthKey } from "@/lib/bangkok";
import { toDateString } from "@/lib/dates";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import type { Habit, HabitLog } from "@/lib/db/habits";
import type { Task } from "@/lib/db/tasks";
import type { Workout, WorkoutLog } from "@/lib/db/workouts";
import { categoryTotals, sumSatang, type CategoryTotal } from "@/lib/expenses";
import { completedInWeek, habitWeek, overallConsistency, slippedInWeek, weekRange, type HabitWeek, type WeekRange } from "@/lib/review";
import { logKeys, logKey, summarizeWeek, workoutDate, type WeekSummary } from "@/lib/training";

export interface WeekInputs {
  tasks: Task[];
  /** Habits still in use (not archived). */
  habits: Habit[];
  logsByHabit: Map<number, HabitLog[]>;
  workouts: Workout[];
  workoutLogs: WorkoutLog[];
  /** Confirmed expenses only; entries waiting for confirmation count towards nothing. */
  expenses: Expense[];
  categoriesById: Map<number, Category>;
  /** Monthly budget in satang, or null when none is set. */
  budgetSatang: number | null;
}

export interface DayReport {
  date: string;
  tasksDone: number;
  /** Habits that met their target (or, for weekly habits, were logged) on this day. */
  habitsMet: number;
  /** Habits that could be judged on this day. */
  habitsJudged: number;
  workoutsDone: number;
  workoutsPlanned: number;
  spentSatang: number;
}

export interface MoneyReport {
  spentSatang: number;
  /** Confirmed spending per day of the week, Sunday first. */
  perDay: number[];
  /** What the budget allows for the days of the week that have started; null without a budget. */
  paceSatang: number | null;
  topCategory: CategoryTotal | null;
}

export interface WeekReport {
  range: WeekRange;
  completed: Task[];
  slipped: Task[];
  /** Tasks due in the week that count towards the ring: already due, or already done. */
  dueTasks: number;
  dueTasksDone: number;
  habitWeeks: HabitWeek[];
  consistency: number | null;
  training: WeekSummary;
  money: MoneyReport;
  days: DayReport[];
  /** Date of the most productive day, or null when no day stands out. */
  bestDay: string | null;
  /** 0-100 average over the parts that could be judged, or null when none could. */
  score: number | null;
}

export function previousWeekRange(range: WeekRange): WeekRange {
  return weekRange(addDays(parseISO(range.start), -7));
}

/** The Sunday-start date of the week containing `date`. */
export function weekStartOf(date: string): string {
  return toDateString(startOfWeek(parseISO(date), { weekStartsOn: 0 }));
}

function localDate(iso: string): string {
  return toDateString(parseISO(iso));
}

function dailyBudget(budgetSatang: number, date: string): number {
  return budgetSatang / daysInMonthKey(date.slice(0, 7));
}

/** The weekly "score": spending is judged against the budget pace, the rest against their own targets. */
function computeScore(parts: (number | null)[]): number | null {
  const present = parts.filter((part): part is number => part !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((sum, part) => sum + part, 0) / present.length) * 100);
}

export function buildWeekReport(inputs: WeekInputs, range: WeekRange, today: string): WeekReport {
  const { tasks, habits, logsByHabit, workouts, workoutLogs, expenses, categoriesById, budgetSatang } = inputs;

  // ---- tasks
  const completed = completedInWeek(tasks, range);
  const slipped = slippedInWeek(tasks, range, today);
  const counted = tasks.filter(
    (task) => task.dueDate !== null && task.dueDate >= range.start && task.dueDate <= range.end && (task.dueDate <= today || task.status === "done"),
  );
  const dueTasksDone = counted.filter((task) => task.status === "done").length;

  // ---- habits
  const habitWeeks = habits.map((habit) => habitWeek(habit, logsByHabit.get(habit.id) ?? [], range, today));
  const consistency = overallConsistency(habitWeeks);

  // ---- training
  const weekLogs = workoutLogs.filter((log) => log.weekStart === range.start);
  const training = summarizeWeek(workouts, weekLogs, range.start, today);
  const doneKeys = logKeys(weekLogs);

  // ---- money
  const weekExpenses = expenses.filter((expense) => expense.date >= range.start && expense.date <= range.end);
  const perDay = range.days.map((date) => sumSatang(weekExpenses.filter((expense) => expense.date === date)));
  const spentSatang = perDay.reduce((sum, value) => sum + value, 0);
  const started = range.days.filter((date) => date <= today);
  const paceSatang =
    budgetSatang === null || started.length === 0
      ? null
      : Math.round(started.reduce((sum, date) => sum + dailyBudget(budgetSatang, date), 0));
  const topCategory = categoryTotals(weekExpenses, categoriesById)[0] ?? null;

  // ---- days
  const days: DayReport[] = range.days.map((date, index) => {
    const judged = habitWeeks.filter((week) => {
      const status = week.days[index];
      return status !== undefined && status !== "future" && status !== "before";
    }).length;
    const met = habitWeeks.filter((week) => week.days[index] === "met" || week.days[index] === "logged").length;
    const planned = workouts.filter((workout) => workoutDate(range.start, workout.dayOfWeek) === date);
    return {
      date,
      tasksDone: completed.filter((task) => task.completedAt !== null && localDate(task.completedAt) === date).length,
      habitsMet: met,
      habitsJudged: judged,
      workoutsDone: planned.filter((workout) => doneKeys.has(logKey(workout.id, range.start))).length,
      workoutsPlanned: planned.length,
      spentSatang: perDay[index] ?? 0,
    };
  });

  // ---- best day: tasks and workouts weigh more than a single habit tick; later days never beat an equal earlier one
  let bestDay: string | null = null;
  let bestPoints = 0;
  for (const day of days) {
    const points = day.tasksDone * 2 + day.habitsMet + day.workoutsDone * 3;
    if (points > bestPoints) {
      bestPoints = points;
      bestDay = day.date;
    }
  }

  // ---- score
  const taskPart = counted.length === 0 ? null : dueTasksDone / counted.length;
  const moneyPart =
    paceSatang === null || paceSatang === 0 ? null : spentSatang <= paceSatang ? 1 : Math.max(0, 1 - (spentSatang - paceSatang) / paceSatang);
  const score = computeScore([taskPart, consistency, training.adherence, moneyPart]);

  return {
    range,
    completed,
    slipped,
    dueTasks: counted.length,
    dueTasksDone,
    habitWeeks,
    consistency,
    training,
    money: { spentSatang, perDay, paceSatang, topCategory },
    days,
    bestDay,
    score,
  };
}

export interface Headline {
  title: string;
  tone: "great" | "good" | "ok" | "low" | "none";
}

export function headlineFor(score: number | null, isFutureWeek: boolean): Headline {
  if (isFutureWeek) return { title: "This week has not started yet", tone: "none" };
  if (score === null) return { title: "Nothing to review yet", tone: "none" };
  if (score >= 85) return { title: "An outstanding week", tone: "great" };
  if (score >= 70) return { title: "A solid week", tone: "good" };
  if (score >= 50) return { title: "A steady week", tone: "ok" };
  if (score >= 30) return { title: "A slow week", tone: "low" };
  return { title: "A quiet week", tone: "low" };
}

/**
 * Where a slipped task goes with "Move to next week": the same weekday in the week after the current one
 * (or after the viewed week, if that is later), so it never lands in the past.
 */
export function nextWeekDate(dueDate: string, viewedWeekStart: string, today: string): string {
  const base = weekStartOf(viewedWeekStart > today ? viewedWeekStart : today);
  const weekday = parseISO(dueDate).getDay();
  return toDateString(addDays(parseISO(base), 7 + weekday));
}

/** Percentage-point or absolute change between this week and last, for the little arrows. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}
