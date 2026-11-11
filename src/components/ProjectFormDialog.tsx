import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ColorSwatches } from "@/components/ColorSwatches";
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
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import type { Project } from "@/lib/db/projects";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  description: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Project to edit; omit to create a new one. */
  project?: Project | null;
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
        </DialogHeader>
        <ProjectForm project={project ?? null} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ project, onDone }: { project: Project | null; onDone: () => void }) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name ?? "",
      color: project?.color ?? "#6366f1",
      description: project?.description ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    const input = { ...values, name: values.name.trim() };
    if (project) {
      await updateProject.mutateAsync({ id: project.id, input });
    } else {
      await createProject.mutateAsync(input);
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" autoFocus {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorSwatches value={field.value} onChange={field.onChange} allowCustom />}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" rows={3} {...register("description")} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {project ? "Save" : "Create project"}
        </Button>
      </DialogFooter>
    </form>
  );
}
