import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTask, useUpdateTask } from "@/hooks/useTasks";
import type { Project } from "@/lib/db/projects";
import {
  normalizeTags,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskInput,
} from "@/lib/db/tasks";

const NO_PROJECT = "none";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  notes: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: z.string(), // "" or YYYY-MM-DD
  projectId: z.string(), // NO_PROJECT or a project id
  tags: z.string(), // comma-separated
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export interface TaskFormDefaults {
  dueDate?: string | null;
  projectId?: number | null;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Task to edit; omit to create a new one. */
  task?: Task | null;
  defaults?: TaskFormDefaults;
  projects: Project[];
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaults,
  projects,
}: TaskFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent unmounts when closed, so the form is re-initialised on every open. */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <TaskForm
          task={task ?? null}
          defaults={defaults}
          projects={projects}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface TaskFormProps {
  task: Task | null;
  defaults?: TaskFormDefaults;
  projects: Project[];
  onDone: () => void;
}

function TaskForm({ task, defaults, projects, onDone }: TaskFormProps) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title ?? "",
      notes: task?.notes ?? "",
      status: task?.status ?? "todo",
      priority: task?.priority ?? "medium",
      dueDate: task ? (task.dueDate ?? "") : (defaults?.dueDate ?? ""),
      projectId: String((task ? task.projectId : defaults?.projectId) ?? NO_PROJECT),
      tags: task?.tags.join(", ") ?? "",
    },
  });

  const projectOptions = [
    { value: NO_PROJECT, label: "No project" },
    ...projects
      .filter((project) => !project.archived || project.id === task?.projectId)
      .map((project) => ({ value: String(project.id), label: project.name })),
  ];

  async function onSubmit(values: FormValues) {
    const input: TaskInput = {
      title: values.title.trim(),
      notes: values.notes,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate === "" ? null : values.dueDate,
      projectId: values.projectId === NO_PROJECT ? null : Number(values.projectId),
      tags: normalizeTags(values.tags.split(",")),
    };
    if (task) {
      await updateTask.mutateAsync({ id: task.id, input });
    } else {
      await createTask.mutateAsync(input);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Title</Label>
        <Input id="task-title" autoFocus {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-notes">Notes</Label>
        <Textarea id="task-notes" rows={3} {...register("notes")} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={STATUS_OPTIONS}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Priority</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={PRIORITY_OPTIONS}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">Due date</Label>
          <Input id="task-due" type="date" {...register("dueDate")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Project</Label>
          <Controller
            control={control}
            name="projectId"
            render={({ field }) => (
              <OptionSelect
                value={field.value}
                onChange={(value) => field.onChange(value)}
                options={projectOptions}
              />
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-tags">Tags</Label>
        <Input id="task-tags" placeholder="work, urgent" {...register("tags")} />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {task ? "Save" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}
