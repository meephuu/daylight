import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CompactTaskRow } from "@/components/home/CompactTaskRow";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project } from "@/lib/db/projects";
import type { Task } from "@/lib/db/tasks";

interface TaskListWidgetProps {
  title: string;
  /** A short count shown beside the title, e.g. "3 open" (the numbers live next to what they count). */
  summary?: ReactNode;
  tasks: Task[];
  projectsById: Map<number, Project>;
  onToggle: (task: Task) => void;
  emptyMessage: string;
  showDate?: boolean;
  /** Max rows shown; the rest is summarised as "+N more". */
  limit?: number;
}

export function TaskListWidget({
  title,
  summary,
  tasks,
  projectsById,
  onToggle,
  emptyMessage,
  showDate = false,
  limit = 7,
}: TaskListWidgetProps) {
  const shown = tasks.slice(0, limit);
  const hidden = tasks.length - shown.length;

  return (
    <Card className="h-full lg:min-h-72">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          {title}
          {summary && <span className="text-xs font-normal text-muted-foreground">{summary}</span>}
        </CardTitle>
        <CardAction>
          <Link to="/tasks" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {tasks.length === 0 ? (
          <p className="my-auto py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {shown.map((task) => (
              <CompactTaskRow
                key={task.id}
                task={task}
                project={task.projectId === null ? undefined : projectsById.get(task.projectId)}
                onToggle={onToggle}
                showDate={showDate}
              />
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <Link to="/tasks" className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            +{hidden} more
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
