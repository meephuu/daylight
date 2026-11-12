import { useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Dumbbell,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Settings,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SkyBackground } from "@/components/ambient/SkyBackground";
import { TimeOfDayDebugPanel } from "@/components/ambient/TimeOfDayDebugPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/Toaster";
import { TitleBar } from "@/components/TitleBar";
import { TrayEvents } from "@/components/TrayEvents";
import { SkyOrb } from "@/components/ambient/SkyOrb";
import { SHOW_TIME_DEBUG_PANEL } from "@/lib/ambient";
import { useSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/training", label: "Training", icon: Dumbbell },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/review", label: "Weekly review", icon: ClipboardCheck },
];

const SETTINGS_ITEM = { to: "/settings", label: "Settings", icon: Settings };

/** Shared by both sidebar sizes: the icon keeps its exact place, only the label fades and is clipped. */
const ROW = "relative flex h-10 items-center gap-3 overflow-hidden rounded-full px-3.5 text-sm font-medium whitespace-nowrap outline-none";
const LABEL_FADE = "transition-opacity duration-200 ease-out motion-reduce:transition-none";

function NavItem({ to, label, icon: Icon, compact }: { to: string; label: string; icon: LucideIcon; compact: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
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
 * The lit slab behind the active page in the sidebar. It is measured from the active link and glides to
 * the next one when the page changes, so moving between pages reads as one continuous motion.
 */
function useActiveSlab(asideRef: React.RefObject<HTMLElement | null>, pathname: string) {
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
  }, [asideRef, pathname]);

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
  const { compact, setCompact } = useSidebar();
  const asideRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const { slab, placed } = useActiveSlab(asideRef, location.pathname);
  usePageEntrance(pageRef, location.pathname);

  const section = [...NAV_ITEMS, SETTINGS_ITEM].find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  )?.label;

  return (
    <div className="flex h-screen flex-col text-foreground">
      <SkyBackground />
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
                placed && "transition-[translate] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
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
          <nav aria-label="Main" className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} compact={compact} />
            ))}
          </nav>
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
        <TrayEvents />
        <Toaster />
        {SHOW_TIME_DEBUG_PANEL && <TimeOfDayDebugPanel />}
        {/* relative: keeps absolutely positioned content (screen-reader tables) inside this scroll area instead of stretching the whole window */}
        <main className="relative min-w-0 flex-1 overflow-y-auto rounded-2xl">
          {/* Keyed by route: a page that crashes shows a message, and opening another page recovers. */}
          <ErrorBoundary key={location.pathname}>
            <div ref={pageRef} className="px-1 pt-1 pb-6">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
