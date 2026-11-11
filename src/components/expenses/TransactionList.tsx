import { useMemo, type KeyboardEvent } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Copy, Repeat, Trash2 } from "lucide-react";
import { CategoryAvatar } from "@/components/expenses/CategoryAvatar";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import type { PaymentMethod } from "@/lib/db/paymentMethods";
import { groupByDate, sumSatang, type SortKey } from "@/lib/expenses";
import { formatTHB } from "@/lib/money";

interface TransactionListProps {
  expenses: Expense[];
  sort: SortKey;
  /** Today in Bangkok, "YYYY-MM-DD", for the "Today" / "Yesterday" labels. */
  today: string;
  categoriesById: Map<number, Category>;
  methodsById: Map<number, PaymentMethod>;
  onEdit: (expense: Expense) => void;
  onDuplicate: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

function dayLabel(date: string, today: string): string {
  const formatted = format(parseISO(date), "EEEE, MMM d");
  if (date === today) return `Today · ${formatted}`;
  if (date === format(addDays(parseISO(today), -1), "yyyy-MM-dd")) return `Yesterday · ${formatted}`;
  return formatted;
}

/** ArrowUp / ArrowDown move between the rows' main buttons. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const target = event.target as HTMLElement;
  if (target.closest("[data-row-main]") === null) return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-row-main]")];
  const next = rows[rows.indexOf(target.closest<HTMLElement>("[data-row-main]")!) + (event.key === "ArrowDown" ? 1 : -1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

export function TransactionList({
  expenses,
  sort,
  today,
  categoriesById,
  methodsById,
  onEdit,
  onDuplicate,
  onDelete,
}: TransactionListProps) {
  // Sorting by date groups rows under their day; sorting by amount is one flat list that shows each row's date.
  const byDate = sort === "date-desc" || sort === "date-asc";
  const groups = useMemo(() => (byDate ? groupByDate(expenses) : [["", expenses] as [string, Expense[]]]), [byDate, expenses]);

  function renderRow(expense: Expense) {
    const category = categoriesById.get(expense.categoryId);
    const method = expense.paymentMethodId === null ? null : methodsById.get(expense.paymentMethodId);
    const details = [
      !byDate ? format(parseISO(expense.date), "EEE, MMM d") : null,
      expense.note || null,
      method?.name ?? null,
    ].filter((part): part is string => part !== null);
    const name = category?.name ?? "Unknown category";

    return (
      <li key={expense.id} className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-foreground/[0.05]">
        {category ? (
          <CategoryAvatar category={category} className="size-9" />
        ) : (
          <span className="size-9 shrink-0 rounded-full bg-foreground/15" aria-hidden="true" />
        )}
        <button
          type="button"
          data-row-main
          onClick={() => onEdit(expense)}
          aria-label={`Edit ${name} ${formatTHB(expense.amountSatang)}${expense.note ? `, ${expense.note}` : ""}`}
          className="flex min-w-0 flex-1 flex-col items-start rounded-lg px-1 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex max-w-full items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{name}</span>
            {expense.recurringId !== null && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="Recurring" />}
          </span>
          {details.length > 0 && (
            <span className="max-w-full truncate text-xs text-muted-foreground">{details.join(" · ")}</span>
          )}
        </button>
        <span className="flex shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-sm" onClick={() => onDuplicate(expense)} aria-label={`Duplicate ${name} ${formatTHB(expense.amountSatang)}`} title="Duplicate">
            <Copy className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(expense)} aria-label={`Delete ${name} ${formatTHB(expense.amountSatang)}`} title="Delete">
            <Trash2 className="size-4" />
          </Button>
        </span>
        <span className="w-32 shrink-0 text-right font-display text-[17px] font-semibold tracking-[-0.02em] tabular-nums">{formatTHB(expense.amountSatang)}</span>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5" onKeyDown={moveFocus}>
      {groups.map(([date, rows]) => (
        <section key={date || "all"} aria-label={date ? dayLabel(date, today) : "Transactions"}>
          {byDate && (
            <h3 className="mb-1 flex items-baseline justify-between gap-3 px-2 font-display text-[15px] font-semibold tracking-[-0.015em]">
              <span>{dayLabel(date, today)}</span>
              {/* A day with a single transaction would only repeat that row's amount. */}
              {rows.length > 1 && <span className="font-sans text-xs font-medium text-muted-foreground tabular-nums">{formatTHB(sumSatang(rows))}</span>}
            </h3>
          )}
          <ul className="flex flex-col">{rows.map(renderRow)}</ul>
        </section>
      ))}
    </div>
  );
}
