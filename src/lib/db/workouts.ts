import { addWeeks, format, parseISO } from "date-fns";
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
  /** First week (the Sunday, "YYYY-MM-DD") this workout is part of the plan; null = from the beginning. */
  validFrom: string | null;
  /** Last week it is part of the plan; null = it keeps repeating every week. */
  validUntil: string | null;
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
  valid_from: z.string().nullable(),
  valid_until: z.string().nullable(),
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
    `SELECT id, title, day_of_week, start_time, duration_minutes, category, notes, created_at, valid_from, valid_until
     FROM workouts
     ORDER BY day_of_week, COALESCE(start_time, '99:99'), created_at, id`,
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
    validFrom: row.valid_from,
    validUntil: row.valid_until,
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

/** The Sunday before the given Sunday. */
function weekBefore(weekStart: string): string {
  return format(addWeeks(parseISO(weekStart), -1), "yyyy-MM-dd");
}

const versionRowSchema = z.array(
  z.object({ valid_from: z.string().nullable(), valid_until: z.string().nullable(), created_at: z.string() }),
);

/**
 * A workout is part of the plan for a range of weeks (see migration 012). Every change below is made "from
 * `weekStart` onward": a workout that started before that week is closed at the week before it, so earlier
 * weeks keep the plan (and the ticks) they had, and the change continues as a new version from `weekStart`.
 */
async function versionOf(id: number): Promise<{ validFrom: string | null; validUntil: string | null; createdAt: string }> {
  const db = await getDb();
  const row = versionRowSchema.parse(
    await db.select<unknown>("SELECT valid_from, valid_until, created_at FROM workouts WHERE id = $1", [id]),
  )[0];
  if (!row) throw new Error("That workout no longer exists");
  return { validFrom: row.valid_from, validUntil: row.valid_until, createdAt: row.created_at };
}

/** Adds a workout that is part of the plan from `weekStart` onward. */
export async function createWorkout(input: WorkoutInput, weekStart: string): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO workouts (title, day_of_week, start_time, duration_minutes, category, notes, valid_from)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [input.title, input.dayOfWeek, input.startTime, input.durationMinutes, input.category, input.notes, weekStart],
  );
  const id = result.lastInsertId;
  if (id === undefined) throw new Error("Workout insert did not return an id");
  await replaceExercises(id, input.exercises);
  return id;
}

/** Ends a workout's part in the plan at `weekStart`: gone from that week on, kept (with its ticks) before it. */
async function retireFrom(id: number, weekStart: string): Promise<void> {
  const db = await getDb();
  const { validFrom } = await versionOf(id);
  if (validFrom !== null && validFrom >= weekStart) {
    // It only ever existed from this week on, so there is no earlier history to keep.
    await db.execute("DELETE FROM workouts WHERE id = $1", [id]);
    return;
  }
  await db.execute("DELETE FROM workout_logs WHERE workout_id = $1 AND week_start >= $2", [id, weekStart]);
  await db.execute("UPDATE workouts SET valid_until = $1 WHERE id = $2", [weekBefore(weekStart), id]);
}

/**
 * Replaces the weekly plan from `weekStart` onward with the given workouts. Earlier weeks keep their
 * workouts and completion history.
 */
export async function replaceAllWorkouts(inputs: WorkoutInput[], weekStart: string): Promise<void> {
  const db = await getDb();
  const rows = z
    .array(z.object({ id: z.number() }))
    .parse(await db.select<unknown>("SELECT id FROM workouts WHERE valid_until IS NULL OR valid_until >= $1", [weekStart]));
  for (const row of rows) await retireFrom(row.id, weekStart);
  for (const input of inputs) await createWorkout(input, weekStart);
}

/** Changes a workout from `weekStart` onward (see versionOf); earlier weeks keep the old version. */
export async function updateWorkout(id: number, input: WorkoutInput, weekStart: string): Promise<void> {
  const db = await getDb();
  const { validFrom, validUntil, createdAt } = await versionOf(id);
  if (validFrom !== null && validFrom >= weekStart) {
    // It starts in this very week, so nothing earlier can be affected: edit it in place.
    await db.execute(
      `UPDATE workouts
          SET title = $1, day_of_week = $2, start_time = $3, duration_minutes = $4, category = $5, notes = $6
        WHERE id = $7`,
      [input.title, input.dayOfWeek, input.startTime, input.durationMinutes, input.category, input.notes, id],
    );
    await replaceExercises(id, input.exercises);
    return;
  }
  // New version first, so a failure part-way never leaves the plan without this workout. It keeps the original
  // creation time, which is what orders workouts that share a day and time, so it stays in the same spot.
  const result = await db.execute(
    `INSERT INTO workouts (title, day_of_week, start_time, duration_minutes, category, notes, valid_from, valid_until, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [input.title, input.dayOfWeek, input.startTime, input.durationMinutes, input.category, input.notes, weekStart, validUntil, createdAt],
  );
  const newId = result.lastInsertId;
  if (newId === undefined) throw new Error("Workout insert did not return an id");
  await replaceExercises(newId, input.exercises);
  // Ticks from this week on follow the workout into its new version; earlier ones stay with the old one.
  await db.execute("UPDATE workout_logs SET workout_id = $1 WHERE workout_id = $2 AND week_start >= $3", [newId, id, weekStart]);
  await db.execute("UPDATE workouts SET valid_until = $1 WHERE id = $2", [weekBefore(weekStart), id]);
}

/** Drag-and-drop to another day: a change from `weekStart` onward like any other. */
export async function moveWorkout(id: number, dayOfWeek: number, weekStart: string): Promise<void> {
  const db = await getDb();
  const rows = z
    .array(workoutRowSchema.omit({ id: true, created_at: true, valid_from: true, valid_until: true }))
    .parse(
      await db.select<unknown>(
        "SELECT title, day_of_week, start_time, duration_minutes, category, notes FROM workouts WHERE id = $1",
        [id],
      ),
    );
  const row = rows[0];
  if (!row) throw new Error("That workout no longer exists");
  const exercises = z
    .array(exerciseRowSchema.omit({ id: true, workout_id: true }))
    .parse(await db.select<unknown>("SELECT name, sets, reps, weight FROM workout_exercises WHERE workout_id = $1 ORDER BY position, id", [id]));
  await updateWorkout(
    id,
    {
      title: row.title,
      dayOfWeek,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      category: row.category,
      notes: row.notes,
      exercises: exercises.map((exercise) => ({ name: exercise.name, sets: exercise.sets, reps: exercise.reps ?? "", weight: exercise.weight })),
    },
    weekStart,
  );
}

/** Removes a workout from `weekStart` onward; weeks before it keep it and its completion history. */
export async function deleteWorkout(id: number, weekStart: string): Promise<void> {
  await retireFrom(id, weekStart);
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
