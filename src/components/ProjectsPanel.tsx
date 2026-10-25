import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { ProjectFormDialog } from "@/components/ProjectFormDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  const setArchived = useSetProjectArchived();

  const visible = projects.filter((project) => showArchived || !project.archived);
  const archivedCount = projects.filter((project) => project.archived).length;

  function openForm(project: Project | null) {
    setEditing(project);
    setFormOpen(true);
  }

  function handleDelete(project: Project) {
    if (!window.confirm(`Delete project "${project.name}"? Its tasks are kept, without a project.`)) {
      return;
    }
    if (selectedId === project.id) onSelect(null);
    deleteProject.mutate(project.id);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => openForm(null)} aria-label="New project">
          <Plus className="size-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
          selectedId === null && "bg-accent font-medium",
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
                "group rounded-lg px-3 py-2 transition-colors hover:bg-accent",
                selectedId === project.id && "bg-accent",
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
                <Progress value={percent} className="flex-1" />
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
    </section>
  );
}
