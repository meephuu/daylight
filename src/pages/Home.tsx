import { useMemo } from "react";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CalendarDays } from "lucide-react";
import { CountdownPanel } from "@/components/home/CountdownPanel";
import { DayTimetable } from "@/components/home/DayTimetable";
import { HabitStreakWidget } from "@/components/home/HabitStreakWidget";
import { ProjectProgressWidget } from "@/components/home/ProjectProgressWidget";
import { TodayTrainingWidget } from "@/components/home/TodayTrainingWidget";
import { SpentThisMonthWidget } from "@/components/home/SpentThisMonthWidget";
import { StatCard } from "@/components/home/StatCard";
import { TaskListWidget } from "@/components/home/TaskListWidget";
import { useProjects } from "@/hooks/useProjects";
import { useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import type { Task } from "@/lib/db/tasks";
import { useGreeting } from "@/lib/greetings";
import { dueTodayTasks, overdueTasks, upcomingWithin } from "@/lib/taskViews";

const UPCOMING_DAYS = 30;

export default function HomePage() {
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const setStatus = useSetTaskStatus();
  const greeting = useGreeting();

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
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-2xl font-semibold">{greeting.title}</h1>
          <p className="text-muted-foreground">{greeting.message}</p>
        </div>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
      </header>

      <DayTimetable />

      <CountdownPanel tasks={tasks} projectsById={projectsById} />

      {(tasksQuery.isError || projectsQuery.isError) && (
        <p className="text-sm text-destructive">
          Could not load data: {String(tasksQuery.error ?? projectsQuery.error)}
        </p>
      )}

      {/* Two tall lists on the left, three stat cards stacked on the right (equal thirds of the height). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        <div className="grid grid-cols-3 gap-4 lg:flex lg:flex-col">
          <StatCard
            label="Overdue"
            value={overdue.length}
            icon={AlertTriangle}
            accent={overdue.length > 0 ? "text-red-500" : undefined}
            className="lg:flex-1"
          />
          <StatCard label="Due today" value={today.length} icon={CalendarDays} className="lg:flex-1" />
          <StatCard
            label={`Next ${UPCOMING_DAYS} days`}
            value={upcoming.length}
            icon={CalendarClock}
            className="lg:flex-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HabitStreakWidget />
        <TodayTrainingWidget />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpentThisMonthWidget />
        <ProjectProgressWidget projects={projects} />
      </div>
    </div>
  );
}
