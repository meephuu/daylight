import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { TaskItem } from "@/components/TaskItem";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjects } from "@/hooks/useProjects";
import { useDeleteTask, useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import type { Task } from "@/lib/db/tasks";
import {
  buildSections,
  filterByProject,
  tasksForView,
  type TaskView,
} from "@/lib/taskViews";

const VIEWS: { value: TaskView; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];

const EMPTY_MESSAGES: Record<TaskView, string> = {
  upcoming: "Nothing left to do. Enjoy the free time!",
  done: "Nothing completed yet.",
  all: "No tasks yet. Add one above.",
};

export default function TasksPage() {
  const location = useLocation();
  const quickAddSignal = (location.state as { quickAddSignal?: number } | null)?.quickAddSignal;
  const [view, setView] = useState<TaskView>("upcoming");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const tasksQuery = useTasks();
  const projectsQuery = useProjects();
  const setStatus = useSetTaskStatus();
  const deleteTask = useDeleteTask();

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const projectTasks = useMemo(() => filterByProject(tasks, projectId), [tasks, projectId]);
  const counts = useMemo(
    () => ({
      upcoming: tasksForView(projectTasks, "upcoming").length,
      done: tasksForView(projectTasks, "done").length,
      all: projectTasks.length,
    }),
    [projectTasks],
  );
  const sections = useMemo(
    () => buildSections(tasksForView(projectTasks, view), view),
    [projectTasks, view],
  );

  function openForm(task: Task | null) {
    setEditing(task);
    setFormOpen(true);
  }

  function handleToggle(task: Task) {
    setStatus.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" });
  }

  function handleDelete(task: Task) {
    if (window.confirm(`Delete task "${task.title}"?`)) deleteTask.mutate(task.id);
  }

  const selectedProject = projectId === null ? undefined : projectsById.get(projectId);

  return (
    <div className="mx-auto flex max-w-5xl gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            Tasks
            {selectedProject && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                in {selectedProject.name}
              </span>
            )}
          </h1>
          <Button onClick={() => openForm(null)}>
            <Plus className="size-4" />
            New task
          </Button>
        </div>

        <QuickAdd
          dueDate={null}
          projectId={projectId}
          focusSignal={quickAddSignal}
        />

        <Tabs value={view} onValueChange={(value) => setView(value as TaskView)}>
          <TabsList>
            {VIEWS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                <span className="ml-1.5 text-xs text-muted-foreground">{counts[value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tasksQuery.isError && (
          <p className="text-sm text-destructive">Could not load tasks: {String(tasksQuery.error)}</p>
        )}

        {sections.length === 0 && !tasksQuery.isPending && (
          <p className="py-8 text-center text-sm text-muted-foreground">{EMPTY_MESSAGES[view]}</p>
        )}

        {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-2">
            {section.title && (
              <h2 className="text-sm font-medium text-muted-foreground">
                {section.title} · {section.tasks.length}
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {section.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  project={task.projectId === null ? undefined : projectsById.get(task.projectId)}
                  onToggle={handleToggle}
                  onEdit={openForm}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="w-72 shrink-0">
        <ProjectsPanel projects={projects} selectedId={projectId} onSelect={setProjectId} />
      </aside>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editing}
        defaults={{ dueDate: null, projectId }}
        projects={projects}
      />
    </div>
  );
}
