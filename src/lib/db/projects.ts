import { z } from "zod";
import { getDb } from "./client";

export interface Project {
  id: number;
  name: string;
  color: string;
  description: string;
  archived: boolean;
  createdAt: string;
  totalTasks: number;
  doneTasks: number;
}

export interface ProjectInput {
  name: string;
  color: string;
  description: string;
}

const projectRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  archived: z.number(),
  created_at: z.string(),
  total_tasks: z.number(),
  done_tasks: z.number(),
});

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT p.id, p.name, p.color, p.description, p.archived, p.created_at,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS total_tasks,
            (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks
     FROM projects p
     ORDER BY p.archived, p.name COLLATE NOCASE`,
  );
  return z.array(projectRowSchema).parse(rows).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description,
    archived: row.archived === 1,
    createdAt: row.created_at,
    totalTasks: row.total_tasks,
    doneTasks: row.done_tasks,
  }));
}

export async function createProject(input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO projects (name, color, description) VALUES ($1, $2, $3)", [
    input.name,
    input.color,
    input.description,
  ]);
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET name = $1, color = $2, description = $3 WHERE id = $4", [
    input.name,
    input.color,
    input.description,
    id,
  ]);
}

export async function setProjectArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE projects SET archived = $1 WHERE id = $2", [archived ? 1 : 0, id]);
}

/** Tasks in the project are kept; their project_id becomes NULL (ON DELETE SET NULL). */
export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM projects WHERE id = $1", [id]);
}
