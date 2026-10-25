import { z } from "zod";
import { getDb } from "./client";

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  id: number;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface TaskInput {
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: number | null;
  tags: string[];
}

const taskRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  notes: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  due_date: z.string().nullable(),
  project_id: z.number().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  tags: z.string().nullable(),
});

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Trim, drop leading "#" and commas, and de-duplicate case-insensitively. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/[#,]/g, "").trim();
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }
  return result;
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT t.id, t.title, t.notes, t.status, t.priority, t.due_date, t.project_id,
            t.completed_at, t.created_at, t.updated_at,
            (SELECT group_concat(g.name, ',')
               FROM task_tags tt JOIN tags g ON g.id = tt.tag_id
              WHERE tt.task_id = t.id) AS tags
     FROM tasks t`,
  );
  return z.array(taskRowSchema).parse(rows).map((row) => ({
    id: row.id,
    title: row.title,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    projectId: row.project_id,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",") : [],
  }));
}

async function setTaskTags(taskId: number, tags: string[]): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM task_tags WHERE task_id = $1", [taskId]);
  for (const name of normalizeTags(tags)) {
    await db.execute("INSERT OR IGNORE INTO tags (name) VALUES ($1)", [name]);
    await db.execute(
      "INSERT OR IGNORE INTO task_tags (task_id, tag_id) SELECT $1, id FROM tags WHERE name = $2",
      [taskId, name],
    );
  }
  // Remove tags no task uses any more.
  await db.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM task_tags)");
}

export async function createTask(input: TaskInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO tasks (title, notes, status, priority, due_date, project_id, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 = 'done' THEN ${NOW_SQL} END)`,
    [
      input.title,
      input.notes,
      input.status,
      input.priority,
      input.dueDate,
      input.projectId,
      input.status,
    ],
  );
  const id = result.lastInsertId;
  if (id === undefined) throw new Error("Task insert did not return an id");
  await setTaskTags(id, input.tags);
  return id;
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  const db = await getDb();
  // In an UPDATE, column references on the right-hand side see the OLD row, so completed_at
  // is decided from the new status passed as $7 (same value as $3).
  await db.execute(
    `UPDATE tasks
        SET title = $1, notes = $2, status = $3, priority = $4, due_date = $5, project_id = $6,
            completed_at = CASE WHEN $7 = 'done' THEN COALESCE(completed_at, ${NOW_SQL}) END,
            updated_at = ${NOW_SQL}
      WHERE id = $8`,
    [
      input.title,
      input.notes,
      input.status,
      input.priority,
      input.dueDate,
      input.projectId,
      input.status,
      id,
    ],
  );
  await setTaskTags(id, input.tags);
}

export async function setTaskStatus(id: number, status: TaskStatus): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE tasks
        SET status = $1,
            completed_at = CASE WHEN $2 = 'done' THEN COALESCE(completed_at, ${NOW_SQL}) END,
            updated_at = ${NOW_SQL}
      WHERE id = $3`,
    [status, status, id],
  );
}

export async function setTaskDueDate(id: number, dueDate: string | null): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE tasks SET due_date = $1, updated_at = ${NOW_SQL} WHERE id = $2`, [
    dueDate,
    id,
  ]);
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
  await db.execute("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM task_tags)");
}
