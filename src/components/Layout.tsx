import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Dumbbell,
  Disc3,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Settings,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { GlassRain } from "@/components/ambient/GlassRain";
import { SkyBackground } from "@/components/ambient/SkyBackground";
import { TimeOfDayDebugPanel } from "@/components/ambient/TimeOfDayDebugPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/Toaster";
import { TitleBar } from "@/components/TitleBar";
import { TrayEvents } from "@/components/TrayEvents";
import { SkyOrb } from "@/components/ambient/SkyOrb";
import { SHOW_TIME_DEBUG_PANEL, useWeather } from "@/lib/ambient";
import { NowPlayingService } from "@/lib/nowPlaying";
import { applyOrder, useSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/music", label: "Music", icon: Disc3 },
  { to: "/review", label: "Weekly review", icon: ClipboardCheck },
];

const SETTINGS_ITEM = { to: "/settings", label: "Settings", icon: Settings };

/** Shared by both sidebar sizes: the icon keeps its exact place, only the label fades and is clipped. */
const ROW = "relative flex h-10 items-center gap-3 overflow-hidden rounded-full px-3.5 text-sm font-medium whitespace-nowrap outline-none";
const LABEL_FADE = "transition-opacity duration-200 ease-out motion-reduce:transition-none";

type NavItemProps = { to: string; label: string; icon: LucideIcon; compact: boolean };

function NavItem({ to, label, icon: Icon, compact }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      // The browser's own link dragging would take over the pointer from the menu reordering.
      draggable={false}
      title={compact ? label : undefined}
      className={({ isActive }) =>
        cn(
          ROW,
          "group/nav transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50",
          // The lit slab behind the active item is drawn once by the sidebar, so it can slide between items.
          isActive ? "text-foreground" : "text-foreground/70 hover:bg-white/40 hover:text-foreground dark:hover:bg-white/[0.07]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-[17px] shrink-0 transition-colors duration-200",
              isActive ? "text-sky-accent" : "text-foreground/55 group-hover/nav:text-foreground/80",
            )}
            strokeWidth={isActive ? 2.25 : 2}
          />
          <span className={cn(LABEL_FADE, compact && "opacity-0")}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/**
 * A menu item that can be dragged up or down to reorder the menu. A press only becomes a drag after the
 * pointer moves a few pixels, so a plain click still opens the page. Only vertical movement is applied.
 */
function SortableNavItem(props: NavItemProps) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.to });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className={cn("relative touch-none", isDragging && "z-10 cursor-grabbing opacity-80")}
      style={{ transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined, transition }}
    >
      <NavItem {...props} />
    </div>
  );
}

/** The main menu in the owner's order, reordered by dragging. */
function MainNav({ compact }: { compact: boolean }) {
  const { order, setOrder, setDragging } = useSidebar();
  const items = useMemo(() => applyOrder(NAV_ITEMS, order), [order]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // A drag ends with the pointer released over a link; that release must not also open the page (or
  // reopen the current one). From the start of a drag until shortly after the drop, every click is
  // swallowed at the window, before it can reach a link or the router.
  const settle = useRef<number | undefined>(undefined);
  const swallow = useRef<((event: MouseEvent) => void) | null>(null);
  const release = () => {
    if (swallow.current) window.removeEventListener("click", swallow.current, true);
    swallow.current = null;
  };
  useEffect(() => () => {
    window.clearTimeout(settle.current);
    release();
  }, []);
  const start = () => {
    window.clearTimeout(settle.current);
    if (!swallow.current) {
      swallow.current = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      };
      window.addEventListener("click", swallow.current, true);
    }
    setDragging(true);
  };
  const finish = () => {
    window.clearTimeout(settle.current);
    // Long enough for the click that follows the release and for the items to slide into place.
    settle.current = window.setTimeout(() => {
      release();
      setDragging(false);
    }, 320);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    finish();
    if (!over || active.id === over.id) return;
    const paths = items.map((item) => item.to);
    setOrder(arrayMove(paths, paths.indexOf(String(active.id)), paths.indexOf(String(over.id))));
  };

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={start}
        onDragEnd={handleDragEnd}
        onDragCancel={finish}
      >
        <SortableContext items={items.map((item) => item.to)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableNavItem key={item.to} {...item} compact={compact} />
          ))}
        </SortableContext>
      </DndContext>
    </nav>
  );
}

/**
 * The lit slab behind the active page in the sidebar. It is measured from the active link and glides to
 * the next one when the page changes, so moving between pages reads as one continuous motion.
 */
function useActiveSlab(asideRef: React.RefObject<HTMLElement | null>, pathname: string, order: string[], dragging: boolean) {
  const [slab, setSlab] = useState<{ top: number; height: number } | null>(null);
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const measure = () => {
      const active = aside.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!active) return setSlab(null);
      const top = active.getBoundingClientRect().top - aside.getBoundingClientRect().top;
      setSlab({ top, height: active.offsetHeight });
    };
    measure();
    // The Settings item sits at the foot, so its position moves with the window height.
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    return () => observer.disconnect();
  }, [asideRef, pathname, order]);

  // While the menu is being reordered the slab sticks to the active item, measured every frame, so it
  // rides along when that item is dragged or slides aside for another one.
  useLayoutEffect(() => {
    const aside = asideRef.current;
    if (!dragging || !aside) return;
    let frame = 0;
    const follow = () => {
      const active = aside.querySelector<HTMLElement>('a[aria-current="page"]');
      if (active) {
        const top = active.getBoundingClientRect().top - aside.getBoundingClientRect().top;
        setSlab((current) => (current && current.top === top ? current : { top, height: active.offsetHeight }));
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [asideRef, dragging]);

  useLayoutEffect(() => {
    if (slab && !placed) {
      const frame = requestAnimationFrame(() => setPlaced(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [slab, placed]);

  return { slab, placed };
}

/**
 * Each time a page opens, its slabs come into focus one after another: the page header first, then
 * every pane in reading order, like glass condensing out of the sky. Only the outermost blocks animate
 * (a toolbar inside the header rides with it), the stagger is capped so long pages never make you wait,
 * and nothing is hidden by default, so content is always there if the animation does not run.
 */
function usePageEntrance(pageRef: React.RefObject<HTMLElement | null>, pathname: string) {
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const selector = ".pane, [data-settle], header";
    const blocks = Array.from(page.querySelectorAll<HTMLElement>(selector)).filter((block) => {
      const outer = block.parentElement?.closest(selector);
      return !outer || !page.contains(outer);
    });
    const cleanups = blocks.map((block, index) => {
      block.style.animationDelay = `${Math.min(index, 7) * 40}ms`;
      block.classList.add("settle-in");
      const done = (event?: AnimationEvent) => {
        if (event && event.target !== block) return;
        block.classList.remove("settle-in");
        block.style.animationDelay = "";
        block.removeEventListener("animationend", done);
      };
      block.addEventListener("animationend", done);
      return done;
    });
    return () => cleanups.forEach((done) => done());
  }, [pageRef, pathname]);
}

export function Layout() {
  const location = useLocation();
  const { compact, setCompact, order, dragging } = useSidebar();
  const rain = useWeather((state) => state.rain);
  const asideRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const { slab, placed } = useActiveSlab(asideRef, location.pathname, order, dragging);
  usePageEntrance(pageRef, location.pathname);

  const section = [...NAV_ITEMS, SETTINGS_ITEM].find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  )?.label;

  return (
    <div className="flex h-screen flex-col text-foreground">
      <SkyBackground />
      {/*
        The frosted top edge of the scroll area (see .scroll-veil). It lives outside the scroll area so it can
        start at the sidebar's edge: over the 12px gap it fades in, letting the blur of text near the content's
        left edge spread and fade instead of being sliced off. It follows the sidebar's width.
      */}
      <div
        ref={veilRef}
        aria-hidden="true"
        className="scroll-veil pointer-events-none fixed top-0 right-0 z-30 h-20 transition-[left] duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{ left: (compact ? 60 : 212) + 12 }}
      >
        <span />
        <span />
        <span />
        <span />
      </div>
      <TitleBar section={section} />
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        {/*
          The sidebar: full (icons and labels) or small (a thin rail of icons). Switching slides the width
          while every icon stays exactly where it is; the labels fade and are clipped by the narrowing rail.
        */}
        <aside
          ref={asideRef}
          className={cn(
            "pane relative flex shrink-0 flex-col overflow-hidden p-2",
            "transition-[width] duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            compact ? "w-[60px]" : "w-[212px]",
          )}
        >
          {slab && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-2 left-2 top-0 rounded-full bg-white/75 shadow-[inset_0_1px_0_var(--glass-edge),inset_0_0_0_1px_color-mix(in_srgb,var(--sky-accent)_45%,transparent),0_2px_10px_-6px_rgb(0_0_0/0.3)] dark:bg-white/[0.14]",
                placed && !dragging && "transition-[translate] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              )}
              style={{ translate: `0 ${slab.top}px`, height: slab.height }}
            />
          )}

          <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-4">
            <SkyOrb />
            <span
              className={cn("font-display text-[20px] font-semibold tracking-[-0.03em] whitespace-nowrap", LABEL_FADE, compact && "opacity-0")}
              aria-hidden={compact}
            >
              Daylight
            </span>
          </div>
          <MainNav compact={compact} />
          <div className="mt-auto flex flex-col gap-0.5 border-t border-foreground/10 pt-2">
            <button
              type="button"
              onClick={() => setCompact(!compact)}
              aria-label={compact ? "Expand sidebar" : "Shrink sidebar"}
              title={compact ? "Expand sidebar" : "Shrink sidebar"}
              className={cn(
                ROW,
                "h-9 text-[13px] text-foreground/55 transition-colors hover:bg-white/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-white/[0.07]",
              )}
            >
              {compact ? <PanelLeftOpen className="size-[17px] shrink-0" /> : <PanelLeftClose className="size-[17px] shrink-0" />}
              <span className={cn(LABEL_FADE, compact && "opacity-0")}>Small sidebar</span>
            </button>
            <NavItem {...SETTINGS_ITEM} compact={compact} />
          </div>
        </aside>
        {/* Drops on the glass while it rains: above the panes, below dialogs and toasts. */}
        <GlassRain active={rain} />
        <TrayEvents />
        {/* Spotify, read once for the whole app; also keeps the listening history. */}
        <NowPlayingService />
        <Toaster />
        {SHOW_TIME_DEBUG_PANEL && <TimeOfDayDebugPanel />}
        {/* relative: keeps absolutely positioned content (screen-reader tables) inside this scroll area instead of stretching the whole window */}
        {/*
          The scroll area runs from the window's top edge (under the title bar, -mt-10) to its bottom edge (-mb-3
          cancels the shell's bottom gutter, which only the sidebar keeps), so content is never sliced off in
          the middle of the window. Near the top, a frosted veil blurs and dims what scrolls up under the title
          bar; it fades in with the first few pixels of scroll, so a page at rest is perfectly sharp.
        */}
        <main
          className="relative -mt-10 -mb-3 min-w-0 flex-1 overflow-y-auto"
          onScroll={(event) => {
            // A variable, not opacity on the veil: opacity on a parent would stop its layers' blur working.
            veilRef.current?.style.setProperty("--veil", String(Math.min(1, event.currentTarget.scrollTop / 32)));
          }}
        >
          {/* Keyed by route: a page that crashes shows a message, and opening another page recovers. */}
          <ErrorBoundary key={location.pathname}>
            <div ref={pageRef} className="px-1 pt-11 pb-9">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
