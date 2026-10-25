import { z } from "zod";
import { getDb } from "./client";

export interface Expense {
  id: number;
  amount: number;
  category: string;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface ExpenseInput {
  amount: number;
  category: string;
  note: string;
  date: string;
}

const expenseRowSchema = z.object({
  id: z.number(),
  amount: z.number(),
  category: z.string(),
  note: z.string(),
  date: z.string(),
  created_at: z.string(),
});

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    "SELECT id, amount, category, note, date, created_at FROM expenses ORDER BY date DESC, id DESC",
  );
  return z.array(expenseRowSchema).parse(rows).map((row) => ({
    id: row.id,
    amount: row.amount,
    category: row.category,
    note: row.note,
    date: row.date,
    createdAt: row.created_at,
  }));
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT INTO expenses (amount, category, note, date) VALUES ($1, $2, $3, $4)", [
    input.amount,
    input.category,
    input.note,
    input.date,
  ]);
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE expenses SET amount = $1, category = $2, note = $3, date = $4 WHERE id = $5",
    [input.amount, input.category, input.note, input.date, id],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM expenses WHERE id = $1", [id]);
}
