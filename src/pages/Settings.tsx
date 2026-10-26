import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAutostart, useSetAutostart } from "@/hooks/useAutostart";
import { useAmbientPrefs } from "@/lib/ambient";
import { useTheme, type Theme } from "@/lib/theme";

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const nightStars = useAmbientPrefs((state) => state.nightStars);
  const setNightStars = useAmbientPrefs((state) => state.setNightStars);
  const autostart = useAutostart();
  const setAutostart = useSetAutostart();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Appearance</h2>
        <div className="mt-2 flex gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              onClick={() => setTheme(value)}
            >
              <Icon className="size-4" />
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Background</h2>
        <div className="mt-2 flex items-center gap-3">
          <Switch id="night-stars" checked={nightStars} onCheckedChange={setNightStars} />
          <Label htmlFor="night-stars">Show twinkling stars at night</Label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The background glow still follows the time of day; this only turns the night stars on or off.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Startup</h2>
        <div className="mt-2 flex items-center gap-3">
          <Switch
            id="autostart"
            checked={autostart.data ?? false}
            onCheckedChange={(checked) => setAutostart.mutate(checked)}
            disabled={autostart.isPending || setAutostart.isPending}
          />
          <Label htmlFor="autostart">Launch Daylight when I sign in to Windows</Label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          It starts hidden in the system tray. Click the tray icon to open it.
        </p>
        {(autostart.isError || setAutostart.isError) && (
          <p className="mt-1 text-xs text-destructive">
            Could not change the startup setting: {String(autostart.error ?? setAutostart.error)}
          </p>
        )}
      </section>
    </div>
  );
}
