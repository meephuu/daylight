import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Dumbbell,
  Home,
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
import logo from "@/assets/logo.png";
import { SHOW_TIME_DEBUG_PANEL } from "@/lib/ambient";
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

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "group/nav relative flex h-9 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-[background-color,color,box-shadow] duration-150",
          "focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive
            ? "bg-white/75 text-foreground shadow-[inset_0_1px_0_var(--glass-edge),inset_0_0_0_1px_color-mix(in_srgb,var(--sky-accent)_45%,transparent),0_2px_10px_-6px_rgb(0_0_0/0.3)] dark:bg-white/[0.14]"
            : "text-foreground/70 hover:bg-white/40 hover:text-foreground dark:hover:bg-white/[0.07]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-[17px] shrink-0 transition-colors",
              isActive ? "text-sky-accent" : "text-foreground/55 group-hover/nav:text-foreground/80",
            )}
            strokeWidth={isActive ? 2.25 : 2}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const location = useLocation();
  const section = [...NAV_ITEMS, SETTINGS_ITEM].find((item) =>
    item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to),
  )?.label;

  return (
    <div className="flex h-screen flex-col text-foreground">
      <SkyBackground />
      <TitleBar section={section} />
      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <aside className="glass flex w-[212px] shrink-0 flex-col rounded-2xl p-2.5">
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4">
            <img src={logo} alt="" className="size-7 drop-shadow-[0_2px_6px_rgb(0_0_0/0.25)]" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Daylight</span>
            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[11px] font-semibold text-foreground/75 tabular-nums">
              2.0
            </span>
          </div>
          <nav aria-label="Main" className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="mt-auto border-t border-foreground/10 pt-2">
            <NavItem {...SETTINGS_ITEM} />
          </div>
        </aside>
        <TrayEvents />
        <Toaster />
        {SHOW_TIME_DEBUG_PANEL && <TimeOfDayDebugPanel />}
        {/* relative: keeps absolutely positioned content (screen-reader tables) inside this scroll area instead of stretching the whole window */}
        <main className="relative min-w-0 flex-1 overflow-y-auto rounded-2xl">
          {/* Keyed by route: a page that crashes shows a message, and opening another page recovers.
              The wrapper settles in once whenever a page opens. */}
          <ErrorBoundary key={location.pathname}>
            <div className="page-settle px-1 pt-1 pb-6">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
