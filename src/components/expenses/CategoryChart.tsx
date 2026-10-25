import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { formatCompact, formatMoney, type CategoryTotal } from "@/lib/expenses";

interface CategoryChartProps {
  data: CategoryTotal[];
  currency: string;
}

export function CategoryChart({ data, currency }: CategoryChartProps) {
  return (
    <HorizontalBarChart
      data={data.map((item) => ({ label: item.category, value: item.total }))}
      formatTip={formatCompact}
      formatTooltip={(item, share) => `${formatMoney(item.value, currency)} · ${Math.round(share * 100)}%`}
      tableHeaders={["Category", "Amount"]}
      tableCaption="Spending by category"
      emptyMessage="No expenses this month."
    />
  );
}
