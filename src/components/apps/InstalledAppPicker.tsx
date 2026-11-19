import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AppWindow, Check, ChevronDown, FileInput, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppIcon, useInstalledApps } from "@/hooks/useAppShortcuts";
import type { InstalledApp } from "@/lib/launcher";
import { cn } from "@/lib/utils";

/** Shown at most at once; the search narrows the rest down. */
const LIST_LIMIT = 80;

/** A typed or pasted Windows path ("C:\...", "\\server\...") rather than a name to search for. */
function looksLikePath(text: string): boolean {
  return /^[a-z]:\\/i.test(text) || text.startsWith("\\\\");
}

/** An app's icon, read from Windows only once its row scrolls into view (the list can hold hundreds). */
function AppRowIcon({ target, visible }: { target: string; visible: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || seen || !visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen, visible]);
  const icon = useAppIcon(target, 64, visible && seen);
  return (
    <span ref={ref} className="grid size-7 shrink-0 place-items-center" aria-hidden="true">
      {icon.data ? (
        <img src={icon.data} alt="" className="size-full object-contain" draggable={false} />
      ) : (
        <AppWindow className="size-4 text-foreground/40" />
      )}
    </span>
  );
}

interface InstalledAppPickerProps {
  /** The chosen target: "shell:AppsFolder\..." or a path. */
  value: string;
  onChange: (app: InstalledApp) => void;
  invalid?: boolean;
  id?: string;
}

/**
 * Picks an app from the apps installed on this PC (Start's "All apps"), filtered as you type. A pasted
 * path to a program or shortcut can be used as is.
 */
export function InstalledAppPicker({ value, onChange, invalid, id }: InstalledAppPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const apps = useInstalledApps(true);

  const chosen = apps.data?.find((app) => app.target === value);
  const pathValue = value && !chosen && !value.toLowerCase().startsWith("shell:appsfolder\\");
  const label = chosen?.name ?? (pathValue ? value.split(/[\\/]/).pop() : null);

  const wanted = query.trim();
  const pathOption: InstalledApp | null = looksLikePath(wanted)
    ? { name: wanted.split(/[\\/]/).pop() || wanted, target: wanted.replace(/^"|"$/g, "") }
    : null;
  const matches = useMemo(() => {
    if (looksLikePath(wanted)) return [];
    const lower = wanted.toLocaleLowerCase();
    const all = apps.data ?? [];
    const found = lower ? all.filter((app) => app.name.toLocaleLowerCase().includes(lower)) : all;
    // Names that start with the query first, then the rest, each A-Z (the list already is).
    return lower ? [...found.filter((app) => app.name.toLocaleLowerCase().startsWith(lower)), ...found.filter((app) => !app.name.toLocaleLowerCase().startsWith(lower))] : found;
  }, [apps.data, wanted]);
  const options = pathOption ? [pathOption] : matches.slice(0, LIST_LIMIT);

  useEffect(() => setActive(0), [wanted]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(app: InstalledApp) {
    onChange(app);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) choose(option);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Every opening starts from the full list.
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[14px] border border-input bg-white/50 pr-3 pl-2 text-left text-sm outline-none transition-colors hover:bg-white/65 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]",
        )}
      >
        {value ? <AppRowIcon target={value} visible /> : <AppWindow className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className={cn("min-w-0 flex-1 truncate", !label && "text-muted-foreground")} title={pathValue ? value : undefined}>
          {label ?? "Choose an app"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(380px,calc(100vw-48px))] gap-2 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={onKeyDown}
            placeholder="Search apps, or paste a path"
            aria-label="Search apps on this PC, or paste a path to a program"
            aria-controls="installed-app-list"
            aria-activedescendant={options[active] ? `installed-app-${active}` : undefined}
            className="h-9 rounded-full pl-8"
            autoFocus
          />
        </div>
        {apps.isPending ? (
          <div className="grid h-28 place-items-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-label="Reading the apps on this PC" />
          </div>
        ) : (
          <ul
            ref={listRef}
            id="installed-app-list"
            role="listbox"
            aria-label="Apps on this PC"
            className="-mr-2 max-h-[300px] overflow-y-auto pr-0.5 [scrollbar-gutter:stable]"
          >
            {options.map((app, index) => {
              const selected = app.target === value;
              return (
                <li
                  key={app.target}
                  id={`installed-app-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(app)}
                  className={cn(
                    "flex cursor-default items-center gap-2.5 rounded-[12px] px-2 py-1.5 text-sm",
                    index === active && "bg-foreground/[0.08]",
                  )}
                >
                  {pathOption ? (
                    <FileInput className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <AppRowIcon target={app.target} visible={open} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{pathOption ? `Use ${app.target}` : app.name}</span>
                  {selected && <Check className="size-4 shrink-0 text-sky-accent" aria-label="Chosen" />}
                </li>
              );
            })}
            {!options.length && (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                {apps.data?.length ? `No app called "${wanted}". Try Browse to pick the program itself.` : "Couldn't read the apps on this PC. Use Browse instead."}
              </li>
            )}
            {matches.length > LIST_LIMIT && (
              <li className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">{matches.length - LIST_LIMIT} more. Type to narrow it down.</li>
            )}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
