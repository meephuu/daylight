import { Check } from "lucide-react";
import { NOTE_COLORS } from "@/lib/notes";
import { cn } from "@/lib/utils";

interface ColorSwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Also offer a free colour picker for any colour not in the palette. */
  allowCustom?: boolean;
  className?: string;
}

export function ColorSwatches({ value, onChange, allowCustom = false, className }: ColorSwatchesProps) {
  const isCustom = !NOTE_COLORS.some((color) => color.value.toLowerCase() === value.toLowerCase());
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {NOTE_COLORS.map((color) => {
        const selected = color.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(color.value)}
            title={color.name}
            aria-label={color.name}
            aria-pressed={selected}
            className="flex size-6 items-center justify-center rounded-full ring-1 ring-black/15 transition-transform hover:scale-110"
            style={{ backgroundColor: color.value }}
          >
            {selected && <Check className="size-3.5 text-stone-800" />}
          </button>
        );
      })}
      {allowCustom && (
        <label
          title="Custom colour"
          className={cn(
            "relative size-6 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/15",
            isCustom && "ring-2 ring-foreground",
          )}
          style={{
            background: isCustom
              ? value
              : "conic-gradient(#ef4444, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
          }}
        >
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Custom colour"
          />
        </label>
      )}
    </div>
  );
}
