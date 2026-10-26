import { format, parseISO } from "date-fns";
import { Check, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import { sumSatang } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

interface PendingExpensesCardProps {
  pending: Expense[];
  categoriesById: Map<number, Category>;
  onConfirm: (expenses: Expense[]) => void;
  onEdit: (expense: Expense) => void;
  onSkip: (expense: Expense) => void;
}

/** Recurring expenses that fell due and wait for a yes. They count towards nothing until confirmed. */
export function PendingExpensesCard({ pending, categoriesById, onConfirm, onEdit, onSkip }: PendingExpensesCardProps) {
  if (pending.length === 0) return null;
  const ordered = [...pending].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  return (
    <Card className="border-[var(--viz-warning)]/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="size-4" />
          Waiting for confirmation · {pending.length}
        </CardTitle>
        <CardDescription>
          Recurring expenses that came due ({formatTHB(sumSatang(pending))}). They are not counted until you confirm them.
        </CardDescription>
        {pending.length > 1 && (
          <CardAction>
            <Button size="sm" onClick={() => onConfirm(ordered)}>
              <Check className="size-4" />
              Confirm all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {ordered.map((expense) => {
            const category = categoriesById.get(expense.categoryId);
            const name = category?.name ?? "Unknown category";
            return (
              <li key={expense.id} className="flex items-center gap-3 py-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? "#9CA3AF" }} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onEdit(expense)}
                  aria-label={`Review ${name} ${formatTHB(expense.amountSatang)} due ${expense.date}`}
                  className="flex min-w-0 flex-1 flex-col items-start rounded-md px-1.5 py-1 text-left outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="truncate text-sm font-medium">{expense.note || name}</span>
                  <span className="text-xs text-muted-foreground">
                    {expense.note ? `${name} · ` : ""}
                    due {format(parseISO(expense.date), "EEE, MMM d")}
                  </span>
                </button>
                <span className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">{formatTHB(expense.amountSatang)}</span>
                <Button size="sm" onClick={() => onConfirm([expense])} aria-label={`Confirm ${name} ${formatTHB(expense.amountSatang)}`}>
                  <Check className="size-4" />
                  Confirm
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => onSkip(expense)} aria-label={`Skip ${name} ${formatTHB(expense.amountSatang)}`} title="Skip this one">
                  <X className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
