import { useState, type ReactNode } from "react";
import { Circle, Monitor, Moon, Sun, Sunrise, Sunset, Tags, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { CategoryManagerDialog } from "@/components/expenses/CategoryManagerDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAutostart, useSetAutostart } from "@/hooks/useAutostart";
import { useAmbientPrefs } from "@/lib/ambient";
import { formatClock, sunTimes } from "@/lib/sky";
import { DISPLAY_FONTS, useDisplayFont } from "@/lib/font";
import { systemReducesMotion, useMotion } from "@/lib/motion";
import { useSidebar } from "@/lib/sidebar";
import { useTheme, type Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "black", label: "Black", icon: Circle },
];

function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="pane grid gap-4 p-6 md:grid-cols-[240px_1fr] md:gap-8">
      <div>
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preference: motion, setPreference: setMotion } = useMotion();
  const { font: displayFont, setFont: setDisplayFont } = useDisplayFont();
  const { compact: compactSidebar, setCompact: setCompactSidebar } = useSidebar();
  const nightStars = useAmbientPrefs((state) => state.nightStars);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const setNightStars = useAmbientPrefs((state) => state.setNightStars);
  const autostart = useAutostart();
  const setAutostart = useSetAutostart();
  const sun = sunTimes();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-3">
      <PageHeader title="Settings" summary="How Daylight looks, and what it does when Windows starts." />

      <SettingsSection title="Appearance" description="Light and Dark sit on the live sky. Black is Daylight 1.0: plain black with a soft glow that follows the day.">
        <Segmented
          aria-label="Theme"
          className="self-start"
          value={theme}
          onChange={setTheme}
          options={THEME_OPTIONS.map(({ value, label, icon: Icon }) => ({
            value,
            label: (
              <>
                <Icon className="size-4" />
                {label}
              </>
            ),
          }))}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-medium">Display font</span>
          <Segmented
            aria-label="Display font"
            value={displayFont}
            onChange={setDisplayFont}
            options={DISPLAY_FONTS.map(({ value, label, family }) => ({
              value,
              // Each name is set in its own face, so the choice shows what it looks like.
              label: (
                <span className="text-[17px] leading-none" style={{ fontFamily: family, fontWeight: value === "sora" ? 600 : 400 }}>
                  {label}
                </span>
              ),
            }))}
          />
        </div>
        <p className="text-xs text-muted-foreground">For the greeting, titles and big numbers. Everything else stays in the body font.</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-medium">Animations</span>
          <Segmented
            aria-label="Animations"
            size="sm"
            value={motion}
            onChange={setMotion}
            options={[
              { value: "system", label: "Follow Windows" },
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {motion === "system"
            ? systemReducesMotion()
              ? "Windows has animation effects turned off, so Daylight keeps still too. Choose On to animate Daylight anyway."
              : "Follows Windows: animation effects are on."
            : motion === "on"
              ? "Daylight animates even if Windows has animation effects turned off."
              : "Daylight keeps still: changes fade in briefly instead of moving."}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Switch id="small-sidebar" checked={compactSidebar} onCheckedChange={setCompactSidebar} />
          <Label htmlFor="small-sidebar">Small sidebar</Label>
        </div>
        <p className="text-xs text-muted-foreground">Shows only icons in a thin rail; hover an icon to see its name.</p>
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
          <Label htmlFor="autostart">Launch Daylight when I sign in to Windows</Label>
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
