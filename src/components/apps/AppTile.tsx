import { forwardRef, type KeyboardEvent, type MouseEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { ShortcutIcon } from "@/components/apps/ShortcutIcon";
import type { AppShortcut } from "@/lib/db/appShortcuts";
import { describeTarget } from "@/lib/launcher";
import { cn } from "@/lib/utils";

interface AppTileProps {
  shortcut: AppShortcut;
  /** Roving focus: only the current tile is in the Tab order; arrows move between tiles. */
  focusable: boolean;
  opening: boolean;
  fresh: boolean;
  onOpen: () => void;
  onFocus: () => void;
  /** Opens the shortcut's menu next to `anchor`, or at the pointer. */
  onMenu: (anchor: Element | { x: number; y: number }) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** One shortcut in the grid: the icon with its name under it, Launchpad-like. */
export const AppTile = forwardRef<HTMLButtonElement, AppTileProps>(function AppTile(
  { shortcut, focusable, opening, fresh, onOpen, onFocus, onMenu, onKeyDown },
  ref,
) {
  const where = describeTarget(shortcut);

  function onContextMenu(event: MouseEvent) {
    event.preventDefault();
    onMenu({ x: event.clientX, y: event.clientY });
  }

  return (
    <li className={cn("group/tile relative", fresh && "pop-in")} onContextMenu={onContextMenu}>
      <button
        ref={ref}
        type="button"
        data-shortcut={shortcut.id}
        tabIndex={focusable ? 0 : -1}
        onClick={onOpen}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        aria-busy={opening || undefined}
        aria-label={`Open ${shortcut.name}`}
        title={`${shortcut.name}\n${where}`}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-[20px] px-1.5 pt-3.5 pb-3 text-center outline-none transition-colors duration-150",
          "hover:bg-white/45 focus-visible:bg-white/45 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/[0.07] dark:focus-visible:bg-white/[0.07]",
          "[&:active_.tile-icon]:scale-[0.92]",
        )}
      >
        <ShortcutIcon
          kind={shortcut.kind}
          icon={shortcut.icon}
          refine={shortcut.iconSource === "auto"}
          className={cn(
            "tile-icon transition-[scale,opacity,translate] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/tile:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/tile:translate-y-0",
            opening && "scale-[0.92] opacity-60",
          )}
        />
        <span className="line-clamp-2 w-full text-sm leading-[1.25] font-medium break-words text-foreground/90">{shortcut.name}</span>
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`More for ${shortcut.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onMenu(event.currentTarget);
        }}
        className={cn(
          "absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full text-foreground/70 opacity-0 outline-none transition-[opacity,background-color] duration-150",
          "bg-white/70 shadow-[inset_0_1px_0_var(--glass-edge),0_2px_8px_-4px_rgb(2_4_18/0.4)] hover:bg-white/90 hover:text-foreground dark:bg-white/[0.12] dark:hover:bg-white/[0.2]",
          "group-hover/tile:opacity-100 group-focus-within/tile:opacity-100",
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
});
