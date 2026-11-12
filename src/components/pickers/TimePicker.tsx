import { useLayoutEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { PICKER_TRIGGER_CLASS } from "@/components/pickers/pickerStyles";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  id?: string;
  /** "HH:MM" (24-hour), or "" for no time. */
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  placeholder?: string;
  invalid?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
/** Used when only one half has been picked so far. */
const FALLBACK_HOUR = 9;

const pad = (n: number) => String(n).padStart(2, "0");

function split(value: string): { hour: number | null; minute: number | null } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : { hour: null, minute: null };
}

/** Keeps the highlighted entry centred in its scrolling column without scrolling the dialog. */
function centerInColumn(element: HTMLElement | null) {
  const column = element?.parentElement;
  if (!element || !column) return;
  column.scrollTop = element.offsetTop - column.clientHeight / 2 + element.clientHeight / 2;
}

/** The list is drawn three times; the middle copy is the real one, the others make the loop seamless. */
const COPIES = [0, 1, 2] as const;
const MIDDLE = 1;

interface ColumnProps {
  label: string;
  values: number[];
  selected: number | null;
  onPick: (value: number) => void;
}

/**
 * A scrolling column that loops: after the last value comes the first again (… 22, 23, 00, 01 …).
 * Whenever the scroll drifts out of the middle copy, it jumps by exactly one copy's height, which
 * looks identical, so the list never runs out in either direction.
 */
function Column({ label, values, selected, onPick }: ColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);

  // With nothing picked yet, start at the top of the middle copy (00).
  useLayoutEffect(() => {
    const column = columnRef.current;
    if (column && selected === null) column.scrollTop = copyHeight(column, values.length);
    // Only on opening; a later pick centres itself.
  }, []);

  function handleScroll() {
    const column = columnRef.current;
    if (!column) return;
    const height = copyHeight(column, values.length);
    if (height <= 0) return;
    if (column.scrollTop < height * 0.5) column.scrollTop += height;
    else if (column.scrollTop > height * 1.5) column.scrollTop -= height;
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div
        ref={columnRef}
        onScroll={handleScroll}
        className="no-scrollbar relative flex h-48 w-14 flex-col gap-0.5 overflow-y-auto rounded-md border p-1"
      >
        {COPIES.map((copy) =>
          values.map((value) => {
            const isSelected = value === selected;
            const real = copy === MIDDLE;
            return (
              <button
                key={`${copy}-${value}`}
                type="button"
                ref={isSelected && real ? centerInColumn : undefined}
                onClick={() => onPick(value)}
                aria-pressed={real ? isSelected : undefined}
                aria-hidden={real ? undefined : true}
                tabIndex={real ? undefined : -1}
                className={cn(
                  "shrink-0 rounded-md py-1 text-sm tabular-nums transition-colors hover:bg-accent",
                  isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                )}
              >
                {pad(value)}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Distance from one copy of the list to the next (the first item of copy 1 minus that of copy 0). */
function copyHeight(column: HTMLElement, count: number): number {
  const first = column.children[0] as HTMLElement | undefined;
  const next = column.children[count] as HTMLElement | undefined;
  return first && next ? next.offsetTop - first.offsetTop : 0;
}

/** Time field with scrolling hour and minute columns in the app's own style. */
export function TimePicker({
  id,
  value,
  onChange,
  clearable = true,
  placeholder = "Set time",
  invalid,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { hour, minute } = split(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger id={id} className={PICKER_TRIGGER_CLASS} aria-invalid={invalid}>
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <span className={cn("truncate tabular-nums", value === "" && "text-muted-foreground")}>
          {value === "" ? placeholder : value}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="flex gap-2">
          <Column
            label="Hour"
            values={HOURS}
            selected={hour}
            onPick={(next) => onChange(`${pad(next)}:${pad(minute ?? 0)}`)}
          />
          <Column
            label="Min"
            values={MINUTES}
            selected={minute}
            onPick={(next) => onChange(`${pad(hour ?? FALLBACK_HOUR)}:${pad(next)}`)}
          />
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          {clearable && value !== "" ? (
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
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
