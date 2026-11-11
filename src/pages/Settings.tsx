import { useState, type ReactNode } from "react";
import { Monitor, Moon, Sun, Sunrise, Sunset, Tags, type LucideIcon } from "lucide-react";
import { CategoryManagerDialog } from "@/components/expenses/CategoryManagerDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAutostart, useSetAutostart } from "@/hooks/useAutostart";
import { useAmbientPrefs } from "@/lib/ambient";
import { formatClock, sunTimes } from "@/lib/sky";
import { useTheme, type Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="glass grid gap-4 rounded-2xl p-5 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const nightStars = useAmbientPrefs((state) => state.nightStars);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const setNightStars = useAmbientPrefs((state) => state.setNightStars);
  const autostart = useAutostart();
  const setAutostart = useSetAutostart();
  const sun = sunTimes();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3">
      <h1 className="mb-1 text-[28px] leading-tight font-semibold tracking-[-0.025em]">Settings</h1>

      <SettingsSection title="Appearance" description="Glass and ink for dark or light; the sky follows the clock either way.">
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Sky" description="Daylight paints the window with the real sky over Bangkok, hour by hour.">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5">
            <Sunrise className="size-4 text-muted-foreground" />
            Sunrise today <span className="font-semibold tabular-nums">{formatClock(sun.sunrise)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Sunset className="size-4 text-muted-foreground" />
            Sunset <span className="font-semibold tabular-nums">{formatClock(sun.sunset)}</span>
          </span>
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Switch id="night-stars" checked={nightStars} onCheckedChange={setNightStars} />
          <Label htmlFor="night-stars">Show twinkling stars at night</Label>
        </div>
        <p className="text-xs text-muted-foreground">Turns only the stars on or off; the sky itself always follows the time of day.</p>
      </SettingsSection>

      <SettingsSection title="Expenses">
        <div>
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            <Tags className="size-4" />
            Manage categories
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Add, rename, recolour, reorder or archive expense categories, and set a monthly budget for each.
        </p>
        <CategoryManagerDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      </SettingsSection>

      <SettingsSection title="Startup">
        <div className="flex items-center gap-3">
          <Switch
            id="autostart"
            checked={autostart.data ?? false}
            onCheckedChange={(checked) => setAutostart.mutate(checked)}
            disabled={autostart.isPending || setAutostart.isPending}
          />
          <Label htmlFor="autostart">Launch Daylight 2.0 when I sign in to Windows</Label>
        </div>
        <p className="text-xs text-muted-foreground">It starts hidden in the system tray. Click the tray icon to open it.</p>
        {(autostart.isError || setAutostart.isError) && (
          <p className="text-xs text-destructive">
            Could not change the startup setting: {String(autostart.error ?? setAutostart.error)}
          </p>
        )}
      </SettingsSection>
    </div>
  );
}
