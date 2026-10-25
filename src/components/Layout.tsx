import { NavLink, Outlet } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Home,
  Repeat,
  Settings,
  StickyNote,
  Timer,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { FocusTimerRunner } from "@/components/focus/FocusTimerRunner";
import { SidebarTimer } from "@/components/focus/SidebarTimer";
import { TrayEvents } from "@/components/TrayEvents";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/habits", label: "Habits", icon: Repeat },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/review", label: "Weekly review", icon: ClipboardCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r bg-card p-3">
        <div className="flex items-center gap-2 px-3 py-2 text-lg font-semibold">
          <img src={logo} alt="" className="size-6" />
          Daylight
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <SidebarTimer />
      </aside>
      <FocusTimerRunner />
      <TrayEvents />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
