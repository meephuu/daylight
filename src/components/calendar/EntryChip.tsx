import { Bell, Repeat } from "lucide-react";
import { readableTextColor } from "@/lib/notes";
import type { ScheduleEntry } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface EntryChipProps {
  entry: ScheduleEntry;
  className?: string;
}

/**
 * Tasks are the thing to act on, so they get a solid chip in their priority colour. Events and
 * reminders are background information: a quiet grey chip with just a coloured edge.
 */
export function EntryChip({ entry, className }: EntryChipProps) {
  const repeats = entry.occurrence !== undefined && entry.occurrence.item.repeatRule !== "none";

  if (entry.kind === "task") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-xs font-semibold shadow-sm",
          entry.done && "line-through opacity-50",
          className,
        )}
        style={{ backgroundColor: entry.color, color: readableTextColor(entry.color) }}
        title={entry.title}
      >
        {entry.startTime && <span className="shrink-0 tabular-nums opacity-80">{entry.startTime}</span>}
        <span className="truncate">{entry.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 truncate rounded-sm border-l-[3px] bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground",
        entry.done && "line-through opacity-50",
        className,
      )}
      style={{ borderLeftColor: entry.color }}
      title={entry.title}
    >
      {entry.kind === "reminder" && <Bell className="size-3 shrink-0" />}
      {entry.startTime && <span className="shrink-0 tabular-nums">{entry.startTime}</span>}
      <span className="truncate">{entry.title}</span>
      {repeats && <Repeat className="ml-auto size-3 shrink-0" aria-label="Repeats" />}
    </div>
  );
}
