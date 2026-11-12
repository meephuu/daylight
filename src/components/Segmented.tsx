import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional trailing detail, e.g. a count. */
  meta?: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** "tabs" for switching what a panel shows; "group" for a setting. */
  semantics?: "tabs" | "group";
  size?: "sm" | "md";
  /** Draw the recessed track. Off inside a Toolbar, which is already a glass capsule. */
  track?: boolean;
  className?: string;
}

/**
 * A row of pill options with one lit slab that slides to the chosen option. The slab is measured from
 * the chosen button, so it follows labels whose width changes (counts) and never needs fixed widths.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  semantics = "group",
  size = "md",
  track = true,
  className,
  ...rest
}: SegmentedProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [slab, setSlab] = useState<{ left: number; width: number } | null>(null);
  // The first placement is instant; only later changes slide.
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const active = row.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) return setSlab(null);
      setSlab({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    for (const child of Array.from(row.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [value, options.length]);

  useLayoutEffect(() => {
    if (slab && !placed) {
      const frame = requestAnimationFrame(() => setPlaced(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [slab, placed]);

  const tabs = semantics === "tabs";

  return (
    <div
      ref={rowRef}
      role={tabs ? "tablist" : "group"}
      aria-label={rest["aria-label"]}
      className={cn(
        "relative isolate flex rounded-full",
        track && "glass-well p-0.5 shadow-[inset_0_0_0_1px_var(--glass-rim)]",
        className,
      )}
    >
      {slab && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-0.5 bottom-0.5 left-0 -z-10 rounded-full bg-white/85 shadow-[inset_0_1px_0_var(--glass-edge),0_1px_6px_-3px_rgb(0_0_0/0.35)] dark:bg-white/[0.16]",
            !track && "top-0 bottom-0",
            placed && "transition-[translate,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          )}
          style={{ translate: `${slab.left}px 0`, width: slab.width }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-active={active}
            role={tabs ? "tab" : undefined}
            aria-selected={tabs ? active : undefined}
            aria-pressed={tabs ? undefined : active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap outline-none transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50",
              size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
              active ? "text-foreground" : "text-foreground/70 hover:text-foreground",
            )}
          >
            {option.label}
            {option.meta !== undefined && <span className="tabular-nums opacity-70">{option.meta}</span>}
          </button>
        );
      })}
    </div>
  );
}
