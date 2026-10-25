import { useMemo } from "react";
import { OptionSelect } from "@/components/OptionSelect";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useFocusTimer } from "@/lib/focusTimer";

const NONE = "none";

/** Choose what the next focus session counts towards. Locked while a session is in progress. */
export function FocusTargetPicker() {
  const taskId = useFocusTimer((state) => state.taskId);
  const projectId = useFocusTimer((state) => state.projectId);
  const status = useFocusTimer((state) => state.status);
  const phase = useFocusTimer((state) => state.phase);
  const tasksQuery = useTasks();
  const projectsQuery = useProjects();

  const locked = phase === "focus" && status !== "idle";

  const openTasks = useMemo(
    () =>
      (tasksQuery.data ?? [])
        .filter((task) => task.status !== "done" || task.id === taskId)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [tasksQuery.data, taskId],
  );
  const projects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) => !project.archived || project.id === projectId),
    [projectsQuery.data, projectId],
  );

  function chooseTask(value: string) {
    if (value === NONE) {
      useFocusTimer.getState().setTarget(null, projectId);
      return;
    }
    const task = openTasks.find((candidate) => String(candidate.id) === value);
    // A task brings its own project along; the project can still be changed afterwards.
    useFocusTimer.getState().setTarget(task?.id ?? null, task?.projectId ?? projectId);
  }

  function chooseProject(value: string) {
    useFocusTimer.getState().setTarget(taskId, value === NONE ? null : Number(value));
  }

  return (
    <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label>Task</Label>
        <OptionSelect
          value={taskId === null ? NONE : String(taskId)}
          onChange={chooseTask}
          options={[
            { value: NONE, label: "No task" },
            ...openTasks.map((task) => ({ value: String(task.id), label: task.title })),
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Project</Label>
        <OptionSelect
          value={projectId === null ? NONE : String(projectId)}
          onChange={chooseProject}
          options={[
            { value: NONE, label: "No project" },
            ...projects.map((project) => ({ value: String(project.id), label: project.name })),
          ]}
        />
      </div>
    </fieldset>
  );
}
