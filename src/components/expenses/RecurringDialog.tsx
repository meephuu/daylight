import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { z } from "zod";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CategoryChips } from "@/components/expenses/CategoryChips";
import { PaymentMethodChips } from "@/components/expenses/PaymentMethodChips";
import { OptionSelect } from "@/components/OptionSelect";
import { DatePicker } from "@/components/pickers/DatePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurring,
  useSetRecurringActive,
  useUpdateRecurring,
} from "@/hooks/useRecurring";
import { bangkokToday } from "@/lib/bangkok";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import type { RecurringExpense } from "@/lib/db/recurring";
import { formatTHB, parseBahtToSatang, satangToInput } from "@/lib/money";
import { describeSchedule, nextDueDate } from "@/lib/recurring";
import { cn } from "@/lib/utils";

interface RecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The list of recurring expenses, with pause / edit / delete and a form to add one. */
export function RecurringDialog({ open, onOpenChange }: RecurringDialogProps) {
  const rulesQuery = useRecurring();
  const categoriesQuery = useCategories();
  const setActive = useSetRecurringActive();
  const remove = useDeleteRecurring();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null);

  const rules = rulesQuery.data ?? [];
  const categoriesById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((category) => [category.id, category])),
    [categoriesQuery.data],
  );
  const today = bangkokToday();

  function openForm(rule: RecurringExpense | null) {
    setEditing(rule);
    setFormOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Recurring expenses</DialogTitle>
          <DialogDescription>
            Bills and subscriptions that repeat. Each time one falls due it appears as “waiting for confirmation” and
            only counts once you confirm it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="size-4" />
            New recurring expense
          </Button>
        </div>

        {rules.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nothing yet. Add rent, a subscription or a weekly payment.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rules.map((rule) => {
              const category = categoriesById.get(rule.categoryId);
              const next = rule.active ? nextDueDate(rule, today) : null;
              return (
                <li key={rule.id} className={cn("flex items-center gap-2 rounded-lg border bg-card py-2 pr-2 pl-3", !rule.active && "opacity-60")}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? "#9CA3AF" }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{rule.note || category?.name || "Recurring expense"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {describeSchedule(rule, WEEKDAY_LABELS)} · {category?.name ?? "Unknown category"}
                      {!rule.active ? " · Paused" : next ? ` · Next ${format(parseISO(next), "MMM d")}` : ""}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">{formatTHB(rule.amountSatang)}</span>
                  <Switch
                    size="sm"
                    checked={rule.active}
                    onCheckedChange={(checked) => setActive.mutate({ id: rule.id, active: checked })}
                    aria-label={rule.active ? `Pause ${rule.note || category?.name}` : `Resume ${rule.note || category?.name}`}
                  />
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${rule.note || category?.name}`} onClick={() => openForm(rule)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${rule.note || category?.name}`} onClick={() => setDeleting(rule)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Rendered inside this dialog so using them never counts as clicking outside it. */}
        <RecurringFormDialog open={formOpen} onOpenChange={setFormOpen} rule={editing} />
        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(next) => !next && setDeleting(null)}
          title="Delete this recurring expense?"
          description="Entries it already created stay where they are. No new ones will be created."
          confirmLabel="Delete"
          onConfirm={() => deleting && remove.mutate(deleting.id)}
        />
      </DialogContent>
    </Dialog>
  );
}

const formSchema = z
  .object({
    amount: z.string().refine((value) => {
      const satang = parseBahtToSatang(value);
      return satang !== null && satang > 0;
    }, "Enter an amount like 590 or 1,250.50"),
    categoryId: z.number({ message: "Pick a category" }),
    paymentMethodId: z.number().nullable(),
    note: z.string(),
    frequency: z.enum(["monthly", "weekly"]),
    dayOfMonth: z.number().int().min(1).max(31),
    weekday: z.number().int().min(0).max(6),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  });

type FormValues = z.infer<typeof formSchema>;

interface RecurringFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: RecurringExpense | null;
}

function RecurringFormDialog({ open, onOpenChange, rule }: RecurringFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit recurring expense" : "New recurring expense"}</DialogTitle>
        </DialogHeader>
        <RecurringForm rule={rule} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));

function RecurringForm({ rule, onDone }: { rule: RecurringExpense | null; onDone: () => void }) {
  const categoriesQuery = useCategories();
  const methodsQuery = usePaymentMethods();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();

  const categories = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => !category.archived || category.id === rule?.categoryId),
    [categoriesQuery.data, rule?.categoryId],
  );
  const methods = useMemo(
    () => (methodsQuery.data ?? []).filter((method) => !method.archived || method.id === rule?.paymentMethodId),
    [methodsQuery.data, rule?.paymentMethodId],
  );
  const today = bangkokToday();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: rule ? satangToInput(rule.amountSatang) : "",
      categoryId: rule?.categoryId ?? categories[0]?.id,
      paymentMethodId: rule?.paymentMethodId ?? null,
      note: rule?.note ?? "",
      frequency: rule?.frequency ?? "monthly",
      dayOfMonth: rule?.dayOfMonth ?? Number(today.slice(8, 10)),
      weekday: rule?.weekday ?? 1,
      startDate: rule?.startDate ?? today,
    },
  });

  const frequency = watch("frequency");

  async function onSubmit(values: FormValues) {
    const amountSatang = parseBahtToSatang(values.amount);
    if (amountSatang === null) return;
    const input = {
      amountSatang,
      categoryId: values.categoryId,
      paymentMethodId: values.paymentMethodId,
      note: values.note.trim(),
      frequency: values.frequency,
      dayOfMonth: values.frequency === "monthly" ? values.dayOfMonth : null,
      weekday: values.frequency === "weekly" ? values.weekday : null,
      startDate: values.startDate,
    };
    if (rule) await update.mutateAsync({ id: rule.id, input });
    else await create.mutateAsync(input);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurring-amount">Amount (THB)</Label>
          <Input id="recurring-amount" inputMode="decimal" autoFocus autoComplete="off" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurring-note">Name / note</Label>
          <Input id="recurring-note" autoComplete="off" placeholder="e.g. Rent, Netflix" {...register("note")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => <CategoryChips categories={categories} value={field.value ?? null} onChange={field.onChange} />}
        />
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Payment method</Label>
        <Controller
          control={control}
          name="paymentMethodId"
          render={({ field }) => <PaymentMethodChips methods={methods} value={field.value} onChange={field.onChange} />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Repeats</Label>
        <Controller
          control={control}
          name="frequency"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Repeats" className="flex w-fit rounded-lg border p-0.5 text-sm">
              {(["monthly", "weekly"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={field.value === option}
                  onClick={() => field.onChange(option)}
                  className={cn(
                    "rounded-md px-3 py-1 capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    field.value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {frequency === "monthly" ? (
          <div className="flex flex-col gap-1.5">
            <Label>Day of the month</Label>
            <Controller
              control={control}
              name="dayOfMonth"
              render={({ field }) => (
                <OptionSelect value={String(field.value)} onChange={(value) => field.onChange(Number(value))} options={DAY_OPTIONS} />
              )}
            />
            <p className="text-xs text-muted-foreground">Shorter months use their last day.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>Day of the week</Label>
            <Controller
              control={control}
              name="weekday"
              render={({ field }) => (
                <OptionSelect
                  value={String(field.value)}
                  onChange={(value) => field.onChange(Number(value))}
                  options={WEEKDAY_LABELS.map((label, index) => ({ value: String(index), label }))}
                />
              )}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurring-start">Starts</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker id="recurring-start" value={field.value} onChange={field.onChange} clearable={false} invalid={Boolean(errors.startDate)} />
            )}
          />
          <p className="text-xs text-muted-foreground">Earlier dates are added as waiting entries.</p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Repeat className="size-4" />
          {rule ? "Save" : "Add recurring expense"}
        </Button>
      </DialogFooter>
    </form>
  );
}
