import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  /** One line under the title that says where things stand, in the page's own numbers. */
  summary?: ReactNode;
  /** Controls on the right; grouped into one glass capsule. */
  actions?: ReactNode;
  className?: string;
}

/**
 * Every page opens the same way: a large display title set straight on the sky (no box around it),
 * the page's state in one sentence under it, and the page's controls together in one glass capsule.
 */
export function PageHeader({ title, summary, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-1 pt-3 pb-2", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[44px] leading-none font-semibold tracking-[-0.035em] text-balance">{title}</h1>
        {summary && <p className="mt-2.5 max-w-[68ch] text-[15px] text-foreground/80">{summary}</p>}
      </div>
      {actions && <Toolbar>{actions}</Toolbar>}
    </header>
  );
}

/** A glass capsule that holds a page's controls side by side. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("pane flex flex-wrap items-center gap-1 rounded-full p-1", className)}>{children}</div>;
}
