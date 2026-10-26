import { Check } from "lucide-react";
import type { Category } from "@/lib/db/categories";
import { cn } from "@/lib/utils";

interface CategoryChipsProps {
  categories: Category[];
  value: number | null;
  onChange: (categoryId: number) => void;
  className?: string;
}

/** Pick one category: a chip per category, each with its own colour. */
export function CategoryChips({ categories, value, onChange, className }: CategoryChipsProps) {
  return (
    <div role="radiogroup" aria-label="Category" className={cn("flex flex-wrap gap-1.5", className)}>
      {categories.map((category) => {
        const selected = category.id === value;
        return (
          <button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors outline-none",
              "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "font-medium text-foreground" : "text-muted-foreground",
            )}
            style={
              selected
                ? { borderColor: category.color, backgroundColor: `color-mix(in srgb, ${category.color} 22%, transparent)` }
                : undefined
            }
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            {category.name}
            {selected && <Check className="size-3.5" />}
          </button>
        );
      })}
    </div>
  );
}
