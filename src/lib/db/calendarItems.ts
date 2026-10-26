import { z } from "zod";
import { getDb } from "./client";

export const ITEM_KINDS = ["event", "reminder"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const REPEAT_RULES = ["none", "weekly", "monthly", "yearly"] as const;
export type RepeatRule = (typeof REPEAT_RULES)[number];

export interface CalendarItem {
  id: number;
  kind: ItemKind;
  title: string;
  notes: string;
  /** First (or only) day, "YYYY-MM-DD". */
  startDate: string;
  /** "HH:MM", or null for an all-day item. */
  startTime: string | null;
  /** "HH:MM"; events only. */
  endTime: string | null;
  color: string;
  repeatRule: RepeatRule;
  /** Weekly repeats only: 0 = Sunday ... 6 = Saturday. Empty means "the weekday of startDate". */
  repeatWeekdays: number[];
  /** Last day a repeating item may occur; null = forever. */
  repeatUntil: string | null;
  createdAt: string;
}

export interface CalendarItemInput {
  kind: ItemKind;
  title: string;
  notes: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  color: string;
  repeatRule: RepeatRule;
  repeatWeekdays: number[];
  repeatUntil: string | null;
}

export type OccurrenceState = "done" | "skipped";

export interface OccurrenceStateRow {
  itemId: number;
  date: string;
  state: OccurrenceState;
}

const itemRowSchema = z.object({
  id: z.number(),
  kind: z.enum(ITEM_KINDS),
  title: z.string(),
  notes: z.string(),
  start_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  color: z.string(),
  repeat_rule: z.enum(REPEAT_RULES),
  repeat_weekdays: z.string(),
  repeat_until: z.string().nullable(),
  created_at: z.string(),
});

const stateRowSchema = z.object({
  item_id: z.number(),
  date: z.string(),
  state: z.enum(["done", "skipped"]),
});

function parseWeekdays(text: string): number[] {
  return text
    .split(",")
    .map((part) => Number(part))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export async function listCalendarItems(): Promise<CalendarItem[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT id, kind, title, notes, start_date, start_time, end_time, color, repeat_rule,
            repeat_weekdays, repeat_until, created_at
     FROM calendar_items
     ORDER BY start_date, COALESCE(start_time, '99:99'), id`,
  );
  return z.array(itemRowSchema).parse(rows).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    notes: row.notes,
    startDate: row.start_date,
    startTime: row.start_time,
    endTime: row.end_time,
    color: row.color,
    repeatRule: row.repeat_rule,
    repeatWeekdays: parseWeekdays(row.repeat_weekdays),
    repeatUntil: row.repeat_until,
    createdAt: row.created_at,
  }));
}

function weekdaysText(input: CalendarItemInput): string {
  if (input.repeatRule !== "weekly") return "";
  return [...new Set(input.repeatWeekdays)].sort((a, b) => a - b).join(",");
}

export async function createCalendarItem(input: CalendarItemInput): Promise<void> {
  const db = await getDb();
  const repeating = input.repeatRule !== "none";
  await db.execute(
    `INSERT INTO calendar_items
       (kind, title, notes, start_date, start_time, end_time, color, repeat_rule, repeat_weekdays, repeat_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.kind,
      input.title,
      input.notes,
      input.startDate,
      input.startTime,
      input.kind === "event" ? input.endTime : null,
      input.color,
      input.repeatRule,
      weekdaysText(input),
      repeating ? input.repeatUntil : null,
    ],
  );
}

export async function updateCalendarItem(id: number, input: CalendarItemInput): Promise<void> {
  const db = await getDb();
  const repeating = input.repeatRule !== "none";
  await db.execute(
    `UPDATE calendar_items
        SET title = $1, notes = $2, start_date = $3, start_time = $4, end_time = $5, color = $6,
            repeat_rule = $7, repeat_weekdays = $8, repeat_until = $9
      WHERE id = $10`,
    [
      input.title,
      input.notes,
      input.startDate,
      input.startTime,
      input.kind === "event" ? input.endTime : null,
      input.color,
      input.repeatRule,
      weekdaysText(input),
      repeating ? input.repeatUntil : null,
      id,
    ],
  );
}

/** Moves a one-off item to another day (drag-and-drop on the calendar). */
export async function moveCalendarItem(id: number, startDate: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE calendar_items SET start_date = $1 WHERE id = $2", [startDate, id]);
}

/** Removes the whole series; its per-day states are removed too (ON DELETE CASCADE). */
export async function deleteCalendarItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM calendar_items WHERE id = $1", [id]);
}

export async function listOccurrenceStates(): Promise<OccurrenceStateRow[]> {
  const db = await getDb();
  const rows = await db.select<unknown>("SELECT item_id, date, state FROM calendar_occurrence_states");
  return z.array(stateRowSchema).parse(rows).map((row) => ({
    itemId: row.item_id,
    date: row.date,
    state: row.state,
  }));
}

/** Sets a single day's state for an item; `null` clears it. */
export async function setOccurrenceState(
  itemId: number,
  date: string,
  state: OccurrenceState | null,
): Promise<void> {
  const db = await getDb();
  if (state === null) {
    await db.execute("DELETE FROM calendar_occurrence_states WHERE item_id = $1 AND date = $2", [
      itemId,
      date,
    ]);
    return;
  }
  await db.execute(
    `INSERT INTO calendar_occurrence_states (item_id, date, state) VALUES ($1, $2, $3)
     ON CONFLICT (item_id, date) DO UPDATE SET state = excluded.state`,
    [itemId, date, state],
  );
}
