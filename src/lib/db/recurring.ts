import { z } from "zod";
import { getDb } from "./client";
import { addDays, dueDates, type Frequency } from "@/lib/recurring";

export interface RecurringExpense {
  id: number;
  amountSatang: number;
  categoryId: number;
  paymentMethodId: number | null;
  note: string;
  frequency: Frequency;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: string;
  /** Every due date up to and including this one already has its entry. */
  generatedThrough: string | null;
  active: boolean;
  createdAt: string;
}

export interface RecurringInput {
  amountSatang: number;
  categoryId: number;
  paymentMethodId: number | null;
  note: string;
  frequency: Frequency;
  dayOfMonth: number | null;
  weekday: number | null;
  startDate: string;
}

const rowSchema = z.object({
  id: z.number(),
  amount_satang: z.number().int(),
  category_id: z.number(),
  payment_method_id: z.number().nullable(),
  note: z.string(),
  frequency: z.enum(["monthly", "weekly"]),
  day_of_month: z.number().nullable(),
  weekday: z.number().nullable(),
  start_date: z.string(),
  generated_through: z.string().nullable(),
  active: z.number(),
  created_at: z.string(),
});

export async function listRecurring(): Promise<RecurringExpense[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT id, amount_satang, category_id, payment_method_id, note, frequency, day_of_month, weekday,
            start_date, generated_through, active, created_at
       FROM recurring_expenses ORDER BY active DESC, id`,
  );
  return z.array(rowSchema).parse(rows).map((row) => ({
    id: row.id,
    amountSatang: row.amount_satang,
    categoryId: row.category_id,
    paymentMethodId: row.payment_method_id,
    note: row.note,
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    weekday: row.weekday,
    startDate: row.start_date,
    generatedThrough: row.generated_through,
    active: row.active === 1,
    createdAt: row.created_at,
  }));
}

function scheduleValues(input: RecurringInput): [number | null, number | null] {
  return input.frequency === "monthly" ? [input.dayOfMonth, null] : [null, input.weekday];
}

export async function createRecurring(input: RecurringInput): Promise<void> {
  const db = await getDb();
  const [dayOfMonth, weekday] = scheduleValues(input);
  await db.execute(
    `INSERT INTO recurring_expenses
       (amount_satang, category_id, payment_method_id, note, frequency, day_of_month, weekday, start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [input.amountSatang, input.categoryId, input.paymentMethodId, input.note, input.frequency, dayOfMonth, weekday, input.startDate],
  );
}

export async function updateRecurring(id: number, input: RecurringInput): Promise<void> {
  const db = await getDb();
  const [dayOfMonth, weekday] = scheduleValues(input);
  await db.execute(
    `UPDATE recurring_expenses
        SET amount_satang = $1, category_id = $2, payment_method_id = $3, note = $4, frequency = $5,
            day_of_month = $6, weekday = $7, start_date = $8
      WHERE id = $9`,
    [input.amountSatang, input.categoryId, input.paymentMethodId, input.note, input.frequency, dayOfMonth, weekday, input.startDate, id],
  );
}

/** Pausing keeps the rule. Resuming skips whatever fell due while it was paused instead of back-filling it. */
export async function setRecurringActive(id: number, active: boolean, today: string): Promise<void> {
  const db = await getDb();
  if (active) {
    await db.execute(
      `UPDATE recurring_expenses
          SET active = 1,
              generated_through = CASE WHEN generated_through IS NULL OR generated_through < $1 THEN $1 ELSE generated_through END
        WHERE id = $2`,
      [addDays(today, -1), id],
    );
  } else {
    await db.execute("UPDATE recurring_expenses SET active = 0 WHERE id = $1", [id]);
  }
}

/** Entries already created stay (their link to the rule is cleared by the foreign key). */
export async function deleteRecurring(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM recurring_expenses WHERE id = $1", [id]);
}

let running: Promise<number> | null = null;

/**
 * Creates a "pending" entry for every due date up to today that has none yet, for each active rule, and
 * remembers how far it got. Safe to call any number of times: a unique index stops a date from being
 * created twice, and a deleted pending entry is not brought back. Resolves to how many entries it created.
 */
export function generateDueExpenses(today: string): Promise<number> {
  running ??= generate(today).finally(() => {
    running = null;
  });
  return running;
}

async function generate(today: string): Promise<number> {
  const db = await getDb();
  const rules = (await listRecurring()).filter((rule) => rule.active && rule.generatedThrough !== today);
  let created = 0;
  for (const rule of rules) {
    for (const date of dueDates(rule, rule.generatedThrough, today)) {
      await db.execute(
        `INSERT OR IGNORE INTO expenses
           (amount_satang, category_id, payment_method_id, note, date, status, recurring_id)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
        [rule.amountSatang, rule.categoryId, rule.paymentMethodId, rule.note, date, rule.id],
      );
      created += 1;
    }
    await db.execute("UPDATE recurring_expenses SET generated_through = $1 WHERE id = $2", [today, rule.id]);
  }
  return created;
}
