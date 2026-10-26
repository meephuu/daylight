import { z } from "zod";
import { getDb } from "./client";

export type ExpenseStatus = "confirmed" | "pending";

export interface Expense {
  id: number;
  /** Whole satang (1 baht = 100 satang). */
  amountSatang: number;
  categoryId: number;
  paymentMethodId: number | null;
  note: string;
  date: string; // YYYY-MM-DD
  /** "pending" entries were created by a recurring rule and are left out of every total until confirmed. */
  status: ExpenseStatus;
  recurringId: number | null;
  createdAt: string;
}

export interface ExpenseInput {
  amountSatang: number;
  categoryId: number;
  paymentMethodId: number | null;
  note: string;
  date: string;
  /** On update: leave undefined to keep the current status. */
  status?: ExpenseStatus;
}

const expenseRowSchema = z.object({
  id: z.number(),
  amount_satang: z.number().int(),
  category_id: z.number(),
  payment_method_id: z.number().nullable(),
  note: z.string(),
  date: z.string(),
  status: z.enum(["confirmed", "pending"]),
  recurring_id: z.number().nullable(),
  created_at: z.string(),
});

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT id, amount_satang, category_id, payment_method_id, note, date, status, recurring_id, created_at
     FROM expenses ORDER BY date DESC, id DESC`,
  );
  return z.array(expenseRowSchema).parse(rows).map((row) => ({
    id: row.id,
    amountSatang: row.amount_satang,
    categoryId: row.category_id,
    paymentMethodId: row.payment_method_id,
    note: row.note,
    date: row.date,
    status: row.status,
    recurringId: row.recurring_id,
    createdAt: row.created_at,
  }));
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO expenses (amount_satang, category_id, payment_method_id, note, date, status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.amountSatang, input.categoryId, input.paymentMethodId, input.note, input.date, input.status ?? "confirmed"],
  );
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE expenses
        SET amount_satang = $1, category_id = $2, payment_method_id = $3, note = $4, date = $5,
            status = COALESCE($6, status)
      WHERE id = $7`,
    [input.amountSatang, input.categoryId, input.paymentMethodId, input.note, input.date, input.status ?? null, id],
  );
}

export async function confirmExpenses(ids: number[]): Promise<void> {
  const db = await getDb();
  for (const id of ids) {
    await db.execute("UPDATE expenses SET status = 'confirmed' WHERE id = $1", [id]);
  }
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM expenses WHERE id = $1", [id]);
}

/** Puts a deleted expense back exactly as it was (same id and creation time); this is what "Undo" calls. */
export async function restoreExpense(expense: Expense): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR IGNORE INTO expenses
       (id, amount_satang, category_id, payment_method_id, note, date, status, recurring_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      expense.id,
      expense.amountSatang,
      expense.categoryId,
      expense.paymentMethodId,
      expense.note,
      expense.date,
      expense.status,
      expense.recurringId,
      expense.createdAt,
    ],
  );
}
