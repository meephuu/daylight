import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { CategoryAvatar } from "@/components/expenses/CategoryAvatar";
import { CategoryFormDialog } from "@/components/expenses/CategoryFormDialog";
import { DeleteCategoryDialog } from "@/components/expenses/DeleteCategoryDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCategories, useReorderCategories, useSetCategoryArchived } from "@/hooks/useCategories";
import { useExpenses } from "@/hooks/useExpenses";
import { useRecurring } from "@/hooks/useRecurring";
import type { Category } from "@/lib/db/categories";
import { formatTHB } from "@/lib/money";
import { cn } from "@/lib/utils";

interface RowProps {
  category: Category;
  expenseCount: number;
  /** Move one place up (-1) or down (1); used by the arrow keys on the drag handle. */
  onMove: (category: Category, direction: -1 | 1) => void;
  onEdit: (category: Category) => void;
  onArchive: (category: Category) => void;
  onDelete: (category: Category) => void;
}

function SortableRow({ category, expenseCount, onMove, onEdit, onArchive, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-2 pl-1", isDragging && "z-10 shadow-lg")}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1.5 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        aria-label={`Reorder ${category.name}. Drag, or use the up and down arrow keys.`}
        {...attributes}
        {...listeners}
        // dnd-kit's own keyboard support listens on the document, where the dialog swallows arrow keys,
        // so the handle handles them itself.
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onMove(category, event.key === "ArrowUp" ? -1 : 1);
        }}
      >
        <GripVertical className="size-4" />
      </button>
      <CategoryAvatar category={category} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{category.name}</span>
          {category.isFallback && <Badge variant="secondary">Default</Badge>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {expenseCount} expense{expenseCount === 1 ? "" : "s"}
          {category.monthlyBudgetSatang !== null && ` · ${formatTHB(category.monthlyBudgetSatang)} / month`}
        </span>
      </span>
      <Button variant="ghost" size="icon-sm" onClick={() => onEdit(category)} aria-label={`Edit ${category.name}`}>
        <Pencil className="size-4" />
      </Button>
      {!category.isFallback && (
        <>
          <Button variant="ghost" size="icon-sm" onClick={() => onArchive(category)} aria-label={`Archive ${category.name}`} title="Archive">
            <Archive className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(category)} aria-label={`Delete ${category.name}`}>
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
    </li>
  );
}

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Create, edit, reorder, archive and delete expense categories. */
export function CategoryManagerDialog({ open, onOpenChange }: CategoryManagerDialogProps) {
  const categoriesQuery = useCategories();
  const expensesQuery = useExpenses();
  const recurringQuery = useRecurring();
  const reorder = useReorderCategories();
  const setArchived = useSetCategoryArchived();

  const [editing, setEditing] = useState<Category | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);

  const countByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    for (const expense of expensesQuery.data ?? []) {
      counts.set(expense.categoryId, (counts.get(expense.categoryId) ?? 0) + 1);
    }
    // Recurring rules also point at a category, so they count as uses when deleting one.
    for (const rule of recurringQuery.data ?? []) {
      counts.set(rule.categoryId, (counts.get(rule.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [expensesQuery.data, recurringQuery.data]);

  // A drag needs a small movement first, so a plain click on a button is not a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [announcement, setAnnouncement] = useState("");

  function moveCategory(category: Category, direction: -1 | 1) {
    const ids = active.map((item) => item.id);
    const from = ids.indexOf(category.id);
    const to = Math.min(Math.max(from + direction, 0), ids.length - 1);
    if (from === -1 || to === from) return;
    reorder.mutate(arrayMove(ids, from, to));
    setAnnouncement(`Moved ${category.name} to position ${to + 1} of ${ids.length}`);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const ids = active.map((category) => category.id);
    const from = ids.indexOf(Number(dragged.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    reorder.mutate(arrayMove(ids, from, to));
  }

  function openForm(category: Category | null) {
    setEditing(category);
    setFormOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Drag to reorder. Archived categories are hidden when adding expenses but still show on old ones.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="size-4" />
            New category
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={active.map((category) => category.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-1.5">
              {active.map((category) => (
                <SortableRow
                  key={category.id}
                  category={category}
                  expenseCount={countByCategory.get(category.id) ?? 0}
                  onMove={moveCategory}
                  onEdit={openForm}
                  onArchive={(target) => {
                    // Nothing to ask when no expense uses it; otherwise archiving is offered by the delete dialog too.
                    setArchived.mutate({ id: target.id, archived: true });
                  }}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>

        {archived.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowArchived((value) => !value)}>
              {showArchived ? "Hide" : "Show"} archived ({archived.length})
            </Button>
            {showArchived && (
              <ul className="flex flex-col gap-1.5">
                {archived.map((category) => (
                  <li key={category.id} className="flex items-center gap-2 rounded-lg border bg-card/50 py-1.5 pr-2 pl-3 opacity-80">
                    <CategoryAvatar category={category} />
                    <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {countByCategory.get(category.id) ?? 0} expense{(countByCategory.get(category.id) ?? 0) === 1 ? "" : "s"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchived.mutate({ id: category.id, archived: false })}
                    >
                      <ArchiveRestore className="size-4" />
                      Restore
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(category)} aria-label={`Delete ${category.name}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Rendered inside this dialog so they count as part of it: using them never counts as clicking outside. */}
        <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editing} existing={categories} />
        <DeleteCategoryDialog
          category={deleting}
          expenseCount={deleting ? (countByCategory.get(deleting.id) ?? 0) : 0}
          categories={active}
          onClose={() => setDeleting(null)}
        />
      </DialogContent>
    </Dialog>
  );
}
