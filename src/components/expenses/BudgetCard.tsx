import { useState } from "react";
import { Pencil } from "lucide-react";
import { BudgetMeter } from "@/components/expenses/BudgetMeter";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveExpenseSettings, type ExpenseSettings } from "@/hooks/useExpenses";
import { CURRENCIES, formatMoney } from "@/lib/expenses";

interface BudgetCardProps {
  monthLabel: string;
  spent: number;
  settings: ExpenseSettings;
}

export function BudgetCard({ monthLabel, spent, settings }: BudgetCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Spent in {monthLabel}</p>
            <p className="mt-1 text-5xl font-semibold">{formatMoney(spent, settings.currency)}</p>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" />
              {settings.budget === null ? "Set budget" : "Edit budget"}
            </Button>
          )}
        </div>

        {editing ? (
          <BudgetForm settings={settings} onDone={() => setEditing(false)} />
        ) : settings.budget !== null ? (
          <BudgetMeter spent={spent} budget={settings.budget} currency={settings.currency} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No monthly budget set. Set one to see how much you have left.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BudgetForm({ settings, onDone }: { settings: ExpenseSettings; onDone: () => void }) {
  const save = useSaveExpenseSettings();
  const [budgetText, setBudgetText] = useState(settings.budget === null ? "" : String(settings.budget));
  const [currency, setCurrency] = useState(settings.currency);

  const trimmed = budgetText.trim().replace(",", ".");
  const parsed = trimmed === "" ? null : Number(trimmed);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed <= 0);

  async function submit() {
    if (invalid) return;
    await save.mutateAsync({ budget: parsed, currency });
    onDone();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="budget-amount">Monthly budget</Label>
        <Input
          id="budget-amount"
          inputMode="decimal"
          value={budgetText}
          onChange={(event) => setBudgetText(event.target.value)}
          placeholder="No budget"
          aria-invalid={invalid}
          className="w-40"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Currency</Label>
        <OptionSelect
          value={currency}
          onChange={setCurrency}
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={invalid || save.isPending}>
        Save
      </Button>
      <Button type="button" variant="outline" onClick={onDone}>
        Cancel
      </Button>
      {invalid && <p className="w-full text-xs text-destructive">Enter a positive number, or leave empty for no budget.</p>}
    </form>
  );
}
