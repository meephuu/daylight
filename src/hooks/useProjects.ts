import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  deleteProject,
  listProjects,
  setProjectArchived,
  updateProject,
  type ProjectInput,
} from "@/lib/db/projects";
import { PROJECTS_KEY, TASKS_KEY } from "@/hooks/useTasks";

export function useProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: listProjects });
}

function useProjectMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Deleting a project changes tasks' project_id, so refresh both.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
        queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
      ]),
  });
}

export function useCreateProject() {
  return useProjectMutation((input: ProjectInput) => createProject(input));
}

export function useUpdateProject() {
  return useProjectMutation(({ id, input }: { id: number; input: ProjectInput }) =>
    updateProject(id, input),
  );
}

export function useSetProjectArchived() {
  return useProjectMutation(({ id, archived }: { id: number; archived: boolean }) =>
    setProjectArchived(id, archived),
  );
}

export function useDeleteProject() {
  return useProjectMutation((id: number) => deleteProject(id));
}
