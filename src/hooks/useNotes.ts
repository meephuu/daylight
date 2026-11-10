import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bringNoteToFront,
  createImageNote,
  createNote,
  deleteNote,
  getNoteImage,
  listNotes,
  moveNote,
  replaceNoteImage,
  resizeNote,
  setNoteColor,
  setNotePinned,
  updateNoteText,
  type NewImageNote,
  type NewNote,
  type Note,
} from "@/lib/db/notes";

export const NOTES_KEY = ["notes"] as const;

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: listNotes });
}

function nextZ(notes: Note[]): number {
  return notes.reduce((max, note) => Math.max(max, note.zIndex), 0) + 1;
}

/**
 * Board edits (move, resize, colour...) update the cache immediately so the note never
 * snaps back while the database write and refetch are in flight; rolled back on error.
 */
function useOptimisticNoteMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  patch: (notes: Note[], variables: TVariables) => Note[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const previous = queryClient.getQueryData<Note[]>(NOTES_KEY);
      queryClient.setQueryData<Note[]>(NOTES_KEY, (notes) =>
        notes ? patch(notes, variables) : notes,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(NOTES_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewNote) => createNote(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useCreateImageNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewImageNote) => createImageNote(input),
    onSuccess: (id, input) => {
      // The picture is already in hand, so the new note can show it without reading it back.
      queryClient.setQueryData(noteImageKey(id), input.data);
      return queryClient.invalidateQueries({ queryKey: NOTES_KEY });
    },
  });
}

export const noteImageKey = (id: number) => ["note-image", id] as const;

/** A picture note's image. It never changes except through a crop, so it is kept for good once read. */
export function useNoteImage(id: number, enabled = true) {
  return useQuery({ queryKey: noteImageKey(id), queryFn: () => getNoteImage(id), staleTime: Infinity, enabled });
}

/** A crop: new picture and new note size, shown at once and rolled back if saving fails. */
export function useReplaceNoteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, width, height }: { id: number; data: string; width: number; height: number }) =>
      replaceNoteImage(id, data, width, height),
    onMutate: async ({ id, data, width, height }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY });
      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEY);
      const previousImage = queryClient.getQueryData<string | null>(noteImageKey(id));
      queryClient.setQueryData(noteImageKey(id), data);
      queryClient.setQueryData<Note[]>(NOTES_KEY, (notes) =>
        notes?.map((note) => (note.id === id ? { ...note, width, height } : note)),
      );
      return { previousNotes, previousImage };
    },
    onError: (_error, { id }, context) => {
      if (context?.previousNotes) queryClient.setQueryData(NOTES_KEY, context.previousNotes);
      if (context?.previousImage !== undefined) queryClient.setQueryData(noteImageKey(id), context.previousImage);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

/** Text is typed into local state and saved on a debounce, so no optimistic patch is needed. */
export function useUpdateNoteText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: number; title: string; content: string }) =>
      updateNoteText(id, title, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useMoveNote() {
  return useOptimisticNoteMutation(
    ({ id, x, y }: { id: number; x: number; y: number }) => moveNote(id, x, y),
    (notes, { id, x, y }) => {
      const z = nextZ(notes);
      return notes.map((note) => (note.id === id ? { ...note, x, y, zIndex: z } : note));
    },
  );
}

export function useResizeNote() {
  return useOptimisticNoteMutation(
    ({ id, width, height }: { id: number; width: number; height: number }) =>
      resizeNote(id, width, height),
    (notes, { id, width, height }) =>
      notes.map((note) => (note.id === id ? { ...note, width, height } : note)),
  );
}

export function useSetNoteColor() {
  return useOptimisticNoteMutation(
    ({ id, color }: { id: number; color: string }) => setNoteColor(id, color),
    (notes, { id, color }) => notes.map((note) => (note.id === id ? { ...note, color } : note)),
  );
}

export function useSetNotePinned() {
  return useOptimisticNoteMutation(
    ({ id, pinned }: { id: number; pinned: boolean }) => setNotePinned(id, pinned),
    (notes, { id, pinned }) => notes.map((note) => (note.id === id ? { ...note, pinned } : note)),
  );
}

export function useBringNoteToFront() {
  return useOptimisticNoteMutation(
    (id: number) => bringNoteToFront(id),
    (notes, id) => {
      const z = nextZ(notes);
      return notes.map((note) => (note.id === id ? { ...note, zIndex: z } : note));
    },
  );
}

export function useDeleteNote() {
  return useOptimisticNoteMutation(
    (id: number) => deleteNote(id),
    (notes, id) => notes.filter((note) => note.id !== id),
  );
}
