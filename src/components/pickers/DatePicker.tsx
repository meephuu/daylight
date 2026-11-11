import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { PICKER_TRIGGER_CLASS } from "@/components/pickers/pickerStyles";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toDateString } from "@/lib/dates";
import { WEEKDAY_LABELS } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  id?: string;
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Show a "Clear" button; turn off for fields that always need a date. */
  clearable?: boolean;
  placeholder?: string;
  invalid?: boolean;
}

function parseValue(value: string): Date | null {
  if (value === "") return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/** Date field with a month popover in the app's own style (replaces the browser's native picker). */
export function DatePicker({
  id,
  value,
  onChange,
  clearable = true,
  placeholder = "Pick a date",
  invalid,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseValue(value);
  const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));

  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  });

  function handleOpenChange(next: boolean) {
    // Reopen on the month of the current value, not wherever it was last browsed to.
    if (next) setMonth(startOfMonth(selected ?? new Date()));
    setOpen(next);
  }

  function choose(date: Date) {
    onChange(toDateString(date));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger id={id} className={PICKER_TRIGGER_CLASS} aria-invalid={invalid}>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? format(selected, isSameYear(selected, new Date()) ? "EEE, MMM d" : "EEE, MMM d, yyyy") : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">{format(month, "MMMM yyyy")}</span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="py-1 text-[11px] text-muted-foreground">
              {label.slice(0, 2)}
            </span>
          ))}
          {days.map((day) => {
            const isSelected = selected !== null && toDateString(day) === toDateString(selected);
            return (
              <button
                key={toDateString(day)}
                type="button"
                onClick={() => choose(day)}
                aria-label={format(day, "EEEE, MMMM d, yyyy")}
                aria-pressed={isSelected}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent",
                  !isSameMonth(day, month) && "text-muted-foreground/50",
                  isToday(day) && !isSelected && "font-semibold text-primary ring-1 ring-primary/50",
                  isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => choose(new Date())}>
            Today
          </Button>
          {clearable && value !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
