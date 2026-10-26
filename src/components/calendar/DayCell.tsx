import { useDraggable, useDroppable } from "@dnd-kit/core";
import { format, isSameMonth, isToday } from "date-fns";
import { EntryChip } from "@/components/calendar/EntryChip";
import type { CalendarMode } from "@/lib/calendar";
import { toDateString } from "@/lib/dates";
import type { ScheduleEntry } from "@/lib/schedule";
import { cn } from "@/lib/utils";

/** Entries shown per cell in month view before collapsing into "+N more". */
const MONTH_VISIBLE_ENTRIES = 3;

/** Lower = shown first when space runs out. */
const IMPORTANCE: Record<ScheduleEntry["kind"], number> = { task: 0, reminder: 1, event: 2 };

interface EntryButtonProps {
  entry: ScheduleEntry;
  onEdit: (entry: ScheduleEntry) => void;
}

/** Click opens the editor; the click must not fall through to the cell's "add" handler. */
function handleEditClick(event: React.MouseEvent, entry: ScheduleEntry, onEdit: (entry: ScheduleEntry) => void) {
  event.stopPropagation();
  onEdit(entry);
}

function DraggableEntry({ entry, onEdit }: EntryButtonProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.key,
    data: { entry },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(event) => handleEditClick(event, entry, onEdit)}
      className={cn("cursor-grab touch-none", isDragging && "opacity-30")}
    >
      <EntryChip entry={entry} />
    </div>
  );
}

/** One occurrence of a repeating item: edit it through the dialog; moving a single day makes no sense. */
function StaticEntry({ entry, onEdit }: EntryButtonProps) {
  return (
    <div onClick={(event) => handleEditClick(event, entry, onEdit)} className="cursor-pointer">
      <EntryChip entry={entry} />
    </div>
  );
}

interface DayCellProps {
  day: Date;
  /** Month being viewed; days outside it are dimmed (month view only). */
  cursor: Date;
  mode: CalendarMode;
  entries: ScheduleEntry[];
  onAdd: (date: string) => void;
  onEdit: (entry: ScheduleEntry) => void;
  onShowDay: (day: Date) => void;
}

export function DayCell({ day, cursor, mode, entries, onAdd, onEdit, onShowDay }: DayCellProps) {
  const date = toDateString(day);
  const { setNodeRef, isOver } = useDroppable({ id: date });

  const dimmed = mode === "month" && !isSameMonth(day, cursor);
  const isWeekday = day.getDay() >= 1 && day.getDay() <= 5;
  const limit = mode === "month" ? MONTH_VISIBLE_ENTRIES : entries.length;
  // When a day is too busy, "+N more" hides events and reminders before it hides tasks;
  // whatever stays visible keeps its time order.
  const keptKeys = new Set(
    [...entries]
      .sort((a, b) => IMPORTANCE[a.kind] - IMPORTANCE[b.kind])
      .slice(0, limit)
      .map((entry) => entry.key),
  );
  const shown = entries.filter((entry) => keptKeys.has(entry.key));
  const hidden = entries.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onAdd(date)}
      className={cn(
        "flex cursor-pointer flex-col gap-1 border-r border-b p-1.5 transition-colors hover:bg-accent/40",
        mode === "month" ? "min-h-28" : "min-h-80",
        // Weekdays are a touch darker than Saturday and Sunday, so the weekend stands out.
        isWeekday && "bg-black/[0.05] dark:bg-black/[0.18]",
        dimmed && "bg-muted/30 text-muted-foreground",
        isOver && "bg-accent",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center self-end rounded-full text-xs",
          isToday(day) && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {mode === "week" ? format(day, "d") : day.getDate()}
      </span>
      {shown.map((entry) =>
        entry.draggable ? (
          <DraggableEntry key={entry.key} entry={entry} onEdit={onEdit} />
        ) : (
          <StaticEntry key={entry.key} entry={entry} onEdit={onEdit} />
        ),
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShowDay(day);
          }}
          className="px-1 text-left text-xs text-muted-foreground hover:text-foreground"
        >
          +{hidden} more
        </button>
      )}
    </div>
  );
}
