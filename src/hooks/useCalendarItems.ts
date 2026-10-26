import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCalendarItem,
  deleteCalendarItem,
  listCalendarItems,
  listOccurrenceStates,
  moveCalendarItem,
  setOccurrenceState,
  updateCalendarItem,
  type CalendarItem,
  type CalendarItemInput,
  type OccurrenceState,
  type OccurrenceStateRow,
} from "@/lib/db/calendarItems";

export const CALENDAR_ITEMS_KEY = ["calendarItems"] as const;
export const OCCURRENCE_STATES_KEY = ["occurrenceStates"] as const;

export function useCalendarItems() {
  return useQuery({ queryKey: CALENDAR_ITEMS_KEY, queryFn: listCalendarItems });
}

export function useOccurrenceStates() {
  return useQuery({ queryKey: OCCURRENCE_STATES_KEY, queryFn: listOccurrenceStates });
}

function useItemMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CALENDAR_ITEMS_KEY }),
        queryClient.invalidateQueries({ queryKey: OCCURRENCE_STATES_KEY }),
      ]),
  });
}

export function useCreateCalendarItem() {
  return useItemMutation((input: CalendarItemInput) => createCalendarItem(input));
}

export function useUpdateCalendarItem() {
  return useItemMutation(({ id, input }: { id: number; input: CalendarItemInput }) =>
    updateCalendarItem(id, input),
  );
}

export function useDeleteCalendarItem() {
  return useItemMutation((id: number) => deleteCalendarItem(id));
}

/** Optimistic: a one-off item jumps to its new day straight away (drag-and-drop). */
export function useMoveCalendarItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, startDate }: { id: number; startDate: string }) => moveCalendarItem(id, startDate),
    onMutate: async ({ id, startDate }) => {
      await queryClient.cancelQueries({ queryKey: CALENDAR_ITEMS_KEY });
      const previous = queryClient.getQueryData<CalendarItem[]>(CALENDAR_ITEMS_KEY);
      queryClient.setQueryData<CalendarItem[]>(CALENDAR_ITEMS_KEY, (items) =>
        items?.map((item) => (item.id === id ? { ...item, startDate } : item)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(CALENDAR_ITEMS_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CALENDAR_ITEMS_KEY }),
  });
}

/** Tick a reminder off for one day, skip one day of a series, or clear either (`state: null`). */
export function useSetOccurrenceState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { itemId: number; date: string; state: OccurrenceState | null }) =>
      setOccurrenceState(variables.itemId, variables.date, variables.state),
    onMutate: async ({ itemId, date, state }) => {
      await queryClient.cancelQueries({ queryKey: OCCURRENCE_STATES_KEY });
      const previous = queryClient.getQueryData<OccurrenceStateRow[]>(OCCURRENCE_STATES_KEY);
      queryClient.setQueryData<OccurrenceStateRow[]>(OCCURRENCE_STATES_KEY, (rows) => {
        const rest = (rows ?? []).filter((row) => !(row.itemId === itemId && row.date === date));
        return state === null ? rest : [...rest, { itemId, date, state }];
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(OCCURRENCE_STATES_KEY, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: OCCURRENCE_STATES_KEY }),
  });
}
