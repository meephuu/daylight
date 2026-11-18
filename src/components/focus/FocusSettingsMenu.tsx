import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFocusSettings } from "@/hooks/useFocus";
import { useSaveSettings } from "@/hooks/useSettings";
import { FOCUS_LIMITS, FOCUS_SETTING_KEYS, formatFocused, type FocusSettings } from "@/lib/focus";

const ROWS: { key: keyof FocusSettings; label: string; unit: (value: number) => string }[] = [
  { key: "focusMin", label: "Focus", unit: (value) => `${value} min` },
  { key: "breakMin", label: "Break", unit: (value) => `${value} min` },
  { key: "goalMin", label: "Daily goal", unit: (value) => formatFocused(value * 60) },
];

const STEP_BUTTON =
  "grid size-7 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30";

/** The timer's lengths and the daily goal, each a row with − and + (saved in the settings table). */
export function FocusSettingsMenu() {
  const settings = useFocusSettings();
  const save = useSaveSettings();
  const change = (key: keyof FocusSettings, direction: 1 | -1) => {
    const { min, max, step } = FOCUS_LIMITS[key];
    const next = Math.min(max, Math.max(min, settings[key] + direction * step));
    if (next !== settings[key]) save.mutate({ [FOCUS_SETTING_KEYS[key]]: String(next) });
  };

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Timer settings"
        title="Timer settings"
        className="grid size-9 place-items-center rounded-full text-foreground/75 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SlidersHorizontal className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[280px] gap-0 p-2">
        <p className="px-2 pt-1 pb-2 text-[13px] font-medium">Timer</p>
        <ul className="flex flex-col divide-y divide-foreground/10">
          {ROWS.map(({ key, label, unit }) => {
            const { min, max } = FOCUS_LIMITS[key];
            return (
              <li key={key} className="flex h-11 items-center gap-2 px-2">
                <span className="flex-1 text-sm">{label}</span>
                <button type="button" className={STEP_BUTTON} disabled={settings[key] <= min} onClick={() => change(key, -1)} aria-label={`Less ${label.toLowerCase()}`}>
                  <Minus className="size-3.5" />
                </button>
                <span className="w-[76px] text-center text-sm font-medium tabular-nums">{unit(settings[key])}</span>
                <button type="button" className={STEP_BUTTON} disabled={settings[key] >= max} onClick={() => change(key, 1)} aria-label={`More ${label.toLowerCase()}`}>
                  <Plus className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">A run already under way keeps its length.</p>
      </PopoverContent>
    </Popover>
  );
}
