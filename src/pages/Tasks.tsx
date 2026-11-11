import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { TaskItem } from "@/components/TaskItem";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { useConfirm } from "@/hooks/useConfirm";
import { useProjects } from "@/hooks/useProjects";
import { useDeleteTask, useSetTaskStatus, useTasks } from "@/hooks/useTasks";
import { isOverdue } from "@/lib/dates";
import type { Task } from "@/lib/db/tasks";
import { cn } from "@/lib/utils";
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
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  async function handleDelete(task: Task) {
    const confirmed = await confirm({
      title: "Delete task?",
      description: `“${task.title}” will be permanently deleted. This can’t be undone.`,
      confirmLabel: "Delete task",
    });
    if (confirmed) deleteTask.mutate(task.id);
  }

  const selectedProject = projectId === null ? undefined : projectsById.get(projectId);

  const overdueCount = useMemo(
    () => tasksForView(projectTasks, "upcoming").filter((task) => task.dueDate !== null && isOverdue(task.dueDate)).length,
    [projectTasks],
  );

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <PageHeader
        title={selectedProject ? selectedProject.name : "Tasks"}
        summary={
          <>
            {counts.upcoming} open
            {overdueCount > 0 && <span className="text-destructive"> · {overdueCount} overdue</span>} · {counts.done} done
            {selectedProject && <span className="text-foreground/60"> · in this project</span>}
          </>
        }
        actions={
          <>
            {VIEWS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                  view === value
                    ? "bg-white/85 text-foreground shadow-[inset_0_1px_0_var(--glass-edge)] dark:bg-white/[0.16]"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {label}
                <span className="text-xs tabular-nums opacity-70">{counts[value]}</span>
              </button>
            ))}
            <Button onClick={() => openForm(null)} className="ml-1">
              <Plus className="size-4" />
              New task
            </Button>
          </>
        }
      />

      <div className="flex gap-4">
        <aside className="w-56 shrink-0 self-start lg:w-64">
          <ProjectsPanel projects={projects} selectedId={projectId} onSelect={setProjectId} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <QuickAdd dueDate={null} projectId={projectId} focusSignal={quickAddSignal} />

          {tasksQuery.isError && (
            <p className="text-sm text-destructive">Could not load tasks: {String(tasksQuery.error)}</p>
          )}

          {sections.length === 0 && !tasksQuery.isPending && (
            <p className="pane px-6 py-10 text-center text-sm text-muted-foreground">{EMPTY_MESSAGES[view]}</p>
          )}

          {sections.map((section) => (
            <section key={section.key} className="flex flex-col gap-2">
              {section.title && (
                <h2 className="flex items-baseline gap-2 px-2 font-display text-[22px] font-semibold tracking-[-0.025em]">
                  <span className={cn(section.key === "overdue" && "text-destructive")}>{section.title}</span>
                  <span className="text-base font-medium text-foreground/50 tabular-nums">{section.tasks.length}</span>
                </h2>
              )}
              <ul className="pane flex flex-col p-2">
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
      </div>

      {confirmDialog}
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