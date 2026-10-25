import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveSettings } from "@/hooks/useSettings";
import { TIMER_SETTING_KEYS, useTimerConfig } from "@/hooks/useTimerConfig";
import type { TimerConfig } from "@/lib/focusTimer";

const FIELDS: { key: keyof TimerConfig; label: string; max: number }[] = [
  { key: "focusMinutes", label: "Focus (min)", max: 240 },
  { key: "shortBreakMinutes", label: "Short break (min)", max: 120 },
  { key: "longBreakMinutes", label: "Long break (min)", max: 120 },
  { key: "sessionsUntilLongBreak", label: "Sessions before long break", max: 12 },
];

export function TimerSettings() {
  const config = useTimerConfig();
  const save = useSaveSettings();
  // Local edits are keyed by field; fields not edited show the saved value.
  const [edits, setEdits] = useState<Partial<Record<keyof TimerConfig, string>>>({});

  const parsed = FIELDS.map((field) => {
    const text = edits[field.key] ?? String(config[field.key]);
    const value = Number(text);
    const valid = /^\d+$/.test(text.trim()) && value >= 1 && value <= field.max;
    return { ...field, text, value, valid };
  });
  const allValid = parsed.every((field) => field.valid);
  const dirty = Object.keys(edits).length > 0;

  async function handleSave() {
    if (!allValid) return;
    const values: Record<string, string> = {};
    for (const field of parsed) values[TIMER_SETTING_KEYS[field.key]] = String(field.value);
    await save.mutateAsync(values);
    setEdits({});
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {parsed.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`timer-${field.key}`}>{field.label}</Label>
            <Input
              id={`timer-${field.key}`}
              inputMode="numeric"
              value={field.text}
              onChange={(event) => setEdits((current) => ({ ...current, [field.key]: event.target.value }))}
              aria-invalid={!field.valid}
            />
            {!field.valid && <p className="text-xs text-destructive">1 to {field.max}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!dirty || !allValid || save.isPending}>
          Save
        </Button>
        {dirty && (
          <Button type="button" variant="ghost" onClick={() => setEdits({})}>
            Cancel
          </Button>
        )}
        <p className="text-xs text-muted-foreground">New lengths apply to the next phase you start.</p>
      </div>
    </form>
  );
}
