import { Link } from "react-router-dom";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Project } from "@/lib/db/projects";

export function ProjectProgressWidget({ projects }: { projects: Project[] }) {
  const active = projects.filter((project) => !project.archived);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project progress</CardTitle>
        <CardAction>
          <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
            Manage
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No projects yet. Create one on the Tasks page.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {active.map((project) => {
              const percent =
                project.totalTasks === 0
                  ? 0
                  : Math.round((project.doneTasks / project.totalTasks) * 100);
              return (
                <li key={project.id}>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {project.doneTasks}/{project.totalTasks} · {percent}%
                    </span>
                  </div>
                  <Progress value={percent} className="mt-2" />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
