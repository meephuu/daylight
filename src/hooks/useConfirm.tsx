import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { LucideIcon } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Defaults to true: red button and warning icon. */
  destructive?: boolean;
  icon?: LucideIcon;
}

/**
 * `await confirm({...})` resolves to true when the user confirms and false otherwise, like
 * window.confirm but styled like the app. Render `dialog` somewhere in the component's JSX, and
 * inside the parent dialog if the question is asked from inside one, so using it never counts as
 * clicking outside that dialog.
 */
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; options: ConfirmOptions | null }>({ open: false, options: null });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setState((current) => ({ ...current, open: false }));
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const dialog = state.options ? (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      onConfirm={() => settle(true)}
      title={state.options.title}
      description={state.options.description}
      confirmLabel={state.options.confirmLabel}
      cancelLabel={state.options.cancelLabel}
      destructive={state.options.destructive}
      icon={state.options.icon}
    />
  ) : null;

  return { confirm, dialog };
}
