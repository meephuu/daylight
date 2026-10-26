import { z } from "zod";
import { DEFAULT_NOTE_HEIGHT, DEFAULT_NOTE_WIDTH } from "@/lib/notes";
import { getDb } from "./client";

export interface Note {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface NewNote {
  x: number;
  y: number;
  color: string;
}

const noteRowSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  pinned: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  z_index: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const NEXT_Z_SQL = "(SELECT COALESCE(MAX(z_index), 0) + 1 FROM notes)";

export async function listNotes(): Promise<Note[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT id, title, content, pinned, x, y, width, height, color, z_index, created_at, updated_at
     FROM notes ORDER BY z_index, id`,
  );
  return z.array(noteRowSchema).parse(rows).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned === 1,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    zIndex: row.z_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createNote(input: NewNote): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO notes (x, y, width, height, color, z_index) VALUES ($1, $2, $3, $4, $5, ${NEXT_Z_SQL})`,
    [input.x, input.y, DEFAULT_NOTE_WIDTH, DEFAULT_NOTE_HEIGHT, input.color],
  );
}

export async function updateNoteText(id: number, title: string, content: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE notes SET title = $1, content = $2, updated_at = ${NOW_SQL} WHERE id = $3`,
    [title, content, id],
  );
}

/** Moving a note also brings it to the front. */
export async function moveNote(id: number, x: number, y: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE notes SET x = $1, y = $2, z_index = ${NEXT_Z_SQL} WHERE id = $3`, [
    x,
    y,
    id,
  ]);
}

export async function resizeNote(id: number, width: number, height: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET width = $1, height = $2 WHERE id = $3", [width, height, id]);
}

export async function setNoteColor(id: number, color: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET color = $1 WHERE id = $2", [color, id]);
}

export async function setNotePinned(id: number, pinned: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE notes SET pinned = $1 WHERE id = $2", [pinned ? 1 : 0, id]);
}

export async function bringNoteToFront(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE notes SET z_index = ${NEXT_Z_SQL} WHERE id = $1`, [id]);
}

export async function deleteNote(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}
