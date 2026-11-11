import { z } from "zod";
import { getDb } from "./client";

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string | null;
  sortOrder: number;
  archived: boolean;
}

const rowSchema = z.object({
  id: z.number(),
  name: z.string(),
  icon: z.string().nullable(),
  sort_order: z.number(),
  archived: z.number(),
});

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const db = await getDb();
  const rows = await db.select<unknown>(
    "SELECT id, name, icon, sort_order, archived FROM payment_methods ORDER BY archived, sort_order, id",
  );
  return z.array(rowSchema).parse(rows).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    sortOrder: row.sort_order,
    archived: row.archived === 1,
  }));
}

export async function createPaymentMethod(name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO payment_methods (name, icon, sort_order)
     VALUES ($1, 'Wallet', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM payment_methods))`,
    [name],
  );
}

export async function renamePaymentMethod(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE payment_methods SET name = $1 WHERE id = $2", [name, id]);
}

export async function setPaymentMethodArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE payment_methods SET archived = $1 WHERE id = $2", [archived ? 1 : 0, id]);
}

/** Entries that used it just end up with no payment method (the foreign key sets them to NULL). */
export async function deletePaymentMethod(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM payment_methods WHERE id = $1", [id]);
}
