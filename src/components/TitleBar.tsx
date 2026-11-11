import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useAmbientMinutes } from "@/lib/ambient";
import { skyReadout } from "@/lib/sky";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  /** Name of the page being shown. */
  section?: string;
}

/**
 * The window's own title bar, drawn by the app so it sits on the sky with everything else (the native
 * one is switched off in tauri.conf.json). Dragging it moves the window, double-clicking it maximises.
 * The middle carries the live sky readout. The close button hides the window to the tray.
 */
export function TitleBar({ section }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);
  const minutes = useAmbientMinutes();

  useEffect(() => {
    // Outside the desktop app (a plain browser, tests) there is no window to ask; the bar just sits there.
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    try {
      const appWindow = getCurrentWindow();
      const sync = () => {
        appWindow
          .isMaximized()
          .then((value) => !cancelled && setMaximized(Boolean(value)))
          .catch(() => undefined);
      };
      sync();
      appWindow
        .onResized(sync)
        .then((stop) => {
          if (cancelled) stop();
          else unlisten = stop;
        })
        .catch(() => undefined);
    } catch {
      // no window available
    }
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  function run(action: "minimize" | "toggleMaximize" | "close") {
    try {
      void getCurrentWindow()[action]().catch(() => undefined);
    } catch {
      // no window available
    }
  }

  const buttonClass =
    "inline-flex h-full w-11 items-center justify-center text-foreground/70 outline-none transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:bg-foreground/10 focus-visible:text-foreground";

  return (
    <header data-tauri-drag-region className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center select-none">
      <div data-tauri-drag-region className="flex min-w-0 items-center pl-5 text-xs">
        <span data-tauri-drag-region className="truncate font-semibold text-foreground/85">
          {section ?? "Daylight"}
        </span>
      </div>

      <div data-tauri-drag-region className="flex items-center gap-2 text-xs text-foreground/75">
        <span
          data-tauri-drag-region
          aria-hidden="true"
          className="size-2 rounded-full bg-sky-accent shadow-[0_0_10px_1px_var(--sky-accent)]"
        />
        <span data-tauri-drag-region className="tabular-nums" aria-live="off">
          {skyReadout(minutes)}
        </span>
      </div>

      <div className="flex h-full justify-end">
        <button type="button" className={buttonClass} onClick={() => run("minimize")} aria-label="Minimize" title="Minimize">
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => run("toggleMaximize")}
          aria-label={maximized ? "Restore" : "Maximize"}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Copy className="size-3.5 -scale-x-100" /> : <Square className="size-3.5" />}
        </button>
        <button
          type="button"
          className={cn(buttonClass, "hover:bg-destructive hover:text-white focus-visible:bg-destructive focus-visible:text-white")}
          onClick={() => run("close")}
          aria-label="Close to tray"
          title="Close (keeps running in the tray)"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
