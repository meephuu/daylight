import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastStore, type Toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.durationMs);
  const startedAt = useRef(0);
  // Leaving plays the exit animation first, then removes the toast.
  const [leaving, setLeaving] = useState(false);
  const leave = useRef(() => {});
  leave.current = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => dismiss(toast.id), 160);
  };

  // Counts down toast.durationMs, but only while the pointer or keyboard focus is not on the toast.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => leave.current(), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, dismiss, toast.id]);

  function runAction() {
    toast.onAction?.();
    leave.current();
  }

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        "pointer-events-auto flex items-center gap-2 glass-strong rounded-xl py-2 pr-1.5 pl-3 text-sm text-popover-foreground",
        leaving ? "toast-out" : "toast-in",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{toast.message}</span>
      {toast.actionLabel && (
        <Button size="sm" variant="secondary" onClick={runAction}>
          {toast.actionLabel}
          <kbd className="ml-1 rounded border px-1 text-[10px] text-muted-foreground">Ctrl Z</kbd>
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" onClick={() => leave.current()} aria-label="Dismiss">
        <X className="size-4" />
      </Button>
    </div>
  );
}

/** Small notifications in the bottom-right corner. Ctrl+Z runs the newest toast's action (e.g. Undo). */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || isTyping(event.target)) return;
      const latest = [...useToastStore.getState().toasts].reverse().find((toast) => toast.onAction);
      if (!latest) return;
      event.preventDefault();
      latest.onAction?.();
      dismiss(latest.id);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss]);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
