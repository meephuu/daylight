import { z } from "zod";
import { getDb } from "./client";

export const HABIT_FREQUENCIES = ["daily", "weekly"] as const;
export type HabitFrequency = (typeof HABIT_FREQUENCIES)[number];

export interface Habit {
  id: number;
  name: string;
  frequency: HabitFrequency;
  /** Times per day (daily habits) or per week (weekly habits). */
  targetPerPeriod: number;
  color: string;
  archived: boolean;
  createdAt: string;
}

export interface HabitInput {
  name: string;
  frequency: HabitFrequency;
  targetPerPeriod: number;
  color: string;
}

export interface HabitLog {
  id: number;
  habitId: number;
  date: string; // YYYY-MM-DD
  count: number;
}

const habitRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  frequency: z.enum(HABIT_FREQUENCIES),
  target_per_period: z.number(),
  color: z.string(),
  archived: z.number(),
  created_at: z.string(),
});

const habitLogRowSchema = z.object({
  id: z.number(),
  habit_id: z.number(),
  date: z.string(),
  count: z.number(),
});

export async function listHabits(): Promise<Habit[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    "SELECT id, name, frequency, target_per_period, color, archived, created_at FROM habits ORDER BY archived, id",
  );
  return z.array(habitRowSchema).parse(rows).map((row) => ({
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    targetPerPeriod: row.target_per_period,
    color: row.color,
    archived: row.archived === 1,
    createdAt: row.created_at,
  }));
}

export async function listHabitLogs(): Promise<HabitLog[]> {
  const db = await getDb();
  const rows = await db.select<unknown>("SELECT id, habit_id, date, count FROM habit_logs");
  return z.array(habitLogRowSchema).parse(rows).map((row) => ({
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    count: row.count,
  }));
}

export async function createHabit(input: HabitInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO habits (name, frequency, target_per_period, color) VALUES ($1, $2, $3, $4)",
    [input.name, input.frequency, input.targetPerPeriod, input.color],
  );
}

export async function updateHabit(id: number, input: HabitInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE habits SET name = $1, frequency = $2, target_per_period = $3, color = $4 WHERE id = $5",
    [input.name, input.frequency, input.targetPerPeriod, input.color, id],
  );
}

export async function setHabitArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE habits SET archived = $1 WHERE id = $2", [archived ? 1 : 0, id]);
}

/** Logs are removed too (ON DELETE CASCADE). */
export async function deleteHabit(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM habits WHERE id = $1", [id]);
}

/** Sets the count for one habit on one day; a count of 0 removes the log row. */
export async function setHabitLogCount(habitId: number, date: string, count: number): Promise<void> {
  const db = await getDb();
  if (count <= 0) {
    await db.execute("DELETE FROM habit_logs WHERE habit_id = $1 AND date = $2", [habitId, date]);
    return;
  }
  await db.execute(
    `INSERT INTO habit_logs (habit_id, date, count) VALUES ($1, $2, $3)
     ON CONFLICT (habit_id, date) DO UPDATE SET count = excluded.count`,
    [habitId, date, count],
  );
}
