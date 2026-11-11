import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/useConfirm";
import { useDeleteProject, useSetProjectArchived } from "@/hooks/useProjects";
import type { Project } from "@/lib/db/projects";
import { cn } from "@/lib/utils";

interface ProjectsPanelProps {
  projects: Project[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

export function ProjectsPanel({ projects, selectedId, onSelect }: ProjectsPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const deleteProject = useDeleteProject();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const setArchived = useSetProjectArchived();

  const visible = projects.filter((project) => showArchived || !project.archived);
  const archivedCount = projects.filter((project) => project.archived).length;

  function openForm(project: Project | null) {
    setEditing(project);
    setFormOpen(true);
  }

  async function handleDelete(project: Project) {
    const confirmed = await confirm({
      title: "Delete project?",
      description: `“${project.name}” will be deleted. Its tasks are kept, just without a project.`,
      confirmLabel: "Delete project",
    });
    if (!confirmed) return;
    if (selectedId === project.id) onSelect(null);
    deleteProject.mutate(project.id);
  }

  return (
    <section className="pane flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <h2 className="px-2 pt-1 font-display text-[19px] font-semibold tracking-[-0.02em]">Projects</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => openForm(null)} aria-label="New project">
          <Plus className="size-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-2xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-foreground/[0.06]",
          selectedId === null && "bg-white/70 font-medium shadow-[inset_0_1px_0_var(--glass-edge)] dark:bg-white/[0.12]",
        )}
      >
        All projects
      </button>

      <ul className="flex flex-col gap-1">
        {visible.map((project) => {
          const percent =
            project.totalTasks === 0 ? 0 : Math.round((project.doneTasks / project.totalTasks) * 100);
          return (
            <li
              key={project.id}
              className={cn(
                "group rounded-2xl px-3 py-2.5 transition-colors hover:bg-foreground/[0.06]",
                selectedId === project.id && "bg-white/70 shadow-[inset_0_1px_0_var(--glass-edge)] dark:bg-white/[0.12]",
                project.archived && "opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate font-medium">{project.name}</span>
                </button>
                <span className="flex opacity-0 group-hover:opacity-100">
                  <Button variant="ghost" size="icon-xs" onClick={() => openForm(project)} aria-label="Edit project">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setArchived.mutate({ id: project.id, archived: !project.archived })}
                    aria-label={project.archived ? "Unarchive project" : "Archive project"}
                  >
                    {project.archived ? (
                      <ArchiveRestore className="size-3.5" />
                    ) : (
                      <Archive className="size-3.5" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(project)} aria-label="Delete project">
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-label={`${project.name} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="h-1.5 flex-1 overflow-hidden rounded-full"
                  style={{ backgroundColor: `color-mix(in srgb, ${project.color} 18%, transparent)` }}
                >
                  <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: project.color }} />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                  {project.doneTasks}/{project.totalTasks} · {percent}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {projects.length === 0 && (
        <p className="px-3 text-xs text-muted-foreground">No projects yet. Click + to create one.</p>
      )}
      {archivedCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((value) => !value)}>
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </Button>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />
      {confirmDialog}
    </section>
  );
}
