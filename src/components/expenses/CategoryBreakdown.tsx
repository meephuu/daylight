import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/HorizontalBarChart";
import { BudgetBar } from "@/components/expenses/BudgetBar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryBudgetRow, CategoryTotal } from "@/lib/expenses";
import { formatCompactBaht, formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";

type View = "bars" | "donut";

interface CategoryBreakdownProps {
  data: CategoryTotal[];
  budgets: CategoryBudgetRow[];
  /** Category currently filtering the transaction list. */
  selectedId: number | null;
  /** Called with a category id to filter by it, or null when the selected one is clicked again. */
  onSelect: (categoryId: number | null) => void;
}

/** More bars than this and the smallest ones are folded into one grey "More categories" bar. */
const MAX_BARS = 12;
const MORE_COLOR = "#9CA3AF";

function toBars(data: CategoryTotal[]): BarDatum[] {
  const bars = data.map((item) => ({
    label: item.category.name,
    value: item.totalSatang,
    color: item.category.color,
    id: item.category.id,
  }));
  if (bars.length <= MAX_BARS) return bars;
  const head = bars.slice(0, MAX_BARS - 1);
  const rest = bars.slice(MAX_BARS - 1).reduce((sum, bar) => sum + bar.value, 0);
  return [...head, { label: "More categories", value: rest, color: MORE_COLOR }];
}

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function CategoryBreakdown({ data, budgets, selectedId, onSelect }: CategoryBreakdownProps) {
  const [view, setView] = useState<View>("bars");
  const total = data.reduce((sum, item) => sum + item.totalSatang, 0);
  const selected = data.find((item) => item.category.id === selectedId) ?? null;

  function toggle(categoryId: number) {
    onSelect(categoryId === selectedId ? null : categoryId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by category</CardTitle>
        <CardAction>
          <div role="group" aria-label="Chart type" className="flex rounded-lg border p-0.5 text-xs">
            {(["bars", "donut"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md px-2.5 py-1 capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {view === "bars" ? (
          <HorizontalBarChart
            data={toBars(data)}
            formatTip={formatCompactBaht}
            formatTooltip={(item, share) => `${formatTHB(item.value)} · ${Math.round(share * 100)}%`}
            tableHeaders={["Category", "Amount"]}
            tableCaption="Spending by category"
            emptyMessage="No expenses this month."
            onSelect={(item) => item.id !== undefined && toggle(item.id)}
            selectedLabel={selected?.category.name ?? null}
          />
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No expenses this month.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="relative size-52 shrink-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.map((item) => ({ id: item.category.id, name: item.category.name, value: item.totalSatang }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={96}
                    paddingAngle={data.length > 1 ? 1 : 0}
                    stroke="var(--card)"
                    isAnimationActive={false}
                    cursor="pointer"
                    onClick={(_, index) => {
                      const item = data[index];
                      if (item) toggle(item.category.id);
                    }}
                  >
                    {data.map((item) => (
                      <Cell
                        key={item.category.id}
                        fill={item.category.color}
                        fillOpacity={selectedId === null || selectedId === item.category.id ? 1 : 0.3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const entry = payload?.[0];
                      if (!active || !entry) return null;
                      const value = Number(entry.value);
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium">{String(entry.name)}</p>
                          <p className="text-muted-foreground">
                            {formatTHB(value)} · {percent(value, total)}%
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-sm font-semibold tabular-nums">{formatTHB(total)}</span>
              </div>
            </div>

            <ul className="flex min-w-56 flex-1 flex-col gap-0.5">
              {data.map((item) => {
                const isSelected = item.category.id === selectedId;
                return (
                  <li key={item.category.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(item.category.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                        isSelected && "bg-accent",
                      )}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.category.color }} />
                      <span className="min-w-0 flex-1 truncate">{item.category.name}</span>
                      <span className="tabular-nums text-muted-foreground">{percent(item.totalSatang, total)}%</span>
                      <span className="w-28 text-right tabular-nums">{formatTHB(item.totalSatang)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {data.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selected
              ? `Showing only ${selected.category.name} in the list below. Click it again to clear.`
              : "Click a category to show only its transactions."}
          </p>
        )}

        {budgets.length > 0 && (
          <section aria-label="Category budgets" className="flex flex-col gap-3 border-t pt-4">
            <h3 className="text-sm font-medium">Category budgets</h3>
            {budgets.map((row) => (
              <BudgetBar key={row.category.id} row={row} />
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
