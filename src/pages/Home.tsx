import { useMemo } from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CalendarDays } from "lucide-react";
import { HabitStreakWidget } from "@/components/home/HabitStreakWidget";
import { ProjectProgressWidget } from "@/components/home/ProjectProgressWidget";
import { SpentThisMonthWidget } from "@/components/home/SpentThisMonthWidget";
import { StatCard } from "@/components/home/StatCard";
import { TaskListWidget } from "@/components/home/TaskListWidget";
import { useProjects } from "@/hooks/useProjects";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import type { Task } from "@/lib/db/tasks";
import { dueTodayTasks, overdueTasks, upcomingWithin } from "@/lib/taskViews";

const UPCOMING_DAYS = 7;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const setStatus = useSetTaskStatus();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const overdue = useMemo(() => overdueTasks(tasks), [tasks]);
  const today = useMemo(() => dueTodayTasks(tasks), [tasks]);
  const upcoming = useMemo(() => upcomingWithin(tasks, UPCOMING_DAYS), [tasks]);

  function handleToggle(task: Task) {
    setStatus.mutate({ id: task.id, status: "done" });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{greeting()}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
      </header>

      {(tasksQuery.isError || projectsQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load data: {String(tasksQuery.error ?? projectsQuery.error)}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Overdue"
          value={overdue.length}
          icon={AlertTriangle}
          accent={overdue.length > 0 ? "text-red-500" : undefined}
        />
        <StatCard label="Due today" value={today.length} icon={CalendarDays} />
        <StatCard label={`Next ${UPCOMING_DAYS} days`} value={upcoming.length} icon={CalendarClock} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TaskListWidget
          title="Today's tasks"
          // Overdue tasks are shown first so nothing slips by unnoticed.
          tasks={[...overdue, ...today]}
          projectsById={projectsById}
          onToggle={handleToggle}
          showDate
          emptyMessage="Nothing due today. Enjoy the free time!"
        />
        <TaskListWidget
          title="Upcoming deadlines"
          tasks={upcoming}
          projectsById={projectsById}
          onToggle={handleToggle}
          showDate
          emptyMessage={`Nothing due in the next ${UPCOMING_DAYS} days.`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HabitStreakWidget />
        <SpentThisMonthWidget />
      </div>

      <ProjectProgressWidget projects={projects} />
    </div>
  );
}
