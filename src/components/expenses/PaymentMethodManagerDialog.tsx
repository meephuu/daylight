import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useExpenses } from "@/hooks/useExpenses";
import {
  useCreatePaymentMethod,
  usePaymentMethods,
  useRenamePaymentMethod,
  useDeletePaymentMethod,
  useSetPaymentMethodArchived,
} from "@/hooks/usePaymentMethods";
import { getCategoryIcon } from "@/lib/categoryIcons";
import type { PaymentMethod } from "@/lib/db/paymentMethods";

interface PaymentMethodManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Add, rename, archive and delete the ways an expense can be paid. */
export function PaymentMethodManagerDialog({ open, onOpenChange }: PaymentMethodManagerDialogProps) {
  const methodsQuery = usePaymentMethods();
  const expensesQuery = useExpenses();
  const create = useCreatePaymentMethod();
  const rename = useRenamePaymentMethod();
  const setArchived = useSetPaymentMethodArchived();
  const remove = useDeletePaymentMethod();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);

  const methods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data]);
  const usage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const expense of expensesQuery.data ?? []) {
      if (expense.paymentMethodId !== null) counts.set(expense.paymentMethodId, (counts.get(expense.paymentMethodId) ?? 0) + 1);
    }
    return counts;
  }, [expensesQuery.data]);

  function nameTaken(name: string, exceptId: number | null): boolean {
    return methods.some((method) => method.id !== exceptId && method.name.toLowerCase() === name.toLowerCase());
  }

  async function add() {
    const name = newName.trim();
    if (name === "") return;
    if (nameTaken(name, null)) {
      setError(`There is already a payment method called “${name}”.`);
      return;
    }
    setError("");
    await create.mutateAsync(name);
    setNewName("");
  }

  async function saveRename(method: PaymentMethod) {
    const name = editName.trim();
    if (name === "") return;
    if (nameTaken(name, method.id)) {
      setError(`There is already a payment method called “${name}”.`);
      return;
    }
    setError("");
    await rename.mutateAsync({ id: method.id, name });
    setEditingId(null);
  }

  const active = methods.filter((method) => !method.archived);
  const archived = methods.filter((method) => method.archived);

  function renderRow(method: PaymentMethod) {
    const Icon = getCategoryIcon(method.icon);
    const count = usage.get(method.id) ?? 0;
    const editing = editingId === method.id;
    return (
      <li key={method.id} className="flex items-center gap-2 rounded-lg border bg-card py-1.5 pr-2 pl-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        {editing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              void saveRename(method);
            }}
          >
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus aria-label="Payment method name" />
            <Button type="submit" size="icon-sm" aria-label="Save name">
              <Check className="size-4" />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel renaming" onClick={() => setEditingId(null)}>
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{method.name}</span>
              <span className="block text-xs text-muted-foreground">
                {count} expense{count === 1 ? "" : "s"}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${method.name}`}
              onClick={() => {
                setEditingId(method.id);
                setEditName(method.name);
                setError("");
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={method.archived ? `Restore ${method.name}` : `Archive ${method.name}`}
              title={method.archived ? "Restore" : "Archive"}
              onClick={() => setArchived.mutate({ id: method.id, archived: !method.archived })}
            >
              {method.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${method.name}`} onClick={() => setDeleting(method)}>
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </li>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment methods</DialogTitle>
          <DialogDescription>
            Archived methods are hidden when adding expenses but still show on old ones.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New payment method"
            aria-label="New payment method name"
            autoComplete="off"
          />
          <Button type="submit" disabled={newName.trim() === ""}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <ul className="flex flex-col gap-1.5">{active.map(renderRow)}</ul>

        {archived.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Archived</p>
            <ul className="flex flex-col gap-1.5 opacity-80">{archived.map(renderRow)}</ul>
          </div>
        )}

        <ConfirmDialog
          open={deleting !== null}
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Delete “${deleting?.name ?? ""}”?`}
          description={
            (usage.get(deleting?.id ?? -1) ?? 0) > 0
              ? `${usage.get(deleting?.id ?? -1)} expense(s) use it. They stay, but will show no payment method. Archive it instead to keep the label.`
              : "No expense uses it."
          }
          confirmLabel="Delete"
          onConfirm={() => deleting && remove.mutate(deleting.id)}
        />
      </DialogContent>
    </Dialog>
  );
}
