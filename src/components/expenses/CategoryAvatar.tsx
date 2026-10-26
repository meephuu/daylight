import { getCategoryIcon } from "@/lib/categoryIcons";
import type { Category } from "@/lib/db/categories";
import { readableTextColor } from "@/lib/notes";
import { cn } from "@/lib/utils";

interface CategoryAvatarProps {
  category: Pick<Category, "color" | "icon" | "name">;
  className?: string;
}

/** A round badge in the category's colour with its icon inside. */
export function CategoryAvatar({ category, className }: CategoryAvatarProps) {
  const Icon = getCategoryIcon(category.icon);
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", className)}
      style={{ backgroundColor: category.color, color: readableTextColor(category.color) }}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}
