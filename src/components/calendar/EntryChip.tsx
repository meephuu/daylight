import { Bell, Repeat } from "lucide-react";
import { readableTextColor } from "@/lib/notes";
import type { ScheduleEntry } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface EntryChipProps {
  entry: ScheduleEntry;
  className?: string;
}

/**
 * One chip design for tasks, events and reminders; only the colours differ.
 * - Left border: the entry's own colour (a task's priority, an event's or reminder's chosen colour).
 * - Background: a task's project colour; everything else (and tasks without a project) is the quiet grey.
 */
export function EntryChip({ entry, className }: EntryChipProps) {
  const repeats = entry.occurrence !== undefined && entry.occurrence.item.repeatRule !== "none";
  const projectColor = entry.kind === "task" ? entry.projectColor : null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 truncate rounded-sm border-l-[3px] px-1.5 py-0.5 text-[11px]",
        projectColor === null && "bg-muted/50 text-muted-foreground",
        entry.done && "line-through opacity-50",
        className,
      )}
      style={{
        borderLeftColor: entry.color,
        ...(projectColor === null ? {} : { backgroundColor: projectColor, color: readableTextColor(projectColor) }),
      }}
      title={entry.title}
    >
      {entry.kind === "reminder" && <Bell className="size-3 shrink-0" />}
      {entry.startTime && <span className="shrink-0 tabular-nums">{entry.startTime}</span>}
      <span className="truncate">{entry.title}</span>
      {repeats && <Repeat className="ml-auto size-3 shrink-0" aria-label="Repeats" />}
    </div>
  );
}
