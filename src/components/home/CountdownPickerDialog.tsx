import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_COUNTDOWN_TASKS, daysUntil } from "@/lib/countdown";
import { formatDueDateTime, todayString } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";

interface CountdownPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  projectsById: Map<number, Project>;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/** Tick up to three tasks to count down to. Only tasks with a due date can be chosen. */
export function CountdownPickerDialog({ open, onOpenChange, tasks, projectsById, selectedIds, onChange }: CountdownPickerDialogProps) {
  const today = todayString();
  const candidates = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate !== null && (task.status !== "done" || selectedIds.includes(task.id)))
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.id - b.id),
    [tasks, selectedIds],
  );
  const full = selectedIds.length >= MAX_COUNTDOWN_TASKS;

  function toggle(task: Task, checked: boolean) {
    onChange(checked ? [...selectedIds, task.id] : selectedIds.filter((id) => id !== task.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose tasks to count down to</DialogTitle>
          <DialogDescription>
            Pick up to {MAX_COUNTDOWN_TASKS}. {selectedIds.length} of {MAX_COUNTDOWN_TASKS} chosen. Only tasks with a due date are listed.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            No open tasks have a due date yet. Add one on the Tasks page.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {candidates.map((task) => {
              const checked = selectedIds.includes(task.id);
              const disabled = !checked && full;
              const project = task.projectId === null ? undefined : projectsById.get(task.projectId);
              const days = daysUntil(task.dueDate ?? today, today);
              return (
                <li key={task.id}>
                  <label
                    className={
                      "flex items-center gap-3 rounded-lg border px-3 py-2 " +
                      (disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent/50")
                    }
                  >
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(task, value === true)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {project && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />}
                        <span className="truncate text-sm font-medium">{task.title}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {task.dueDate && formatDueDateTime(task.dueDate, task.dueTime)}
                        {task.status === "done" ? " · done" : ""}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {days < 0 ? `${-days}d late` : days === 0 ? "today" : `${days}d`}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          {selectedIds.length > 0 && (
            <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => onChange([])}>
              Clear all
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
