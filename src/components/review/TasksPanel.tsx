import { format, parseISO } from "date-fns";
import { CalendarArrowUp } from "lucide-react";
import { ProgressRing } from "@/components/review/ProgressRing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetTaskDueDate } from "@/hooks/useTasks";
import { formatDueDate } from "@/lib/dates";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";
import { nextWeekDate, type WeekReport } from "@/lib/weekReport";

const LIST_LIMIT = 8;

function ProjectChip({ project }: { project: Project | undefined }) {
  if (!project) return null;
  return (
    <span
      className="inline-flex max-w-32 shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
      style={{ backgroundColor: `color-mix(in srgb, ${project.color} 18%, transparent)` }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

interface TasksPanelProps {
  report: WeekReport;
  today: string;
  projectsById: Map<number, Project>;
}

export function TasksPanel({ report, today, projectsById }: TasksPanelProps) {
  const setDueDate = useSetTaskDueDate();
  const { completed, slipped, dueTasks, dueTasksDone } = report;
  const ratio = dueTasks === 0 ? 0 : dueTasksDone / dueTasks;
  const project = (task: Task) => (task.projectId === null ? undefined : projectsById.get(task.projectId));

  function moveToNextWeek(task: Task) {
    if (task.dueDate === null) return;
    setDueDate.mutate({ id: task.id, dueDate: nextWeekDate(task.dueDate, report.range.start, today) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
        <div className="flex items-center gap-4 lg:flex-col lg:justify-center">
          <ProgressRing value={ratio} size={104} stroke={10} color="#34d399" label="Due tasks completed">
            <span className="text-xl leading-none font-semibold tabular-nums">{dueTasks === 0 ? "–" : `${dueTasksDone}/${dueTasks}`}</span>
            <span className="mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">due done</span>
          </ProgressRing>
          <p className="max-w-36 text-sm text-muted-foreground lg:text-center">
            {dueTasks === 0 ? "No task deadlines fell in this week yet." : `${completed.length} completed in total, including tasks without a deadline.`}
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">Completed · {completed.length}</h3>
          {completed.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nothing completed this week.</p>
          ) : (
            <ul className="divide-y">
              {completed.slice(0, LIST_LIMIT).map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <ProjectChip project={project(task)} />
                  <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                    {task.completedAt ? format(parseISO(task.completedAt), "EEE") : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {completed.length > LIST_LIMIT && <p className="mt-1 text-xs text-muted-foreground">+{completed.length - LIST_LIMIT} more</p>}
        </div>

        <div className="min-w-0">
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">Slipped · {slipped.length}</h3>
          {slipped.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nothing slipped. Every due date was met.</p>
          ) : (
            <ul className="divide-y">
              {slipped.slice(0, LIST_LIMIT).map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{task.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {task.dueDate ? formatDueDate(task.dueDate) : ""} · {task.status === "done" ? "done late" : "still open"}
                    </span>
                  </span>
                  <ProjectChip project={project(task)} />
                  {task.status !== "done" && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => moveToNextWeek(task)}
                      aria-label={`Move ${task.title} to next week`}
                      title="Move to next week"
                    >
                      <CalendarArrowUp className="size-3.5" />
                      Next week
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {slipped.length > LIST_LIMIT && <p className="mt-1 text-xs text-muted-foreground">+{slipped.length - LIST_LIMIT} more</p>}
        </div>
      </CardContent>
    </Card>
  );
}
