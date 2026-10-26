import { z } from "zod";
import { getDb } from "./client";

export interface Category {
  id: number;
  name: string;
  /** "#RRGGBB" */
  color: string;
  /** Name of a lucide icon (see lib/categoryIcons.ts), or null. */
  icon: string | null;
  monthlyBudgetSatang: number | null;
  sortOrder: number;
  archived: boolean;
  /** "Other": the category expenses fall back to. It cannot be deleted or archived. */
  isFallback: boolean;
  createdAt: string;
}

export interface CategoryInput {
  name: string;
  color: string;
  icon: string | null;
  monthlyBudgetSatang: number | null;
}

const categoryRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  monthly_budget_satang: z.number().nullable(),
  sort_order: z.number(),
  archived: z.number(),
  is_fallback: z.number(),
  created_at: z.string(),
});

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    `SELECT id, name, color, icon, monthly_budget_satang, sort_order, archived, is_fallback, created_at
     FROM categories ORDER BY archived, sort_order, id`,
  );
  return z.array(categoryRowSchema).parse(rows).map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    monthlyBudgetSatang: row.monthly_budget_satang,
    sortOrder: row.sort_order,
    archived: row.archived === 1,
    isFallback: row.is_fallback === 1,
    createdAt: row.created_at,
  }));
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO categories (name, color, icon, monthly_budget_satang, sort_order)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories))`,
    [input.name, input.color, input.icon, input.monthlyBudgetSatang],
  );
}

export async function updateCategory(id: number, input: CategoryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE categories SET name = $1, color = $2, icon = $3, monthly_budget_satang = $4 WHERE id = $5",
    [input.name, input.color, input.icon, input.monthlyBudgetSatang, id],
  );
}

/** Saves a new order: `orderedIds` are the active categories, first to last. */
export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  for (const [index, id] of orderedIds.entries()) {
    await db.execute("UPDATE categories SET sort_order = $1 WHERE id = $2", [index + 1, id]);
  }
}

/** Archived categories disappear from the add form but still show correctly on old expenses. */
export async function setCategoryArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE categories SET archived = $1 WHERE id = $2 AND is_fallback = 0", [archived ? 1 : 0, id]);
}

/**
 * Deletes a category. Its expenses must go somewhere first: pass `reassignTo`, or the delete is refused by the
 * database (ON DELETE RESTRICT) when any expense still uses it. "Other" is never deleted.
 */
export async function deleteCategory(id: number, reassignTo: number | null): Promise<void> {
  const db = await getDb();
  if (reassignTo !== null) {
    await db.execute("UPDATE expenses SET category_id = $1 WHERE category_id = $2", [reassignTo, id]);
    await db.execute("UPDATE recurring_expenses SET category_id = $1 WHERE category_id = $2", [reassignTo, id]);
  }
  await db.execute("DELETE FROM categories WHERE id = $1 AND is_fallback = 0", [id]);
}
