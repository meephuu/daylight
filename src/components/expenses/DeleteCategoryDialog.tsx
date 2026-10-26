import { useState } from "react";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteCategory, useSetCategoryArchived } from "@/hooks/useCategories";
import type { Category } from "@/lib/db/categories";
import { cn } from "@/lib/utils";

interface DeleteCategoryDialogProps {
  /** The category being deleted; the dialog is open while this is set. */
  category: Category | null;
  expenseCount: number;
  /** Active categories (including "Other"), to move expenses into. */
  categories: Category[];
  onClose: () => void;
}

type Choice = "reassign" | "archive";

export function DeleteCategoryDialog({ category, expenseCount, categories, onClose }: DeleteCategoryDialogProps) {
  return (
    <Dialog open={category !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {category && (
          <DeleteForm category={category} expenseCount={expenseCount} categories={categories} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface DeleteFormProps {
  category: Category;
  expenseCount: number;
  categories: Category[];
  onClose: () => void;
}

function DeleteForm({ category, expenseCount, categories, onClose }: DeleteFormProps) {
  const deleteCategory = useDeleteCategory();
  const setArchived = useSetCategoryArchived();

  const targets = categories.filter((other) => other.id !== category.id && !other.archived);
  const fallback = targets.find((other) => other.isFallback) ?? targets[0];
  const [choice, setChoice] = useState<Choice>("reassign");
  const [targetId, setTargetId] = useState<string>(String(fallback?.id ?? ""));
  const busy = deleteCategory.isPending || setArchived.isPending;

  async function confirm() {
    if (expenseCount > 0 && choice === "archive") {
      await setArchived.mutateAsync({ id: category.id, archived: true });
    } else {
      await deleteCategory.mutateAsync({
        id: category.id,
        reassignTo: expenseCount > 0 ? Number(targetId) : null,
      });
    }
    onClose();
  }

  if (expenseCount === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Delete “{category.name}”?</DialogTitle>
          <DialogDescription>No expenses use this category, so nothing else changes.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
            Delete category
          </Button>
        </DialogFooter>
      </>
    );
  }

  const plural = expenseCount === 1 ? "expense uses" : "expenses use";
  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete “{category.name}”?</DialogTitle>
        <DialogDescription>
          {expenseCount} {plural} this category. Choose what should happen to {expenseCount === 1 ? "it" : "them"}.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">What to do with its expenses</legend>
        <div className={cn("rounded-lg border p-3", choice === "reassign" && "border-primary bg-primary/5")}>
          <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
            <input
              type="radio"
              name="delete-choice"
              className="mt-0.5 accent-primary"
              checked={choice === "reassign"}
              onChange={() => setChoice("reassign")}
            />
            Move the expenses to another category, then delete
          </label>
          <div className="mt-2 pl-6">
            <OptionSelect
              value={targetId}
              onChange={(value) => {
                setTargetId(value);
                setChoice("reassign");
              }}
              options={targets.map((target) => ({ value: String(target.id), label: target.name }))}
            />
          </div>
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-2 rounded-lg border p-3",
            choice === "archive" && "border-primary bg-primary/5",
          )}
        >
          <input
            type="radio"
            name="delete-choice"
            className="mt-0.5 accent-primary"
            checked={choice === "archive"}
            onChange={() => setChoice("archive")}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Archive it instead</span>
            <span className="text-xs text-muted-foreground">
              The expenses keep this category and show correctly; it just no longer appears when adding new ones.
            </span>
          </span>
        </label>
      </fieldset>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={choice === "archive" ? "default" : "destructive"}
          disabled={busy || (choice === "reassign" && targetId === "")}
          onClick={() => void confirm()}
        >
          {choice === "archive" ? "Archive category" : "Move and delete"}
        </Button>
      </DialogFooter>
    </>
  );
}
