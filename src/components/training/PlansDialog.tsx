import { useState } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { PlanCard } from "@/components/training/PlanCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateWorkouts, useReplaceWorkouts, useWorkouts } from "@/hooks/useWorkouts";
import { WORKOUT_TEMPLATES, workoutsForWeek, type WorkoutTemplate } from "@/lib/training";

interface PlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The week being viewed: a plan is applied from this week onward. */
  weekStart: string;
}

type Mode = "add" | "replace";

export function PlansDialog({ open, onOpenChange, weekStart }: PlansDialogProps) {
  const [mode, setMode] = useState<Mode>("add");
  const allWorkouts = useWorkouts().data;
  const existing = workoutsForWeek(allWorkouts ?? [], weekStart);
  const createWorkouts = useCreateWorkouts();
  const replaceWorkouts = useReplaceWorkouts();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const hasPlan = existing.length > 0;
  const replacing = hasPlan && mode === "replace";
  const busy = createWorkouts.isPending || replaceWorkouts.isPending;
  const count = `${existing.length} workout${existing.length === 1 ? "" : "s"}`;

  async function apply(template: WorkoutTemplate) {
    if (replacing) {
      const confirmed = await confirm({
        title: "Replace your current plan?",
        description: `Your current plan (${count}) will be replaced with “${template.name}” from this week onward. Earlier weeks keep their workouts and completion history.`,
        confirmLabel: "Replace plan",
      });
      if (!confirmed) return;
    }
    if (replacing) await replaceWorkouts.mutateAsync({ inputs: template.workouts, weekStart });
    else await createWorkouts.mutateAsync({ inputs: template.workouts, weekStart });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Starter plans</DialogTitle>
          <DialogDescription>
            Pick a week to start from. You can change any workout or exercise afterwards.
          </DialogDescription>
        </DialogHeader>

        {hasPlan && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "add" ? "default" : "outline"}
                aria-pressed={mode === "add"}
                onClick={() => setMode("add")}
              >
                Add to my plan
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "replace" ? "default" : "outline"}
                aria-pressed={mode === "replace"}
                onClick={() => setMode("replace")}
              >
                Replace my plan
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "add"
                ? "The plan's workouts are added from this week onward, next to the ones you already have."
                : `Your ${count} are replaced from this week onward. Earlier weeks are not changed.`}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {WORKOUT_TEMPLATES.map((template) => (
            <PlanCard key={template.id} template={template} onSelect={(chosen) => void apply(chosen)} disabled={busy} />
          ))}
        </div>
        {confirmDialog}
      </DialogContent>
    </Dialog>
  );
}
