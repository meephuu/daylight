import { z } from "zod";
import { getDb } from "./client";

export const WORKOUT_CATEGORIES = ["strength", "cardio", "mobility", "sport", "recovery"] as const;
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number];

export interface Exercise {
  id: number;
  name: string;
  sets: number | null;
  /** Free text so "8-10", "AMRAP" or "30s" all work. */
  reps: string;
  /** kg */
  weight: number | null;
}

export interface Workout {
  id: number;
  title: string;
  /** 0 = Sunday ... 6 = Saturday. */
  dayOfWeek: number;
  /** "HH:MM" or null. */
  startTime: string | null;
  durationMinutes: number | null;
  category: WorkoutCategory;
  notes: string;
  createdAt: string;
  exercises: Exercise[];
}

export interface ExerciseInput {
  name: string;
  sets: number | null;
  reps: string;
  weight: number | null;
}

export interface WorkoutInput {
  title: string;
  dayOfWeek: number;
  startTime: string | null;
  durationMinutes: number | null;
  category: WorkoutCategory;
  notes: string;
  exercises: ExerciseInput[];
}

export interface WorkoutLog {
  id: number;
  workoutId: number;
  /** Sunday starting the week the workout was done in, "YYYY-MM-DD". */
  weekStart: string;
  doneDate: string;
}

const workoutRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  category: z.enum(WORKOUT_CATEGORIES),
  notes: z.string(),
  created_at: z.string(),
});

const exerciseRowSchema = z.object({
  id: z.number(),
  workout_id: z.number(),
  name: z.string(),
  sets: z.number().nullable(),
  reps: z.string().nullable(),
  weight: z.number().nullable(),
});

const logRowSchema = z.object({
  id: z.number(),
  workout_id: z.number(),
  week_start: z.string(),
  done_date: z.string(),
});

export async function listWorkouts(): Promise<Workout[]> {
  const db = await getDb();
  const workoutRows = await db.select<unknown>(
    `SELECT id, title, day_of_week, start_time, duration_minutes, category, notes, created_at
     FROM workouts
     ORDER BY day_of_week, COALESCE(start_time, '99:99'), id`,
  );
  const exerciseRows = await db.select<unknown>(
    "SELECT id, workout_id, name, sets, reps, weight FROM workout_exercises ORDER BY workout_id, position, id",
  );

  const exercisesByWorkout = new Map<number, Exercise[]>();
  for (const row of z.array(exerciseRowSchema).parse(exerciseRows)) {
    const list = exercisesByWorkout.get(row.workout_id) ?? [];
    list.push({ id: row.id, name: row.name, sets: row.sets, reps: row.reps ?? "", weight: row.weight });
    exercisesByWorkout.set(row.workout_id, list);
  }

  return z.array(workoutRowSchema).parse(workoutRows).map((row) => ({
    id: row.id,
    title: row.title,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    durationMinutes: row.duration_minutes,
    category: row.category,
    notes: row.notes,
    createdAt: row.created_at,
    exercises: exercisesByWorkout.get(row.id) ?? [],
  }));
}

async function replaceExercises(workoutId: number, exercises: ExerciseInput[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM workout_exercises WHERE workout_id = $1", [workoutId]);
  for (const [position, exercise] of exercises.entries()) {
    await db.execute(
      `INSERT INTO workout_exercises (workout_id, name, sets, reps, weight, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [workoutId, exercise.name, exercise.sets, exercise.reps, exercise.weight, position],
    );
  }
}

export async function createWorkout(input: WorkoutInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO workouts (title, day_of_week, start_time, duration_minutes, category, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.title, input.dayOfWeek, input.startTime, input.durationMinutes, input.category, input.notes],
  );
  const id = result.lastInsertId;
  if (id === undefined) throw new Error("Workout insert did not return an id");
  await replaceExercises(id, input.exercises);
  return id;
}

/** Replaces the whole weekly plan: every workout (with its exercises and history) is removed first. */
export async function replaceAllWorkouts(inputs: WorkoutInput[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM workouts");
  for (const input of inputs) await createWorkout(input);
}

export async function updateWorkout(id: number, input: WorkoutInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE workouts
        SET title = $1, day_of_week = $2, start_time = $3, duration_minutes = $4, category = $5, notes = $6
      WHERE id = $7`,
    [input.title, input.dayOfWeek, input.startTime, input.durationMinutes, input.category, input.notes, id],
  );
  await replaceExercises(id, input.exercises);
}

export async function moveWorkout(id: number, dayOfWeek: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE workouts SET day_of_week = $1 WHERE id = $2", [dayOfWeek, id]);
}

/** Exercises and completion history are removed too (ON DELETE CASCADE). */
export async function deleteWorkout(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM workouts WHERE id = $1", [id]);
}

export async function listWorkoutLogs(): Promise<WorkoutLog[]> {
  const db = await getDb();
  const rows = await db.select<unknown>("SELECT id, workout_id, week_start, done_date FROM workout_logs");
  return z.array(logRowSchema).parse(rows).map((row) => ({
    id: row.id,
    workoutId: row.workout_id,
    weekStart: row.week_start,
    doneDate: row.done_date,
  }));
}

export async function setWorkoutDone(
  workoutId: number,
  weekStart: string,
  doneDate: string,
  done: boolean,
): Promise<void> {
  const db = await getDb();
  if (!done) {
    await db.execute("DELETE FROM workout_logs WHERE workout_id = $1 AND week_start = $2", [
      workoutId,
      weekStart,
    ]);
    return;
  }
  await db.execute(
    `INSERT INTO workout_logs (workout_id, week_start, done_date) VALUES ($1, $2, $3)
     ON CONFLICT (workout_id, week_start) DO UPDATE SET done_date = excluded.done_date`,
    [workoutId, weekStart, doneDate],
  );
}
