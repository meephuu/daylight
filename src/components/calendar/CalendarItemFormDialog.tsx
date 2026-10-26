import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseISO } from "date-fns";
import { SkipForward, Trash2 } from "lucide-react";
import { z } from "zod";
import { OptionSelect } from "@/components/OptionSelect";
import { ColorSwatches } from "@/components/ColorSwatches";
import { DatePicker } from "@/components/pickers/DatePicker";
import { TimePicker } from "@/components/pickers/TimePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCalendarItem,
  useDeleteCalendarItem,
  useSetOccurrenceState,
  useUpdateCalendarItem,
} from "@/hooks/useCalendarItems";
import { DEFAULT_EVENT_COLOR, REPEAT_LABELS } from "@/lib/calendarItems";
import { todayString } from "@/lib/dates";
import {
  REPEAT_RULES,
  type CalendarItem,
  type CalendarItemInput,
  type ItemKind,
} from "@/lib/db/calendarItems";
import { DAY_SHORT } from "@/lib/training";
import { cn } from "@/lib/utils";

const TIME_PATTERN = /^(\d{2}:\d{2})?$/;
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})?$/;

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    startTime: z.string().regex(TIME_PATTERN, "Use HH:MM"),
    endTime: z.string().regex(TIME_PATTERN, "Use HH:MM"),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    repeatRule: z.enum(REPEAT_RULES),
    weekdays: z.array(z.number()),
    repeatUntil: z.string().regex(DATE_PATTERN, "Pick a date"),
    notes: z.string(),
  })
  .superRefine((values, context) => {
    if (values.endTime !== "" && values.startTime === "") {
      context.addIssue({ code: "custom", path: ["endTime"], message: "Set a start time first" });
    } else if (values.endTime !== "" && values.endTime <= values.startTime) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "Must be after the start" });
    }
    if (values.repeatRule !== "none" && values.repeatUntil !== "" && values.repeatUntil < values.startDate) {
      context.addIssue({ code: "custom", path: ["repeatUntil"], message: "Must be on or after the start date" });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const REPEAT_OPTIONS = REPEAT_RULES.map((rule) => ({ value: rule, label: REPEAT_LABELS[rule] }));

/** Weekday of a "YYYY-MM-DD" date: 0 = Sunday ... 6 = Saturday. */
function weekdayOf(date: string): number {
  return parseISO(date).getDay();
}

interface CalendarItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item to edit; omit to create a new one. */
  item?: CalendarItem | null;
  /** Kind of a new item (ignored when editing). */
  kind: ItemKind;
  /** Day preselected for a new item. */
  defaultDate?: string;
  /** The day that was clicked, so one occurrence of a repeating item can be skipped. */
  occurrenceDate?: string;
}

export function CalendarItemFormDialog({
  open,
  onOpenChange,
  item,
  kind,
  defaultDate,
  occurrenceDate,
}: CalendarItemFormDialogProps) {
  const shownKind = item?.kind ?? kind;
  const noun = shownKind === "event" ? "event" : "reminder";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Edit ${noun}` : `New ${noun}`}</DialogTitle>
        </DialogHeader>
        <ItemForm
          item={item ?? null}
          kind={shownKind}
          defaultDate={defaultDate ?? todayString()}
          occurrenceDate={occurrenceDate}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ItemFormProps {
  item: CalendarItem | null;
  kind: ItemKind;
  defaultDate: string;
  occurrenceDate?: string;
  onDone: () => void;
}

function ItemForm({ item, kind, defaultDate, occurrenceDate, onDone }: ItemFormProps) {
  const createItem = useCreateCalendarItem();
  const updateItem = useUpdateCalendarItem();
  const deleteItem = useDeleteCalendarItem();
  const setState = useSetOccurrenceState();

  const startDate = item?.startDate ?? defaultDate;
  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item?.title ?? "",
      startDate,
      startTime: item?.startTime ?? "",
      endTime: item?.endTime ?? "",
      color: item?.color ?? DEFAULT_EVENT_COLOR,
      repeatRule: item?.repeatRule ?? "none",
      weekdays: item && item.repeatWeekdays.length > 0 ? item.repeatWeekdays : [weekdayOf(startDate)],
      repeatUntil: item?.repeatUntil ?? "",
      notes: item?.notes ?? "",
    },
  });

  const repeatRule = watch("repeatRule");
  const repeating = repeatRule !== "none";
  const isRepeatingItem = item !== null && item.repeatRule !== "none";

  async function onSubmit(values: FormValues) {
    const input: CalendarItemInput = {
      kind,
      title: values.title.trim(),
      notes: values.notes.trim(),
      startDate: values.startDate,
      startTime: values.startTime === "" ? null : values.startTime,
      endTime: kind === "event" && values.endTime !== "" ? values.endTime : null,
      color: values.color,
      repeatRule: values.repeatRule,
      repeatWeekdays: values.repeatRule === "weekly" ? values.weekdays : [],
      repeatUntil: values.repeatRule !== "none" && values.repeatUntil !== "" ? values.repeatUntil : null,
    };
    if (item) await updateItem.mutateAsync({ id: item.id, input });
    else await createItem.mutateAsync(input);
    onDone();
  }

  async function handleDelete() {
    if (!item) return;
    const message = isRepeatingItem
      ? `Delete "${item.title}" and ALL of its repeats?`
      : `Delete "${item.title}"?`;
    if (!window.confirm(message)) return;
    await deleteItem.mutateAsync(item.id);
    onDone();
  }

  async function handleSkip() {
    if (!item || !occurrenceDate) return;
    await setState.mutateAsync({ itemId: item.id, date: occurrenceDate, state: "skipped" });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="item-title">Title</Label>
        <Input
          id="item-title"
          autoFocus
          placeholder={kind === "event" ? "e.g. Calculus lecture, Netflix" : "e.g. Submit report, Call mum"}
          {...register("title")}
        />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className={cn("grid gap-4", kind === "event" ? "grid-cols-3" : "grid-cols-2")}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-date">{repeating ? "Starts on" : "Date"}</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                id="item-date"
                value={field.value}
                onChange={field.onChange}
                clearable={false}
                invalid={Boolean(errors.startDate)}
              />
            )}
          />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="item-start">{kind === "event" ? "Start time" : "Time"}</Label>
          <Controller
            control={control}
            name="startTime"
            render={({ field }) => (
              <TimePicker
                id="item-start"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.startTime)}
              />
            )}
          />
        </div>
        {kind === "event" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-end">End time</Label>
            <Controller
            control={control}
            name="endTime"
            render={({ field }) => (
              <TimePicker
                id="item-end"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.endTime)}
              />
            )}
          />
            {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
          </div>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Leave the time empty for an all-day {kind}.</p>

      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorSwatches value={field.value} onChange={field.onChange} allowCustom />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Repeat</Label>
          <Controller
            control={control}
            name="repeatRule"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={REPEAT_OPTIONS}
              />
            )}
          />
        </div>
        {repeating && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-until">Until (optional)</Label>
            <Controller
            control={control}
            name="repeatUntil"
            render={({ field }) => (
              <DatePicker
                id="item-until"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.repeatUntil)}
              />
            )}
          />
            {errors.repeatUntil && <p className="text-xs text-destructive">{errors.repeatUntil.message}</p>}
          </div>
        )}
      </div>

      {repeatRule === "weekly" && (
        <div className="flex flex-col gap-1.5">
          <Label>On these days</Label>
          <Controller
            control={control}
            name="weekdays"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {DAY_SHORT.map((label, index) => {
                  const selected = field.value.includes(index);
                  return (
                    <Button
                      key={label}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      onClick={() =>
                        field.onChange(selected ? field.value.filter((day) => day !== index) : [...field.value, index])
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            )}
          />
          <p className="text-xs text-muted-foreground">With none selected it repeats on the start date's weekday.</p>
        </div>
      )}
      {repeatRule === "monthly" && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Repeats on the same day each month (the last day of shorter months).
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="item-notes">Notes</Label>
        <Textarea id="item-notes" rows={2} placeholder="Room, link, price…" {...register("notes")} />
      </div>

      {isRepeatingItem && <p className="text-xs text-muted-foreground">Changes apply to every repeat of this {kind}.</p>}

      <DialogFooter className="sm:justify-between">
        <div className="flex gap-1">
          {item && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => void handleDelete()}>
              <Trash2 className="size-4" />
              {isRepeatingItem ? "Delete all" : "Delete"}
            </Button>
          )}
          {isRepeatingItem && occurrenceDate && (
            <Button type="button" variant="ghost" onClick={() => void handleSkip()} title="Hide only this day, keep the rest">
              <SkipForward className="size-4" />
              Skip this day
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {item ? "Save" : `Add ${kind}`}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
