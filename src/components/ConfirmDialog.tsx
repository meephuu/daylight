import type { ReactNode } from "react";
import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Red styling for things that cannot be undone. */
  destructive?: boolean;
  icon?: LucideIcon;
}

/**
 * Asks "are you sure?" before something that cannot simply be re-done. It replaces the browser's own
 * confirm box, so it looks like the rest of the app. Focus starts on Cancel, so a stray Enter is safe.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
  icon,
}: ConfirmDialogProps) {
  const Icon = icon ?? (destructive ? TriangleAlert : Info);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </span>
          <DialogHeader className="min-w-0 flex-1 gap-1.5">
            <DialogTitle className="text-base">{title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
