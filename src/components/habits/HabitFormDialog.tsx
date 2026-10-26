import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ColorSwatches } from "@/components/ColorSwatches";
import { OptionSelect } from "@/components/OptionSelect";
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
import { useCreateHabit, useUpdateHabit } from "@/hooks/useHabits";
import { HABIT_FREQUENCIES, type Habit } from "@/lib/db/habits";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  frequency: z.enum(HABIT_FREQUENCIES),
  target: z
    .string()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((value) => Number(value) >= 1 && Number(value) <= 99, "Between 1 and 99"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
});

type FormValues = z.infer<typeof formSchema>;

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Habit to edit; omit to create a new one. */
  habit?: Habit | null;
}

export function HabitFormDialog({ open, onOpenChange, habit }: HabitFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <HabitForm habit={habit ?? null} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function HabitForm({ habit, onDone }: { habit: Habit | null; onDone: () => void }) {
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: habit?.name ?? "",
      frequency: habit?.frequency ?? "daily",
      target: String(habit?.targetPerPeriod ?? 1),
      color: habit?.color ?? "#22c55e",
    },
  });

  const frequency = watch("frequency");

  async function onSubmit(values: FormValues) {
    const input = {
      name: values.name.trim(),
      frequency: values.frequency,
      targetPerPeriod: Number(values.target),
      color: values.color,
    };
    if (habit) {
      await updateHabit.mutateAsync({ id: habit.id, input });
    } else {
      await createHabit.mutateAsync(input);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="habit-name">Name</Label>
        <Input id="habit-name" autoFocus placeholder="e.g. Training" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorSwatches value={field.value} onChange={field.onChange} allowCustom />}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Frequency</Label>
          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={FREQUENCY_OPTIONS}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="habit-target">
            {frequency === "daily" ? "Times per day" : "Times per week"}
          </Label>
          <Input id="habit-target" inputMode="numeric" {...register("target")} />
          {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {habit ? "Save" : "Create habit"}
        </Button>
      </DialogFooter>
    </form>
  );
}
