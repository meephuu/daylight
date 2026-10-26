import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyTotal } from "@/lib/expenses";
import { formatCompactBaht, formatTHB } from "@/lib/money";

interface DailySpendingChartProps {
  days: DailyTotal[];
  /** Monthly budget in satang; adds a dashed line at the daily amount that would exactly use it up. */
  budgetSatang: number | null;
}

export function DailySpendingChart({ days, budgetSatang }: DailySpendingChartProps) {
  const paceSatang = budgetSatang === null ? null : Math.round(budgetSatang / days.length);
  const hasSpending = days.some((day) => day.totalSatang > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily spending</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasSpending ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No expenses this month.</p>
        ) : (
          <>
            <div className="h-48" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={12}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis
                    width={48}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatCompactBaht(Number(value))}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      const day = payload?.[0]?.payload as DailyTotal | undefined;
                      if (!active || !day) return null;
                      return (
                        <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                          <p className="font-medium">{format(parseISO(day.date), "EEE, MMM d")}</p>
                          <p className="text-muted-foreground">{formatTHB(day.totalSatang)}</p>
                          {paceSatang !== null && (
                            <p className="text-muted-foreground">Daily pace {formatTHB(paceSatang)}</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  {paceSatang !== null && (
                    <ReferenceLine
                      y={paceSatang}
                      stroke="var(--viz-warning)"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      label={{ value: "Pace", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                  )}
                  <Bar dataKey="totalSatang" fill="var(--viz-bar)" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {paceSatang !== null && (
              <p className="mt-2 text-xs text-muted-foreground">
                The dashed line is the daily pace that fits your budget ({formatTHB(paceSatang)} a day).
              </p>
            )}

            {/* Table view of the same data, for screen readers. */}
            <table className="sr-only">
              <caption>Spending per day</caption>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .filter((day) => day.totalSatang > 0)
                  .map((day) => (
                    <tr key={day.date}>
                      <td>{format(parseISO(day.date), "EEEE, MMM d")}</td>
                      <td>{formatTHB(day.totalSatang)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
