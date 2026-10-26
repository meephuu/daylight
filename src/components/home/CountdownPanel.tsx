import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, Hourglass, ListChecks } from "lucide-react";
import { CountdownPickerDialog } from "@/components/home/CountdownPickerDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCountdownTasks } from "@/hooks/useCountdown";
import { countdownLabel, countdownTone, daysUntil, elapsedFraction, type CountdownTone } from "@/lib/countdown";
import { todayString } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";

interface CountdownPanelProps {
  tasks: Task[];
  projectsById: Map<number, Project>;
}

/** Colour of the big number: neutral while there is time, amber in the last days, red when late. */
const TONE_COLOR: Record<CountdownTone, string> = {
  later: "var(--foreground)",
  soon: "var(--viz-warning)",
  today: "var(--viz-warning)",
  overdue: "var(--viz-critical)",
};

/** Follows the calendar day while the app stays open, so a countdown ticks over at midnight. */
function useToday(): string {
  const [today, setToday] = useState(todayString);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

function CountdownTile({ task, project, today }: { task: Task; project: Project | undefined; today: string }) {
  const accent = project?.color ?? "var(--primary)";
  const done = task.status === "done";
  const dueDate = task.dueDate ?? today;
  const days = daysUntil(dueDate, today);
  const tone = countdownTone(days);
  const fraction = done ? 1 : elapsedFraction(task.createdAt, dueDate, today);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-stretch gap-4 p-4">
        <div
          className="flex w-28 shrink-0 flex-col items-center justify-center rounded-xl px-2 py-3 text-center"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)` }}
          aria-label={done ? "Completed" : `${Math.abs(days)} ${countdownLabel(days)}`}
        >
          {done ? (
            <>
              <CheckCircle2 className="size-10" style={{ color: accent }} />
              <span className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Done</span>
            </>
          ) : (
            <>
              <span className="text-5xl leading-none font-semibold tabular-nums" style={{ color: TONE_COLOR[tone] }}>
                {Math.abs(days)}
              </span>
              <span className="mt-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{countdownLabel(days)}</span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="line-clamp-2 text-base leading-snug font-medium break-words">{task.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            {format(parseISO(dueDate), "EEE, MMM d, yyyy")}
            {task.dueTime ? ` · ${task.dueTime}` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {project && (
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
                {project.name}
              </span>
            )}
            <span className="capitalize">{task.priority} priority</span>
          </div>
          {task.notes.trim() !== "" && <p className="line-clamp-1 text-xs text-muted-foreground/80">{task.notes}</p>}
        </div>
      </div>

      {/* How much of the time between adding the task and its deadline has passed. */}
      <div
        role="progressbar"
        aria-label="Time elapsed until the deadline"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="h-1.5 w-full"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
      >
        <div
          className={cn("h-full transition-all", fraction < 1 && "rounded-r-full")}
          style={{ width: `${fraction * 100}%`, backgroundColor: done ? accent : tone === "overdue" ? "var(--viz-critical)" : accent }}
        />
      </div>
    </Card>
  );
}

export function CountdownPanel({ tasks, projectsById }: CountdownPanelProps) {
  const { ids, setIds, isLoading } = useCountdownTasks();
  const [pickerOpen, setPickerOpen] = useState(false);
  const today = useToday();

  // Tasks that were deleted since are skipped; the soonest deadline comes first.
  const chosen = useMemo(
    () =>
      ids
        .map((id) => tasks.find((task) => task.id === id))
        .filter((task): task is Task => task !== undefined && task.dueDate !== null)
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.id - b.id),
    [ids, tasks],
  );

  if (isLoading) return null;

  return (
    <section aria-label="Countdown" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Hourglass className="size-4" />
          Countdown
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
          <ListChecks className="size-4" />
          {chosen.length === 0 ? "Choose tasks" : "Change"}
        </Button>
      </div>

      {chosen.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-8 text-center">
          <Hourglass className="size-8 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-medium">Count down to something that matters</p>
            <p className="text-sm text-muted-foreground">Pick a task and see how many days are left, right here.</p>
          </div>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            Choose tasks
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-4">
          {chosen.map((task) => (
            <CountdownTile
              key={task.id}
              task={task}
              project={task.projectId === null ? undefined : projectsById.get(task.projectId)}
              today={today}
            />
          ))}
        </div>
      )}

      <CountdownPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        tasks={tasks}
        projectsById={projectsById}
        selectedIds={ids}
        onChange={setIds}
      />
    </section>
  );
}
