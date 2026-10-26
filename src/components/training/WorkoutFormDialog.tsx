import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { OptionSelect } from "@/components/OptionSelect";
import { TimePicker } from "@/components/pickers/TimePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateWorkout, useDeleteWorkout, useUpdateWorkout } from "@/hooks/useWorkouts";
import { WORKOUT_CATEGORIES, type Workout, type WorkoutInput } from "@/lib/db/workouts";
import { CATEGORY_INFO, DAY_NAMES } from "@/lib/training";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  dayOfWeek: z.string(),
  startTime: z.string().regex(/^(\d{2}:\d{2})?$/, "Use HH:MM"),
  duration: z.string().regex(/^\d{0,3}$/, "Whole minutes"),
  category: z.enum(WORKOUT_CATEGORIES),
  notes: z.string(),
  exercises: z.array(
    z.object({
      name: z.string(),
      sets: z.string().regex(/^\d{0,3}$/, "Whole number"),
      reps: z.string(),
      weight: z.string().regex(/^(\d{1,4}([.,]\d{1,2})?)?$/, "Number"),
    }),
  ),
});

type FormValues = z.infer<typeof formSchema>;

const DAY_OPTIONS = DAY_NAMES.map((name, index) => ({ value: String(index), label: name }));
const CATEGORY_OPTIONS = WORKOUT_CATEGORIES.map((value) => ({ value, label: CATEGORY_INFO[value].label }));

interface WorkoutFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Workout to edit; omit to create a new one. */
  workout?: Workout | null;
  /** Day preselected for a new workout (0 = Sunday). */
  defaultDay?: number;
}

export function WorkoutFormDialog({ open, onOpenChange, workout, defaultDay }: WorkoutFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{workout ? "Edit workout" : "New workout"}</DialogTitle>
        </DialogHeader>
        <WorkoutForm workout={workout ?? null} defaultDay={defaultDay ?? 0} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface WorkoutFormProps {
  workout: Workout | null;
  defaultDay: number;
  onDone: () => void;
}

function WorkoutForm({ workout, defaultDay, onDone }: WorkoutFormProps) {
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: workout?.title ?? "",
      dayOfWeek: String(workout?.dayOfWeek ?? defaultDay),
      startTime: workout?.startTime ?? "",
      duration: workout?.durationMinutes === null || workout === null ? "" : String(workout.durationMinutes),
      category: workout?.category ?? "strength",
      notes: workout?.notes ?? "",
      exercises:
        workout?.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets === null ? "" : String(exercise.sets),
          reps: exercise.reps,
          weight: exercise.weight === null ? "" : String(exercise.weight),
        })) ?? [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "exercises" });

  async function onSubmit(values: FormValues) {
    const input: WorkoutInput = {
      title: values.title.trim(),
      dayOfWeek: Number(values.dayOfWeek),
      startTime: values.startTime === "" ? null : values.startTime,
      durationMinutes: values.duration === "" ? null : Number(values.duration),
      category: values.category,
      notes: values.notes.trim(),
      // Rows left without a name are ignored rather than rejected.
      exercises: values.exercises
        .filter((exercise) => exercise.name.trim() !== "")
        .map((exercise) => ({
          name: exercise.name.trim(),
          sets: exercise.sets === "" ? null : Number(exercise.sets),
          reps: exercise.reps.trim(),
          weight: exercise.weight === "" ? null : Number(exercise.weight.replace(",", ".")),
        })),
    };
    if (workout) await updateWorkout.mutateAsync({ id: workout.id, input });
    else await createWorkout.mutateAsync(input);
    onDone();
  }

  async function handleDelete() {
    if (!workout) return;
    if (!window.confirm(`Delete "${workout.title}" and its completion history?`)) return;
    await deleteWorkout.mutateAsync(workout.id);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workout-title">Title</Label>
        <Input id="workout-title" autoFocus placeholder="e.g. Push day, Long run" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Day</Label>
          <Controller
            control={control}
            name="dayOfWeek"
            render={({ field }) => (
              <OptionSelect value={field.value} onChange={field.onChange} options={DAY_OPTIONS} />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workout-time">Start time</Label>
          <Controller
            control={control}
            name="startTime"
            render={({ field }) => (
              <TimePicker
                id="workout-time"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="workout-duration">Minutes</Label>
          <Input id="workout-duration" inputMode="numeric" placeholder="60" {...register("duration")} />
          {errors.duration && <p className="text-xs text-destructive">{errors.duration.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={CATEGORY_OPTIONS}
              />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Exercises</Label>
        {fields.length > 0 && (
          <div className="grid grid-cols-[1fr_4rem_5.5rem_5rem_2rem] gap-2 px-0.5 text-xs text-muted-foreground">
            <span>Name</span>
            <span>Sets</span>
            <span>Reps</span>
            <span>kg</span>
            <span />
          </div>
        )}
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_4rem_5.5rem_5rem_2rem] items-start gap-2">
            <Input aria-label="Exercise name" placeholder="Bench Press" {...register(`exercises.${index}.name`)} />
            <Input aria-label="Sets" inputMode="numeric" placeholder="4" {...register(`exercises.${index}.sets`)} />
            <Input aria-label="Reps" placeholder="8-10" {...register(`exercises.${index}.reps`)} />
            <Input aria-label="Weight in kg" inputMode="decimal" placeholder="60" {...register(`exercises.${index}.weight`)} />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label="Remove exercise">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {errors.exercises && <p className="text-xs text-destructive">Check sets and weight: use plain numbers.</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => append({ name: "", sets: "", reps: "", weight: "" })}
        >
          <Plus className="size-4" />
          Add exercise
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="workout-notes">Notes</Label>
        <Textarea id="workout-notes" rows={2} placeholder="Warm-up, focus points, where to train…" {...register("notes")} />
      </div>

      <DialogFooter className="sm:justify-between">
        {workout ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => void handleDelete()}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {workout ? "Save" : "Add workout"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
