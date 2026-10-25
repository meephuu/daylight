import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  data: BarDatum[];
  /** Short text at the bar tip, e.g. "12.9K" or "1h 25m". */
  formatTip: (value: number) => string;
  /** Exact text in the hover tooltip; `share` is this bar's fraction of the total (0-1). */
  formatTooltip: (item: BarDatum, share: number) => string;
  /** Column headings for the screen-reader table: [label column, value column]. */
  tableHeaders: [string, string];
  tableCaption: string;
  emptyMessage: string;
}

const ROW_HEIGHT = 36;

/**
 * Part-to-whole across named items: horizontal bars, largest first, one hue (a single series
 * needs no legend). Values sit at the bar tip; the tooltip adds the exact amount and share.
 * Reference-palette blue via --viz-bar; thin 20px bars with a 4px rounded data end.
 */
export function HorizontalBarChart({
  data,
  formatTip,
  formatTooltip,
  tableHeaders,
  tableCaption,
  emptyMessage,
}: HorizontalBarChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <div style={{ height: data.length * ROW_HEIGHT + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
            barCategoryGap={8}
          >
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={112}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.5 }}
              content={({ active, label }) => {
                const item = data.find((candidate) => candidate.label === String(label));
                if (!active || !item) return null;
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="font-medium">{item.label}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-full" style={{ backgroundColor: "var(--viz-bar)" }} />
                      {formatTooltip(item, total === 0 ? 0 : item.value / total)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" fill="var(--viz-bar)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(value) => formatTip(Number(value))}
                style={{ fill: "var(--foreground)", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table view of the same data, for screen readers. */}
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th>{tableHeaders[0]}</th>
            <th>{tableHeaders[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{formatTooltip(item, total === 0 ? 0 : item.value / total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
