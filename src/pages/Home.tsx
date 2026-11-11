import { useMemo } from "react";
import { CountdownPanel } from "@/components/home/CountdownPanel";
import { DayTimetable } from "@/components/home/DayTimetable";
import { HabitStreakWidget } from "@/components/home/HabitStreakWidget";
import { NextUpCard } from "@/components/home/NextUpCard";
import { ProjectProgressWidget } from "@/components/home/ProjectProgressWidget";
import { SpentThisMonthWidget } from "@/components/home/SpentThisMonthWidget";
import { TaskListWidget } from "@/components/home/TaskListWidget";
import { TodayTrainingWidget } from "@/components/home/TodayTrainingWidget";
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

  const todaySummary = [
    overdue.length > 0 ? `${overdue.length} overdue` : null,
    `${today.length} due today`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <DayTimetable title={greeting.title} message={greeting.message} />
        </div>
        <div className="lg:col-span-4">
          <NextUpCard nextDeadline={upcoming[0]} />
        </div>
      </div>

      {(tasksQuery.isError || projectsQuery.isError) && (
        <p className="glass rounded-xl px-4 py-3 text-sm text-destructive">
          Could not load data: {String(tasksQuery.error ?? projectsQuery.error)}
        </p>
      )}

      {/* The day's other rituals, right under the day itself. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <HabitStreakWidget />
        <TodayTrainingWidget />
        <SpentThisMonthWidget />
      </div>

      <CountdownPanel tasks={tasks} projectsById={projectsById} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TaskListWidget
          title="Today's tasks"
          summary={todaySummary}
          // Overdue tasks are shown first so nothing slips by unnoticed.
          tasks={[...overdue, ...today]}
          projectsById={projectsById}
          onToggle={handleToggle}
          showDate
          emptyMessage="Nothing due today. Enjoy the free time."
        />
        <TaskListWidget
          title="Upcoming deadlines"
          summary={`${upcoming.length} in the next ${UPCOMING_DAYS} days`}
          tasks={upcoming}
          projectsById={projectsById}
          onToggle={handleToggle}
          showDate
          emptyMessage={`Nothing due in the next ${UPCOMING_DAYS} days.`}
        />
      </div>

      <ProjectProgressWidget projects={projects} />
    </div>
  );
}
