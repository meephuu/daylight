import { format, parseISO } from "date-fns";
import { Bell, CalendarClock, CheckSquare, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EntryKind } from "@/lib/schedule";

const CHOICES: { kind: EntryKind; label: string; hint: string; icon: LucideIcon }[] = [
  { kind: "task", label: "Task", hint: "Something to get done by this day", icon: CheckSquare },
  { kind: "event", label: "Event", hint: "A class, meeting or subscription; can repeat", icon: CalendarClock },
  { kind: "reminder", label: "Reminder", hint: "Don't forget something; can repeat", icon: Bell },
];

interface AddToCalendarDialogProps {
  /** The day being added to ("YYYY-MM-DD"); the dialog is open while this is set. */
  date: string | null;
  onChoose: (kind: EntryKind, date: string) => void;
  onClose: () => void;
}

export function AddToCalendarDialog({ date, onChoose, onClose }: AddToCalendarDialogProps) {
  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {date ? format(parseISO(date), "EEEE, MMM d") : ""}</DialogTitle>
          <DialogDescription>What would you like to add?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {CHOICES.map(({ kind, label, hint, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => date && onChoose(kind, date)}
              className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
