import { useState } from "react";
import { PlanCard } from "@/components/training/PlanCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateWorkouts, useReplaceWorkouts, useWorkouts } from "@/hooks/useWorkouts";
import { WORKOUT_TEMPLATES, type WorkoutTemplate } from "@/lib/training";

interface PlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "add" | "replace";

export function PlansDialog({ open, onOpenChange }: PlansDialogProps) {
  const [mode, setMode] = useState<Mode>("add");
  const existing = useWorkouts().data ?? [];
  const createWorkouts = useCreateWorkouts();
  const replaceWorkouts = useReplaceWorkouts();

  const hasPlan = existing.length > 0;
  const replacing = hasPlan && mode === "replace";
  const busy = createWorkouts.isPending || replaceWorkouts.isPending;
  const count = `${existing.length} workout${existing.length === 1 ? "" : "s"}`;

  async function apply(template: WorkoutTemplate) {
    if (
      replacing &&
      !window.confirm(
        `Replace your current plan (${count}) with "${template.name}"? The old workouts and their completion history will be deleted.`,
      )
    ) {
      return;
    }
    if (replacing) await replaceWorkouts.mutateAsync(template.workouts);
    else await createWorkouts.mutateAsync(template.workouts);
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
                ? "The plan's workouts are added next to the ones you already have."
                : `Your ${count} and their history are removed first.`}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {WORKOUT_TEMPLATES.map((template) => (
            <PlanCard key={template.id} template={template} onSelect={(chosen) => void apply(chosen)} disabled={busy} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
