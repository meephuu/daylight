import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateExpense, useUpdateExpense } from "@/hooks/useExpenses";
import { todayString } from "@/lib/dates";
import type { Expense } from "@/lib/db/expenses";

const formSchema = z.object({
  amount: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Enter an amount like 12.50")
    .refine((value) => Number(value.replace(",", ".")) > 0, "Must be more than 0"),
  category: z.string().trim().min(1, "Category is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expense to edit; omit to create a new one. */
  expense?: Expense | null;
  /** Suggestions for the category field (defaults plus categories already used). */
  categories: string[];
  /** Date preselected for a new expense. */
  defaultDate?: string;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  categories,
  defaultDate,
}: ExpenseFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>
        <ExpenseForm
          expense={expense ?? null}
          categories={categories}
          defaultDate={defaultDate}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ExpenseFormProps {
  expense: Expense | null;
  categories: string[];
  defaultDate?: string;
  onDone: () => void;
}

function ExpenseForm({ expense, categories, defaultDate, onDone }: ExpenseFormProps) {
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: expense ? String(expense.amount) : "",
      category: expense?.category ?? "",
      date: expense?.date ?? defaultDate ?? todayString(),
      note: expense?.note ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    const input = {
      amount: Number(values.amount.replace(",", ".")),
      category: values.category.trim(),
      date: values.date,
      note: values.note.trim(),
    };
    if (expense) {
      await updateExpense.mutateAsync({ id: expense.id, input });
    } else {
      await createExpense.mutateAsync(input);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input id="expense-amount" inputMode="decimal" autoFocus placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Date</Label>
          <Input id="expense-date" type="date" {...register("date")} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-category">Category</Label>
        <Input
          id="expense-category"
          list="expense-categories"
          placeholder="Pick one or type your own"
          autoComplete="off"
          {...register("category")}
        />
        <datalist id="expense-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-note">Note</Label>
        <Input id="expense-note" placeholder="Optional" {...register("note")} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {expense ? "Save" : "Add expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
