import { z } from "zod";
import { bangkokDateTime } from "@/lib/bangkok";
import { getDb } from "./client";

export const SHORTCUT_KINDS = ["app", "website"] as const;
export type ShortcutKind = (typeof SHORTCUT_KINDS)[number];

export const ICON_SOURCES = ["auto", "custom"] as const;
export type IconSource = (typeof ICON_SOURCES)[number];

/** A Quick Access shortcut on the App page. */
export interface AppShortcut {
  id: number;
  name: string;
  kind: ShortcutKind;
  /** App: "shell:AppsFolder\<id>", a .exe / .lnk path or a URI. Website: an http(s) URL. */
  target: string;
  /** Websites only: "default" or a browser id (see BROWSERS in lib/launcher). */
  browser: string;
  /** data: URL, or null for the generic icon. */
  icon: string | null;
  iconSource: IconSource;
  launchCount: number;
  /** Bangkok local time, "YYYY-MM-DD HH:MM:SS". */
  lastLaunchedAt: string | null;
  createdAt: string;
}

export interface AppShortcutInput {
  name: string;
  kind: ShortcutKind;
  target: string;
  browser: string;
  icon: string | null;
  iconSource: IconSource;
}

const rowSchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(SHORTCUT_KINDS),
  target: z.string(),
  browser: z.string(),
  icon: z.string().nullable(),
  icon_source: z.enum(ICON_SOURCES),
  launch_count: z.number(),
  last_launched_at: z.string().nullable(),
  created_at: z.string(),
});

const COLUMNS = "id, name, kind, target, browser, icon, icon_source, launch_count, last_launched_at, created_at";

export async function listAppShortcuts(): Promise<AppShortcut[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(`SELECT ${COLUMNS} FROM app_shortcuts ORDER BY id`);
  return z.array(rowSchema).parse(rows).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    target: row.target,
    browser: row.browser,
    icon: row.icon,
    iconSource: row.icon_source,
    launchCount: row.launch_count,
    lastLaunchedAt: row.last_launched_at,
    createdAt: row.created_at,
  }));
}

/** Adds a shortcut and returns its id. */
export async function createAppShortcut(input: AppShortcutInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO app_shortcuts (name, kind, target, browser, icon, icon_source) VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.name, input.kind, input.target, input.browser, input.icon, input.iconSource],
  );
  return Number(result.lastInsertId);
}

export async function updateAppShortcut(id: number, input: AppShortcutInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE app_shortcuts SET name = $1, kind = $2, target = $3, browser = $4, icon = $5, icon_source = $6 WHERE id = $7`,
    [input.name, input.kind, input.target, input.browser, input.icon, input.iconSource, id],
  );
}

/** Sets an icon found after the shortcut was saved, unless one was chosen by hand in the meantime. */
export async function setAutoIcon(id: number, target: string, icon: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE app_shortcuts SET icon = $1 WHERE id = $2 AND target = $3 AND icon_source = 'auto'`,
    [icon, id, target],
  );
}

/** Counts one more opening from the App page. */
export async function recordAppLaunch(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE app_shortcuts SET launch_count = launch_count + 1, last_launched_at = $1 WHERE id = $2`,
    [bangkokDateTime(), id],
  );
}

export async function deleteAppShortcut(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM app_shortcuts WHERE id = $1", [id]);
}

/** Puts a deleted shortcut back exactly as it was (same id, count and icon); this is what "Undo" calls. */
export async function restoreAppShortcut(shortcut: AppShortcut): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO app_shortcuts (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      shortcut.id,
      shortcut.name,
      shortcut.kind,
      shortcut.target,
      shortcut.browser,
      shortcut.icon,
      shortcut.iconSource,
      shortcut.launchCount,
      shortcut.lastLaunchedAt,
      shortcut.createdAt,
    ],
  );
}
