import { addDays, addWeeks, parseISO } from "date-fns";
import { toDateString } from "@/lib/dates";
import type {
  ExerciseInput,
  Workout,
  WorkoutCategory,
  WorkoutInput,
  WorkoutLog,
} from "@/lib/db/workouts";

/** Id of a day column as a drop target while dragging workouts. */
export const dayDropId = (dayOfWeek: number) => `day-${dayOfWeek}`;

/** Index = weekday number, 0 = Sunday ... 6 = Saturday (weeks run Sunday to Saturday). */
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;

export const CATEGORY_INFO: Record<WorkoutCategory, { label: string; color: string }> = {
  strength: { label: "Strength", color: "#2a78d6" },
  cardio: { label: "Cardio", color: "#e34948" },
  mobility: { label: "Mobility", color: "#1baf7a" },
  sport: { label: "Sport", color: "#6250d6" },
  recovery: { label: "Recovery", color: "#898781" },
};

/** Weekday number of a "YYYY-MM-DD" date: 0 = Sunday ... 6 = Saturday. */
export function dayIndexOf(date: string): number {
  return parseISO(date).getDay();
}

/** The calendar date a workout falls on in the week starting `weekStart` (a Sunday). */
export function workoutDate(weekStart: string, dayOfWeek: number): string {
  return toDateString(addDays(parseISO(weekStart), dayOfWeek));
}

export type WorkoutStatus = "done" | "missed" | "today" | "upcoming";

export function logKey(workoutId: number, weekStart: string): string {
  return `${workoutId}|${weekStart}`;
}

export function logKeys(logs: WorkoutLog[]): Set<string> {
  return new Set(logs.map((log) => logKey(log.workoutId, log.weekStart)));
}

export function workoutStatus(
  workout: Workout,
  weekStart: string,
  done: Set<string>,
  today: string,
): WorkoutStatus {
  if (done.has(logKey(workout.id, weekStart))) return "done";
  const date = workoutDate(weekStart, workout.dayOfWeek);
  if (date < today) return "missed";
  return date === today ? "today" : "upcoming";
}

export interface WeekSummary {
  planned: number;
  done: number;
  plannedMinutes: number;
  doneMinutes: number;
  /** Workouts whose day has already started (today or earlier). */
  due: number;
  dueDone: number;
  /** Done / due, or null when nothing was due yet. */
  adherence: number | null;
}

export function summarizeWeek(
  workouts: Workout[],
  logs: WorkoutLog[],
  weekStart: string,
  today: string,
): WeekSummary {
  const done = logKeys(logs);
  const summary: WeekSummary = {
    planned: workouts.length,
    done: 0,
    plannedMinutes: 0,
    doneMinutes: 0,
    due: 0,
    dueDone: 0,
    adherence: null,
  };
  for (const workout of workouts) {
    const minutes = workout.durationMinutes ?? 0;
    const isDone = done.has(logKey(workout.id, weekStart));
    summary.plannedMinutes += minutes;
    if (isDone) {
      summary.done += 1;
      summary.doneMinutes += minutes;
    }
    if (workoutDate(weekStart, workout.dayOfWeek) <= today) {
      summary.due += 1;
      if (isDone) summary.dueDone += 1;
    }
  }
  summary.adherence = summary.due === 0 ? null : summary.dueDone / summary.due;
  return summary;
}

export interface WeekHistory {
  weekStart: string;
  planned: number;
  done: number;
}

/**
 * Completed vs planned for the last `count` weeks, oldest first. A workout only counts as planned
 * for weeks that end on or after the day it was created, so a new plan does not make earlier
 * weeks look like failures.
 */
export function recentWeeks(
  workouts: Workout[],
  logs: WorkoutLog[],
  currentWeekStart: string,
  count: number,
): WeekHistory[] {
  const result: WeekHistory[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = addWeeks(parseISO(currentWeekStart), -offset);
    const weekStart = toDateString(start);
    const weekEnd = toDateString(addDays(start, 6));
    const done = logs.filter((log) => log.weekStart === weekStart).length;
    const planned = workouts.filter((workout) => toDateString(parseISO(workout.createdAt)) <= weekEnd).length;
    result.push({ weekStart, planned: Math.max(planned, done), done });
  }
  return result;
}

function exercise(name: string, sets: number, reps: string): ExerciseInput {
  return { name, sets, reps, weight: null };
}

function strength(
  title: string,
  dayOfWeek: number,
  exercises: ExerciseInput[],
  durationMinutes = 60,
): WorkoutInput {
  return {
    title,
    dayOfWeek,
    startTime: null,
    durationMinutes,
    category: "strength",
    notes: "",
    exercises,
  };
}

function upperDay(dayOfWeek: number): WorkoutInput {
  return strength("Upper", dayOfWeek, [
    exercise("Bench Press", 4, "8-10"),
    exercise("Barbell Row", 4, "8-10"),
    exercise("Overhead Press", 3, "8-10"),
    exercise("Lat Pulldown", 3, "10-12"),
    exercise("Biceps Curl", 3, "10-12"),
    exercise("Triceps Pushdown", 3, "10-12"),
  ]);
}

function lowerDay(dayOfWeek: number): WorkoutInput {
  return strength("Lower", dayOfWeek, [
    exercise("Squat", 4, "6-8"),
    exercise("Romanian Deadlift", 3, "8-10"),
    exercise("Leg Press", 3, "10-12"),
    exercise("Leg Curl", 3, "10-12"),
    exercise("Calf Raise", 4, "12-15"),
  ]);
}

function runningDay(dayOfWeek: number): WorkoutInput {
  return {
    title: "Running",
    dayOfWeek,
    startTime: null,
    durationMinutes: 45,
    category: "cardio",
    notes: "Easy, conversational pace.",
    exercises: [],
  };
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  workouts: WorkoutInput[];
}

/** Starter plans: a sensible week to begin from, fully editable afterwards (weights left blank). */
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "default",
    name: "Default",
    description: "6 days: Upper, Upper, Lower, Rest, Upper, Running. Sunday off.",
    // Thursday has no workout: an empty day is shown as a rest day.
    workouts: [
      upperDay(DAY.sun),
      upperDay(DAY.mon),
      runningDay(DAY.tue),
      upperDay(DAY.thu),
      upperDay(DAY.fri),
      lowerDay(DAY.sat),
    ],
  },
  {
    id: "ppl",
    name: "Push / Pull / Legs",
    description: "3 days a week: Mon, Wed, Fri",
    workouts: [
      strength("Push", DAY.mon, [
        exercise("Bench Press", 4, "8-10"),
        exercise("Overhead Press", 3, "8-10"),
        exercise("Incline Dumbbell Press", 3, "10-12"),
        exercise("Lateral Raise", 3, "12-15"),
        exercise("Triceps Pushdown", 3, "10-12"),
      ]),
      strength("Pull", DAY.wed, [
        exercise("Barbell Row", 4, "8-10"),
        exercise("Pull-up", 3, "6-10"),
        exercise("Lat Pulldown", 3, "10-12"),
        exercise("Face Pull", 3, "12-15"),
        exercise("Biceps Curl", 3, "10-12"),
      ]),
      strength("Legs", DAY.fri, [
        exercise("Squat", 4, "6-8"),
        exercise("Romanian Deadlift", 3, "8-10"),
        exercise("Leg Press", 3, "10-12"),
        exercise("Leg Curl", 3, "10-12"),
        exercise("Calf Raise", 4, "12-15"),
      ]),
    ],
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    description: "4 days a week: Mon, Tue, Thu, Fri",
    workouts: [
      strength("Upper A", DAY.mon, [
        exercise("Bench Press", 4, "6-8"),
        exercise("Barbell Row", 4, "6-8"),
        exercise("Overhead Press", 3, "8-10"),
        exercise("Lat Pulldown", 3, "10-12"),
        exercise("Triceps Pushdown", 3, "10-12"),
      ]),
      strength("Lower A", DAY.tue, [
        exercise("Squat", 4, "6-8"),
        exercise("Romanian Deadlift", 3, "8-10"),
        exercise("Leg Press", 3, "10-12"),
        exercise("Calf Raise", 4, "12-15"),
      ]),
      strength("Upper B", DAY.thu, [
        exercise("Incline Dumbbell Press", 4, "8-10"),
        exercise("Pull-up", 4, "6-10"),
        exercise("Lateral Raise", 3, "12-15"),
        exercise("Biceps Curl", 3, "10-12"),
        exercise("Face Pull", 3, "12-15"),
      ]),
      strength("Lower B", DAY.fri, [
        exercise("Deadlift", 3, "5"),
        exercise("Lunge", 3, "10-12"),
        exercise("Leg Curl", 3, "10-12"),
        exercise("Hanging Leg Raise", 3, "10-15"),
      ]),
    ],
  },
  {
    id: "full-body",
    name: "Full Body ×3",
    description: "3 days a week: Mon, Wed, Fri",
    workouts: [
      strength("Full Body A", DAY.mon, [
        exercise("Squat", 3, "6-8"),
        exercise("Bench Press", 3, "6-8"),
        exercise("Barbell Row", 3, "8-10"),
        exercise("Plank", 3, "45s"),
      ]),
      strength("Full Body B", DAY.wed, [
        exercise("Deadlift", 3, "5"),
        exercise("Overhead Press", 3, "8-10"),
        exercise("Pull-up", 3, "6-10"),
        exercise("Lunge", 3, "10-12"),
      ]),
      strength("Full Body C", DAY.fri, [
        exercise("Front Squat", 3, "6-8"),
        exercise("Incline Dumbbell Press", 3, "8-10"),
        exercise("Lat Pulldown", 3, "10-12"),
        exercise("Hanging Leg Raise", 3, "10-15"),
      ]),
    ],
  },
];
