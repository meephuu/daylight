import { z } from "zod";
import { getDb } from "./client";

const settingRowSchema = z.object({ key: z.string(), value: z.string() });

export async function listSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select<unknown>("SELECT key, value FROM settings");
  return Object.fromEntries(z.array(settingRowSchema).parse(rows).map((row) => [row.key, row.value]));
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM settings WHERE key = $1", [key]);
}
