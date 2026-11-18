import { z } from "zod";
import { getDb } from "./client";

/**
 * Focus sessions (migration 014): every focus run of the Focus page's timer, with its task.
 * Times are Bangkok local "YYYY-MM-DD HH:MM:SS" text, so grouping by day is plain string work.
 */

export interface FocusSession {
  id: number;
  taskId: number | null;
  taskTitle: string | null;
  projectId: number | null;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  focusedSeconds: number;
  completed: boolean;
}

export interface FocusSessionInput {
  taskId: number | null;
  taskTitle: string | null;
  projectId: number | null;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  focusedSeconds: number;
  completed: boolean;
}

export interface FocusDay {
  day: string; // YYYY-MM-DD
  seconds: number;
  sessions: number;
}

const sessionRowSchema = z.object({
  id: z.number(),
  task_id: z.number().nullable(),
  task_title: z.string().nullable(),
  project_id: z.number().nullable(),
  started_at: z.string(),
  ended_at: z.string(),
  planned_seconds: z.number(),
  focused_seconds: z.number(),
  completed: z.number(),
});

/** Saves a session and returns its id. */
export async function addFocusSession(input: FocusSessionInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO focus_sessions (task_id, task_title, project_id, started_at, ended_at, planned_seconds, focused_seconds, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.taskId,
      input.taskTitle,
      input.projectId,
      input.startedAt,
      input.endedAt,
      Math.round(input.plannedSeconds),
      Math.round(input.focusedSeconds),
      input.completed ? 1 : 0,
    ],
  );
  return Number(result.lastInsertId);
}

const SESSION_COLUMNS =
  "id, task_id, task_title, project_id, started_at, ended_at, planned_seconds, focused_seconds, completed";

/** Sessions that started on one day ("YYYY-MM-DD"), in order. */
export async function listFocusSessionsOn(day: string): Promise<FocusSession[]> {
  return listFocusSessionsBetween(day, day);
}

/** Sessions that started from `from` to `to` (both "YYYY-MM-DD", inclusive), in order. */
export async function listFocusSessionsBetween(from: string, to: string): Promise<FocusSession[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT ${SESSION_COLUMNS} FROM focus_sessions
     WHERE substr(started_at, 1, 10) BETWEEN $1 AND $2 ORDER BY started_at`,
    [from, to],
  );
  return z.array(sessionRowSchema).parse(rows).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    projectId: row.project_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    plannedSeconds: row.planned_seconds,
    focusedSeconds: row.focused_seconds,
    completed: row.completed === 1,
  }));
}

/** Time focused per day from `from` ("YYYY-MM-DD") on; days without sessions are left out. */
export async function listFocusDays(from: string): Promise<FocusDay[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT substr(started_at, 1, 10) AS day, SUM(focused_seconds) AS seconds, COUNT(*) AS sessions
     FROM focus_sessions WHERE started_at >= $1 GROUP BY day ORDER BY day`,
    [from],
  );
  return z
    .array(z.object({ day: z.string(), seconds: z.number(), sessions: z.number() }))
    .parse(rows);
}

export async function deleteFocusSession(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM focus_sessions WHERE id = $1", [id]);
}
