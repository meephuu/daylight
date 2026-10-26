import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Category } from "@/lib/db/categories";
import type { RecurringExpense } from "@/lib/db/recurring";
import { formatTHB } from "@/lib/money";
import { upcomingInMonth } from "@/lib/recurring";

interface UpcomingRecurringCardProps {
  rules: RecurringExpense[];
  monthKey: string;
  today: string;
  categoriesById: Map<number, Category>;
}

export interface UpcomingItem {
  key: string;
  date: string;
  rule: RecurringExpense;
}

export function upcomingItems(rules: RecurringExpense[], monthKey: string, today: string): UpcomingItem[] {
  return rules
    .filter((rule) => rule.active)
    .flatMap((rule) => upcomingInMonth(rule, monthKey, today).map((date) => ({ key: `${rule.id}-${date}`, date, rule })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.rule.id - b.rule.id);
}

/** Recurring expenses still to come this month, with their total. Nothing for months that are over. */
export function UpcomingRecurringCard({ rules, monthKey, today, categoriesById }: UpcomingRecurringCardProps) {
  const items = useMemo(() => upcomingItems(rules, monthKey, today), [rules, monthKey, today]);
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.rule.amountSatang, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" />
          Upcoming this month · {formatTHB(total)}
        </CardTitle>
        <CardDescription>
          {items.length} recurring expense{items.length === 1 ? "" : "s"} still to come. Not counted in your totals yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map(({ key, date, rule }) => {
            const category = categoriesById.get(rule.categoryId);
            return (
              <li key={key} className="flex items-center gap-3 py-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? "#9CA3AF" }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{rule.note || category?.name || "Recurring expense"}</span>
                  <span className="block text-xs text-muted-foreground">{format(parseISO(date), "EEE, MMM d")}</span>
                </span>
                <span className="w-28 shrink-0 text-right text-sm tabular-nums">{formatTHB(rule.amountSatang)}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
