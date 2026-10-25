import { z } from "zod";
import { getDb } from "./client";

export interface FocusSession {
  id: number;
  taskId: number | null;
  projectId: number | null;
  startedAt: string; // ISO timestamp (UTC)
  durationMinutes: number;
}

export interface FocusSessionInput {
  taskId: number | null;
  projectId: number | null;
  startedAt: string;
  durationMinutes: number;
}

const focusSessionRowSchema = z.object({
  id: z.number(),
  task_id: z.number().nullable(),
  project_id: z.number().nullable(),
  started_at: z.string(),
  duration_minutes: z.number(),
});

export async function listFocusSessions(): Promise<FocusSession[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    "SELECT id, task_id, project_id, started_at, duration_minutes FROM focus_sessions ORDER BY started_at DESC",
  );
  return z.array(focusSessionRowSchema).parse(rows).map((row) => ({
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    startedAt: row.started_at,
    durationMinutes: row.duration_minutes,
  }));
}

export async function createFocusSession(input: FocusSessionInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO focus_sessions (task_id, project_id, started_at, duration_minutes) VALUES ($1, $2, $3, $4)",
    [input.taskId, input.projectId, input.startedAt, input.durationMinutes],
  );
}

export async function deleteFocusSession(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM focus_sessions WHERE id = $1", [id]);
}
