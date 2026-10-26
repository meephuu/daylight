import { CATEGORY_ICON_NAMES, CATEGORY_ICONS } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

/** A grid of the available icons. */
export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-10 gap-1" role="group" aria-label="Icon">
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        if (!Icon) return null;
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selected}
            onClick={() => onChange(name)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md transition-colors outline-none",
              "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
