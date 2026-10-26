import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ColorSwatches } from "@/components/ColorSwatches";
import { CategoryAvatar } from "@/components/expenses/CategoryAvatar";
import { IconPicker } from "@/components/expenses/IconPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCategory, useUpdateCategory } from "@/hooks/useCategories";
import { ACCENT_COLORS, HEX_COLOR_PATTERN } from "@/lib/colors";
import type { Category } from "@/lib/db/categories";
import { parseBahtToSatang, satangToInput } from "@/lib/money";

const DEFAULT_ICON = "Tag";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "At most 40 characters"),
  color: z.string().regex(HEX_COLOR_PATTERN, "Pick a colour"),
  icon: z.string(),
  budget: z
    .string()
    .refine((value) => value.trim() === "" || parseBahtToSatang(value) !== null, "Enter an amount like 1500 or 1,500.50"),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category to edit; omit to create a new one. */
  category?: Category | null;
  /** All categories, to refuse a name that is already taken. */
  existing: Category[];
}

export function CategoryFormDialog({ open, onOpenChange, category, existing }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <CategoryForm category={category ?? null} existing={existing} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

interface CategoryFormProps {
  category: Category | null;
  existing: Category[];
  onDone: () => void;
}

function CategoryForm({ category, existing, onDone }: CategoryFormProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    register,
    control,
    watch,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      color: category?.color ?? ACCENT_COLORS[5]?.value ?? "#3b82f6",
      icon: category?.icon ?? DEFAULT_ICON,
      budget: category?.monthlyBudgetSatang == null ? "" : satangToInput(category.monthlyBudgetSatang),
    },
  });

  const preview = watch();

  async function onSubmit(values: FormValues) {
    const name = values.name.trim();
    const taken = existing.some(
      (other) => other.id !== category?.id && other.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) {
      setError("name", { message: "A category with this name already exists" });
      return;
    }
    const input = {
      name,
      color: values.color,
      icon: values.icon === "" ? null : values.icon,
      monthlyBudgetSatang: values.budget.trim() === "" ? null : parseBahtToSatang(values.budget),
    };
    if (category) await updateCategory.mutateAsync({ id: category.id, input });
    else await createCategory.mutateAsync(input);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
        <CategoryAvatar category={{ color: preview.color, icon: preview.icon, name: preview.name }} className="size-10" />
        <span className="truncate text-sm font-medium">{preview.name.trim() || "Category name"}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">Name</Label>
        <Input id="category-name" autoFocus maxLength={40} {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <Controller
          control={control}
          name="color"
          render={({ field }) => <ColorSwatches value={field.value} onChange={field.onChange} allowCustom />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Icon</Label>
        <Controller
          control={control}
          name="icon"
          render={({ field }) => <IconPicker value={field.value} onChange={field.onChange} />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-budget">Monthly budget (optional)</Label>
        <Input id="category-budget" inputMode="decimal" placeholder="THB 0.00" {...register("budget")} />
        {errors.budget && <p className="text-xs text-destructive">{errors.budget.message}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {category ? "Save" : "Add category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
