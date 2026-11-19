import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Menu } from "@base-ui/react/menu";
import { ExternalLink, LayoutGrid, Pencil, Plus, Search, SearchX, Trash2, X } from "lucide-react";
import { AppTile } from "@/components/apps/AppTile";
import { ShortcutFormDialog } from "@/components/apps/ShortcutFormDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAppShortcuts,
  useDeleteShortcut,
  useLaunchShortcut,
  useRestoreShortcut,
  useSeedShortcuts,
} from "@/hooks/useAppShortcuts";
import type { AppShortcut } from "@/lib/db/appShortcuts";
import { filterShortcuts, sortShortcuts } from "@/lib/launcher";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/** A point on screen the menu can open at (a right-click). */
function pointAnchor(x: number, y: number) {
  return { getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) };
}

type MenuState = { shortcut: AppShortcut; anchor: Element | ReturnType<typeof pointAnchor> } | null;

/** The form: closed, adding (optionally with a name to start from), or editing a shortcut. */
type FormState = { open: false } | { open: true; shortcut: AppShortcut | null; name?: string };

/**
 * Quick Access: the apps and websites the owner opens often, as a Launchpad-like grid of icons with a
 * search that filters as you type, A-Z order, and add / edit / delete. Keyboard: Ctrl+F or /
 * goes to the search, arrows move between icons, Enter opens, Delete removes (with Undo), F2 edits,
 * Shift+F10 or the menu key opens an icon's menu.
 */
export function QuickAccessPanel() {
  const shortcutsQuery = useAppShortcuts();
  const { seeding } = useSeedShortcuts();
  const launch = useLaunchShortcut();
  const remove = useDeleteShortcut();
  const restore = useRestoreShortcut();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState<MenuState>(null);
  const [form, setForm] = useState<FormState>({ open: false });
  const [opening, setOpening] = useState<number | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const tileRefs = useRef(new Map<number, HTMLButtonElement>());
  const menuReturn = useRef<HTMLElement | null>(null);

  const all = useMemo(() => shortcutsQuery.data ?? [], [shortcutsQuery.data]);
  const shown = useMemo(() => filterShortcuts(sortShortcuts(all), query), [all, query]);
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));

  // Ctrl+F or / jumps to the search box (unless a field or a dialog has the keyboard).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector('[role="dialog"]') !== null) return;
      const ctrlF = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "f";
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target);
      if (!ctrlF && !slash) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // A shortcut just added: bring it into view (its tile pops in).
  useEffect(() => {
    if (fresh === null) return;
    const tile = tileRefs.current.get(fresh);
    tile?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timer = window.setTimeout(() => setFresh(null), 900);
    return () => window.clearTimeout(timer);
  }, [fresh, shown]);

  function focusTile(index: number) {
    const shortcut = shown[index];
    if (!shortcut) return;
    setActive(index);
    tileRefs.current.get(shortcut.id)?.focus();
  }

  /** The Search button and Enter: the grid already shows the matches, so go to the first one. */
  function runSearch() {
    if (shown.length) focusTile(0);
    else searchRef.current?.focus();
  }

  function open(shortcut: AppShortcut) {
    if (opening === shortcut.id) return;
    setOpening(shortcut.id);
    const started = Date.now();
    launch.mutate(shortcut, {
      onError: (error) =>
        showToast({
          message: `Couldn't open ${shortcut.name}. ${error instanceof Error ? error.message : String(error)}`,
          actionLabel: "Edit",
          onAction: () => setForm({ open: true, shortcut }),
          durationMs: 7000,
        }),
      // Hold the pressed look a moment, so a fast launch still reads as a press.
      onSettled: () => window.setTimeout(() => setOpening(null), Math.max(0, 380 - (Date.now() - started))),
    });
  }

  function removeWithUndo(shortcut: AppShortcut) {
    const index = shown.findIndex((item) => item.id === shortcut.id);
    remove.mutate(shortcut.id, {
      onSuccess: () => {
        showToast({ message: `Removed ${shortcut.name}`, actionLabel: "Undo", onAction: () => restore.mutate(shortcut) });
        // Keep the keyboard in the grid, on the icon that took its place.
        window.setTimeout(() => {
          const next = shown.filter((item) => item.id !== shortcut.id);
          const target = next[Math.min(index, next.length - 1)];
          if (target) tileRefs.current.get(target.id)?.focus();
          else searchRef.current?.focus();
        }, 60);
      },
    });
  }

  function openMenu(shortcut: AppShortcut, anchor: Element | { x: number; y: number }) {
    menuReturn.current = tileRefs.current.get(shortcut.id) ?? null;
    setMenu({ shortcut, anchor: anchor instanceof Element ? anchor : pointAnchor(anchor.x, anchor.y) });
  }

  function columns(): number {
    const grid = gridRef.current;
    if (!grid) return 1;
    return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length);
  }

  function onTileKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, shortcut: AppShortcut) {
    const cols = columns();
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + cols,
      ArrowUp: index - cols,
      Home: 0,
      End: shown.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      const next = moves[event.key];
      if (event.key === "ArrowUp" && next < 0) {
        searchRef.current?.focus();
        return;
      }
      if (next >= 0 && next < shown.length) focusTile(next);
      else if (event.key === "ArrowDown" && index < shown.length - 1) focusTile(shown.length - 1);
    } else if (event.key === "Delete") {
      event.preventDefault();
      removeWithUndo(shortcut);
    } else if (event.key === "F2") {
      event.preventDefault();
      setForm({ open: true, shortcut });
    } else if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      openMenu(shortcut, event.currentTarget);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    } else if (event.key === "ArrowDown" && shown.length) {
      event.preventDefault();
      focusTile(0);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  }

  const loading = shortcutsQuery.isPending || (seeding && all.length === 0);
  const trimmed = query.trim();
  const countLine = trimmed
    ? `${shown.length} of ${all.length} ${all.length === 1 ? "shortcut" : "shortcuts"}`
    : `${all.length} ${all.length === 1 ? "shortcut" : "shortcuts"}`;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/*
        The owner's sketch (add, the search field, Search), as its own floating pill of glass like the
        Music page's search bar: the pane is the field, the input inside it is bare.
      */}
      <form
        role="search"
        className="pane flex shrink-0 items-center gap-2 rounded-full p-1.5 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Button type="button" size="icon" className="size-9" aria-label="Add shortcut" title="Add shortcut" onClick={() => setForm({ open: true, shortcut: null })}>
          <Plus className="size-5" aria-hidden="true" />
        </Button>
        <Search className="ml-1.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search apps and sites"
          aria-label="Search shortcuts by name"
          aria-controls="quick-access-grid"
          spellCheck={false}
          autoComplete="off"
          className="h-9 min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              searchRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-foreground/[0.08] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : (
          <kbd className="pointer-events-none shrink-0 rounded-md px-1.5 py-0.5 font-sans text-xs text-muted-foreground ring-1 ring-foreground/15">
            Ctrl F
          </kbd>
        )}
        <Button type="submit" variant="outline" className="h-9 px-5">
          Search
        </Button>
      </form>

      {/* Just the icons (owner's call): no title or count on the pane; the count is only announced. */}
      <Card className="min-w-0 flex-1 [--card-spacing:--spacing(4)]" aria-label="Quick Access">
        <span className="sr-only" aria-live="polite">
          {loading ? "" : countLine}
        </span>
        <CardContent className="flex flex-col gap-5">

          {loading ? (
            <ul aria-label="Loading shortcuts" className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-3">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="flex flex-col items-center gap-2 px-1.5 pt-3.5 pb-3">
                  <span className="size-16 rounded-[30%] glass-well" />
                  <span className="h-3 w-14 rounded-full glass-well" />
                </li>
              ))}
            </ul>
          ) : shown.length ? (
            <ul
              ref={gridRef}
              id="quick-access-grid"
              aria-label={trimmed ? `Shortcuts matching ${trimmed}` : "Shortcuts"}
              className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-3"
            >
              {shown.map((shortcut, index) => (
                <AppTile
                  key={shortcut.id}
                  ref={(node) => {
                    if (node) tileRefs.current.set(shortcut.id, node);
                    else tileRefs.current.delete(shortcut.id);
                  }}
                  shortcut={shortcut}
                  focusable={index === activeIndex}
                  opening={opening === shortcut.id}
                  fresh={fresh === shortcut.id}
                  onOpen={() => open(shortcut)}
                  onFocus={() => setActive(index)}
                  onMenu={(anchor) => openMenu(shortcut, anchor)}
                  onKeyDown={(event) => onTileKeyDown(event, index, shortcut)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              query={trimmed}
              onClear={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              onAdd={() => setForm({ open: true, shortcut: null, name: trimmed })}
            />
          )}
        </CardContent>

        <Menu.Root
          open={menu !== null}
          onOpenChange={(next) => {
            if (!next) setMenu(null);
          }}
        >
          <Menu.Portal>
            <Menu.Positioner anchor={menu?.anchor} side="bottom" align="start" sideOffset={6} className="isolate z-50 outline-none">
              <Menu.Popup
                finalFocus={menuReturn}
                className="flex min-w-48 origin-(--transform-origin) flex-col glass-strong rounded-2xl p-1.5 text-sm text-popover-foreground outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
              >
                {menu && (
                  <>
                    <MenuItem onClick={() => open(menu.shortcut)} icon={ExternalLink} label="Open" hint="Enter" />
                    <MenuItem onClick={() => setForm({ open: true, shortcut: menu.shortcut })} icon={Pencil} label="Edit" hint="F2" />
                    <div role="separator" className="mx-2 my-1 h-px bg-foreground/10" />
                    <MenuItem onClick={() => removeWithUndo(menu.shortcut)} icon={Trash2} label="Delete" hint="Del" destructive />
                  </>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <ShortcutFormDialog
          open={form.open}
          onOpenChange={(next) => {
            if (!next) setForm({ open: false });
          }}
          shortcut={form.open ? form.shortcut : null}
          initialName={form.open ? form.name : undefined}
          onSaved={(id) => {
            if (form.open && !form.shortcut) {
              // Make sure the new icon is visible: clear a search that would hide it.
              if (query && !(form.name && query.trim() === form.name)) setQuery("");
              setFresh(id);
            }
          }}
        />
      </Card>
    </div>
  );
}

function MenuItem({
  onClick,
  icon: Icon,
  label,
  hint,
  destructive,
}: {
  onClick: () => void;
  icon: typeof Pencil;
  label: string;
  hint: string;
  destructive?: boolean;
}) {
  return (
    <Menu.Item
      onClick={onClick}
      className={cn(
        "flex h-9 cursor-default items-center gap-2.5 rounded-[12px] px-2.5 outline-none select-none data-highlighted:bg-foreground/[0.08]",
        destructive && "text-destructive",
      )}
    >
      <Icon className="size-4 opacity-80" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Menu.Item>
  );
}

function EmptyState({ query, onClear, onAdd }: { query: string; onClear: () => void; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[20px] glass-well px-6 py-10 text-center">
      {query ? (
        <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
      ) : (
        <LayoutGrid className="size-6 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{query ? `Nothing called "${query}"` : "No shortcuts yet"}</p>
        <p className="max-w-[44ch] text-sm text-muted-foreground">
          {query ? "Check the spelling, or add it as a new shortcut." : "Add the apps and sites you open most, and they'll be one click away here."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {query && (
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            Clear search
          </Button>
        )}
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          {query ? `Add "${query.length > 24 ? `${query.slice(0, 24)}…` : query}"` : "Add a shortcut"}
        </Button>
      </div>
    </div>
  );
}
