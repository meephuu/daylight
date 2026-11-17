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

/** A titled slab holding a list of setting rows split by hairlines. */
function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="pane flex flex-col px-6 pt-5 pb-1.5">
      <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">{title}</h2>
      {description && <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground">{description}</p>}
      <div className="mt-2 flex flex-col divide-y divide-foreground/10">{children}</div>
    </section>
  );
}

/**
 * One setting: what it is and what it does on the left, its control on the right (stacked on narrow
 * windows). `htmlFor` ties the name to a switch, so clicking the name flips it.
 */
function SettingRow({
  label,
  description,
  htmlFor,
  control,
  children,
}: {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  control: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid items-center gap-x-8 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium">{label}</p>
        )}
        {description && <p className="mt-1 text-xs text-pretty text-muted-foreground">{description}</p>}
        {children}
      </div>
      <div className="flex sm:justify-end">{control}</div>
    </div>
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

      <SettingsSection title="Appearance">
        <SettingRow
          label="Theme"
          description="Light and Dark sit on the live sky. Black is Daylight 1.0: a plain black window."
          control={
            <Segmented
              aria-label="Theme"
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
          }
        />
        <SettingRow
          label="Display font"
          description="For the greeting, titles and big numbers. Everything else stays in the body font."
          control={
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
          }
        />
        <SettingRow
          label="Animations"
          description={
            motion === "system"
              ? systemReducesMotion()
                ? "Windows has animation effects turned off, so Daylight keeps still too. Choose On to animate Daylight anyway."
                : "Follows Windows: animation effects are on."
              : motion === "on"
                ? "Daylight animates even if Windows has animation effects turned off."
                : "Daylight keeps still: changes fade in briefly instead of moving."
          }
          control={
            <Segmented
              aria-label="Animations"
              value={motion}
              onChange={setMotion}
              options={[
                { value: "system", label: "Follow Windows" },
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
            />
          }
        />
        <SettingRow
          label="Small sidebar"
          htmlFor="small-sidebar"
          description="Shows only icons in a thin rail; hover an icon to see its name."
          control={<Switch id="small-sidebar" checked={compactSidebar} onCheckedChange={setCompactSidebar} />}
        />
      </SettingsSection>

      <SettingsSection title="Sky" description="Daylight paints the window with the real sky over Bangkok, hour by hour.">
        <SettingRow
          label="Today in Bangkok"
          description="The sky brightens and fades around these times."
          control={
            <p className="flex items-center gap-5 text-sm">
              <span className="flex items-center gap-1.5">
                <Sunrise className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Sunrise</span>
                <span className="font-semibold tabular-nums">{formatClock(sun.sunrise)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Sunset className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">Sunset</span>
                <span className="font-semibold tabular-nums">{formatClock(sun.sunset)}</span>
              </span>
            </p>
          }
        />
        <SettingRow
          label="Twinkling stars at night"
          htmlFor="night-stars"
          description="Turns only the stars on or off; the sky itself always follows the time of day."
          control={<Switch id="night-stars" checked={nightStars} onCheckedChange={setNightStars} />}
        />
      </SettingsSection>

      <SettingsSection title="Expenses">
        <SettingRow
          label="Categories"
          description="Add, rename, recolour, reorder or archive expense categories, and set a monthly budget for each."
          control={
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags className="size-4" />
              Manage categories
            </Button>
          }
        />
        <CategoryManagerDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />
      </SettingsSection>

      <SettingsSection title="Startup">
        <SettingRow
          label="Launch Daylight when I sign in to Windows"
          htmlFor="autostart"
          description="It starts hidden in the system tray. Click the tray icon to open it."
          control={
            <Switch
              id="autostart"
              checked={autostart.data ?? false}
              onCheckedChange={(checked) => setAutostart.mutate(checked)}
              disabled={autostart.isPending || setAutostart.isPending}
            />
          }
        >
          {(autostart.isError || setAutostart.isError) && (
            <p className="mt-1 text-xs text-destructive">
              Could not change the startup setting: {String(autostart.error ?? setAutostart.error)}
            </p>
          )}
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
