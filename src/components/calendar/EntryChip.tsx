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
 * - Leading dot: the entry's own colour (a task's priority, an event's or reminder's chosen colour).
 * - Background: a task's project colour; everything else (and tasks without a project) sits on clear glass.
 */
export function EntryChip({ entry, className }: EntryChipProps) {
  const repeats = entry.occurrence !== undefined && entry.occurrence.item.repeatRule !== "none";
  const projectColor = entry.kind === "task" ? entry.projectColor : null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 truncate rounded-md px-1.5 py-[3px] text-[11px] font-medium",
        projectColor === null && "bg-foreground/[0.09] text-foreground/90",
        projectColor !== null && "shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]",
        entry.done && "line-through opacity-50",
        className,
      )}
      style={projectColor === null ? undefined : { backgroundColor: projectColor, color: readableTextColor(projectColor) }}
      title={entry.title}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full ring-1 ring-white/50"
        style={{ backgroundColor: entry.color }}
      />
      {entry.kind === "reminder" && <Bell className="size-3 shrink-0" />}
      {entry.startTime && <span className="shrink-0 tabular-nums opacity-85">{entry.startTime}</span>}
      <span className="truncate">{entry.title}</span>
      {repeats && <Repeat className="ml-auto size-3 shrink-0 opacity-70" aria-label="Repeats" />}
    </div>
  );
}
