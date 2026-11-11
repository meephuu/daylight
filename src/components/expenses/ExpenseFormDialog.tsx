import { useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { CategoryChips } from "@/components/expenses/CategoryChips";
import { PaymentMethodChips } from "@/components/expenses/PaymentMethodChips";
import { DatePicker } from "@/components/pickers/DatePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import { bangkokToday } from "@/lib/bangkok";
import type { Category } from "@/lib/db/categories";
import type { Expense } from "@/lib/db/expenses";
import type { PaymentMethod } from "@/lib/db/paymentMethods";
import { formatTHB, parseBahtToSatang, satangToInput } from "@/lib/money";

const formSchema = z.object({
  amount: z
    .string()
    .refine((value) => {
      const satang = parseBahtToSatang(value);
      return satang !== null && satang > 0;
    }, "Enter an amount like 80 or 1,250.50"),
  categoryId: z.number({ message: "Pick a category" }),
  paymentMethodId: z.number().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

/** Starting values for a new expense, e.g. when duplicating an existing one. */
export interface ExpensePrefill {
  amountSatang: number;
  categoryId: number;
  paymentMethodId: number | null;
  note: string;
  date: string;
}

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expense to edit; omit to create a new one. */
  expense?: Expense | null;
  /** Fills in a new expense (ignored when editing). */
  prefill?: ExpensePrefill | null;
  /** All categories (archived ones are only offered when the expense being edited already uses one). */
  categories: Category[];
  paymentMethods: PaymentMethod[];
  /** Date preselected for a new expense. */
  defaultDate?: string;
  /** Called when "Delete" is pressed while editing; the caller asks for confirmation. */
  onDelete?: (expense: Expense) => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  prefill,
  categories,
  paymentMethods,
  defaultDate,
  onDelete,
}: ExpenseFormDialogProps) {
  const title = expense ? (expense.status === "pending" ? "Confirm expense" : "Edit expense") : prefill ? "Duplicate expense" : "Add expense";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ExpenseForm
          expense={expense ?? null}
          prefill={prefill ?? null}
          categories={categories}
          paymentMethods={paymentMethods}
          defaultDate={defaultDate}
          onDelete={onDelete}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ExpenseFormProps {
  expense: Expense | null;
  prefill: ExpensePrefill | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  defaultDate?: string;
  onDelete?: (expense: Expense) => void;
  onDone: () => void;
}

function ExpenseForm({ expense, prefill, categories, paymentMethods, defaultDate, onDelete, onDone }: ExpenseFormProps) {
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const [savedNote, setSavedNote] = useState("");
  const saving = useRef(false);

  // Archived categories / payment methods stay out of the pickers, except the ones this expense already has.
  const categoryChoices = useMemo(
    () => categories.filter((category) => !category.archived || category.id === expense?.categoryId),
    [categories, expense?.categoryId],
  );
  const methodChoices = useMemo(
    () => paymentMethods.filter((method) => !method.archived || method.id === expense?.paymentMethodId),
    [paymentMethods, expense?.paymentMethodId],
  );

  const source = expense ?? prefill;
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: source ? satangToInput(source.amountSatang) : "",
      categoryId: source?.categoryId ?? categoryChoices[0]?.id,
      paymentMethodId: source?.paymentMethodId ?? null,
      date: source?.date ?? defaultDate ?? bangkokToday(),
      note: source?.note ?? "",
    },
  });

  /** Saves the form; with `another`, clears amount and note and stays open for the next entry. */
  async function save(values: FormValues, another: boolean) {
    const amountSatang = parseBahtToSatang(values.amount);
    if (amountSatang === null || saving.current) return;
    saving.current = true;
    try {
      const input = {
        amountSatang,
        categoryId: values.categoryId,
        paymentMethodId: values.paymentMethodId,
        date: values.date,
        note: values.note.trim(),
      };
      if (expense) await updateExpense.mutateAsync({ id: expense.id, input: { ...input, status: "confirmed" } });
      else await createExpense.mutateAsync(input);

      if (!another) {
        onDone();
        return;
      }
      const categoryName = categories.find((category) => category.id === values.categoryId)?.name ?? "";
      setSavedNote(`Saved ${formatTHB(amountSatang)} · ${categoryName}`);
      reset({ ...values, amount: "", note: "" });
      // After the re-render, so the browser keeps the focus on the field instead of the button that was pressed.
      window.setTimeout(() => document.getElementById("expense-amount")?.focus(), 0);
    } finally {
      saving.current = false;
    }
  }

  const submitAndClose = handleSubmit((values) => save(values, false));
  const submitAndAddAnother = handleSubmit((values) => save(values, true));
  const pending = expense?.status === "pending";

  return (
    <form
      onSubmit={(event) => void submitAndClose(event)}
      onKeyDown={(event) => {
        // Enter saves (the browser does that natively); Ctrl+Enter saves and keeps the form open.
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !expense) {
          event.preventDefault();
          void submitAndAddAnother();
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-amount">Amount (THB)</Label>
          <Input id="expense-amount" inputMode="decimal" autoFocus autoComplete="off" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DatePicker id="expense-date" value={field.value} onChange={field.onChange} clearable={false} invalid={Boolean(errors.date)} />
            )}
          />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => <CategoryChips categories={categoryChoices} value={field.value ?? null} onChange={field.onChange} />}
        />
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Payment method</Label>
        <Controller
          control={control}
          name="paymentMethodId"
          render={({ field }) => <PaymentMethodChips methods={methodChoices} value={field.value} onChange={field.onChange} />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-note">Note</Label>
        <Input id="expense-note" autoComplete="off" placeholder="Optional" {...register("note")} />
      </div>

      <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {savedNote}
      </p>

      <DialogFooter className="sm:items-center">
        {expense && onDelete && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive sm:mr-auto"
            onClick={() => {
              onDone();
              onDelete(expense);
            }}
          >
            <Trash2 className="size-4" />
            {pending ? "Skip this one" : "Delete"}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        {!expense && (
          <Button type="button" variant="secondary" onClick={() => void submitAndAddAnother()} title="Ctrl+Enter">
            Save &amp; add another
          </Button>
        )}
        <Button type="submit">{pending ? "Save & confirm" : expense ? "Save" : "Add expense"}</Button>
      </DialogFooter>
    </form>
  );
}
