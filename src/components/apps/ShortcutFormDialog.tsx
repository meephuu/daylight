import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { AppWindow, FolderOpen, Globe, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { InstalledAppPicker } from "@/components/apps/InstalledAppPicker";
import { ShortcutIcon } from "@/components/apps/ShortcutIcon";
import { OptionSelect } from "@/components/OptionSelect";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInstalledBrowsers, useSaveShortcut } from "@/hooks/useAppShortcuts";
import { SHORTCUT_KINDS, type AppShortcut, type IconSource, type ShortcutKind } from "@/lib/db/appShortcuts";
import { BROWSERS, fetchIconFor, normalizeUrl, readImageFile, type InstalledApp } from "@/lib/launcher";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const NAME_MAX = 40;

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Give the shortcut a name.").max(NAME_MAX, `Keep the name to ${NAME_MAX} characters.`),
    kind: z.enum(SHORTCUT_KINDS),
    appTarget: z.string(),
    url: z.string(),
    browser: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.kind === "app" && !values.appTarget.trim()) {
      ctx.addIssue({ code: "custom", path: ["appTarget"], message: "Choose an app from the list, or Browse for a program." });
    }
    if (values.kind === "website") {
      if (!values.url.trim()) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Enter the site's address, like https://github.com." });
      } else if (!normalizeUrl(values.url)) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "That isn't a web address. Try one like https://github.com." });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

/** Where the shortcut's icon stands: taken from the app / site (looked up as the target changes) or chosen by hand. */
interface IconState {
  source: IconSource;
  icon: string | null;
  /** The target the automatic icon belongs to; "" when there is nothing to look up yet. */
  for: string;
  loading: boolean;
}

interface ShortcutFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shortcut to edit; null to add one. */
  shortcut: AppShortcut | null;
  /** A name to start a new shortcut with (from a search that found nothing). */
  initialName?: string;
  onSaved?: (id: number) => void;
}

export function ShortcutFormDialog({ open, onOpenChange, shortcut, initialName, onSaved }: ShortcutFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{shortcut ? "Edit shortcut" : "New shortcut"}</DialogTitle>
        </DialogHeader>
        <ShortcutForm
          shortcut={shortcut}
          initialName={initialName ?? ""}
          onDone={(id) => {
            if (id !== undefined) onSaved?.(id);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function ShortcutForm({ shortcut, initialName, onDone }: { shortcut: AppShortcut | null; initialName: string; onDone: (id?: number) => void }) {
  const save = useSaveShortcut();
  const browsers = useInstalledBrowsers();
  const nameTouched = useRef(Boolean(shortcut) || Boolean(initialName));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: shortcut?.name ?? initialName,
      kind: shortcut?.kind ?? "app",
      appTarget: shortcut?.kind === "app" ? shortcut.target : "",
      url: shortcut?.kind === "website" ? shortcut.target : "",
      browser: shortcut?.browser ?? "default",
    },
  });

  const kind = useWatch({ control, name: "kind" });
  const appTarget = useWatch({ control, name: "appTarget" });
  const url = useWatch({ control, name: "url" });
  const name = useWatch({ control, name: "name" });

  // What the automatic icon is looked up from: the chosen app, or the address once it is a valid one.
  const lookup = kind === "app" ? appTarget.trim() : (normalizeUrl(url) ?? "");
  const lookupKey = lookup ? `${kind}|${lookup}` : "";

  const [iconState, setIconState] = useState<IconState>(() => ({
    source: shortcut?.iconSource ?? "auto",
    icon: shortcut?.icon ?? null,
    for: shortcut ? `${shortcut.kind}|${shortcut.target}` : "",
    loading: false,
  }));

  // Look the icon up again whenever the target changes (typing an address waits for a pause).
  useEffect(() => {
    if (iconState.source !== "auto" || lookupKey === iconState.for) return;
    if (!lookupKey) {
      setIconState((state) => ({ ...state, icon: null, for: "", loading: false }));
      return;
    }
    let cancelled = false;
    setIconState((state) => ({ ...state, loading: true }));
    const timer = window.setTimeout(
      () => {
        void fetchIconFor(kind, lookup).then((icon) => {
          if (!cancelled) setIconState({ source: "auto", icon, for: lookupKey, loading: false });
        });
      },
      kind === "website" ? 700 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [lookupKey, kind, lookup, iconState.source, iconState.for]);

  const browserOptions = useMemo(() => {
    const installed = new Set(browsers.data ?? []);
    const current = getValues("browser");
    return BROWSERS.filter((browser) => browser.id === "default" || installed.has(browser.id) || browser.id === current).map((browser) => ({
      value: browser.id,
      label: browser.id !== "default" && browsers.isSuccess && !installed.has(browser.id) ? `${browser.label} (not found)` : browser.label,
    }));
  }, [browsers.data, browsers.isSuccess, getValues]);

  function pickApp(app: InstalledApp) {
    setValue("appTarget", app.target, { shouldValidate: true });
    if (!nameTouched.current || !getValues("name").trim()) {
      setValue("name", app.name.replace(/\.(exe|lnk)$/i, "").slice(0, NAME_MAX), { shouldValidate: true });
    }
  }

  async function browseForProgram() {
    const path = await openFileDialog({
      title: "Choose a program or shortcut",
      multiple: false,
      directory: false,
      filters: [{ name: "Programs and shortcuts", extensions: ["exe", "lnk"] }],
    }).catch(() => null);
    if (typeof path !== "string") return;
    pickApp({ name: path.split(/[\\/]/).pop() ?? path, target: path });
  }

  async function chooseImage() {
    const path = await openFileDialog({
      title: "Choose an icon",
      multiple: false,
      directory: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "exe", "lnk"] }],
    }).catch(() => null);
    if (typeof path !== "string") return;
    try {
      const icon = await readImageFile(path);
      setIconState({ source: "custom", icon, for: "", loading: false });
    } catch (error) {
      showToast({ message: String(error instanceof Error ? error.message : error) });
    }
  }

  function resetIcon() {
    setIconState({ source: "auto", icon: null, for: "", loading: false });
  }

  async function onSubmit(values: FormValues) {
    const target = values.kind === "app" ? values.appTarget.trim() : (normalizeUrl(values.url) as string);
    const key = `${values.kind}|${target}`;
    const autoReady = iconState.source === "auto" && iconState.for === key && !iconState.loading;
    const id = await save.mutateAsync({
      id: shortcut?.id,
      input: {
        name: values.name.trim(),
        kind: values.kind,
        target,
        browser: values.kind === "website" ? values.browser : "default",
        icon: iconState.source === "custom" || autoReady ? iconState.icon : null,
        iconSource: iconState.source,
      },
      iconPending: iconState.source === "auto" && !autoReady,
    });
    onDone(id);
  }

  const iconNote =
    iconState.source === "custom"
      ? "Your image"
      : iconState.loading
        ? kind === "website"
          ? "Looking for the site's icon"
          : "Getting the app's icon"
        : !lookup
          ? kind === "website"
            ? "The site's icon, once there's an address"
            : "The app's icon, once you choose one"
          : iconState.icon
            ? kind === "website"
              ? "From the site"
              : "From the app"
            : kind === "website"
              ? "The site has no icon to use"
              : "The app has no icon to use";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      {/* The tile as it will look in the grid, beside its name. */}
      <div className="flex items-start gap-4">
        <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 rounded-[20px] glass-well px-2 pt-3 pb-2">
          <span className="relative">
            <ShortcutIcon kind={kind} icon={iconState.icon} refine={iconState.source === "auto"} className={cn(iconState.loading && "opacity-50")} />
            {iconState.loading && (
              <Loader2 className="absolute inset-0 m-auto size-5 animate-spin text-foreground/70" aria-hidden="true" />
            )}
          </span>
          <span className="line-clamp-2 w-full text-center text-[12px] leading-tight font-medium break-words">{name.trim() || "Name"}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="shortcut-name">Name</Label>
          <Input
            id="shortcut-name"
            autoFocus
            maxLength={NAME_MAX + 10}
            placeholder={kind === "website" ? "GitHub" : "Photoshop"}
            aria-invalid={errors.name ? true : undefined}
            {...register("name", { onChange: () => (nameTouched.current = true) })}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
            <span className="mr-1 text-xs text-muted-foreground" aria-live="polite">
              {iconNote}
            </span>
            <Button type="button" variant="ghost" size="xs" onClick={chooseImage}>
              <ImagePlus aria-hidden="true" />
              Choose image
            </Button>
            {iconState.source === "custom" && (
              <Button type="button" variant="ghost" size="xs" onClick={resetIcon}>
                <RotateCcw aria-hidden="true" />
                {kind === "website" ? "Use site icon" : "Use app icon"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Type</Label>
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Segmented<ShortcutKind>
              aria-label="Type of shortcut"
              value={field.value}
              onChange={field.onChange}
              className="self-start"
              options={[
                { value: "app", label: <><AppWindow className="size-4" aria-hidden="true" />App</> },
                { value: "website", label: <><Globe className="size-4" aria-hidden="true" />Website</> },
              ]}
            />
          )}
        />
      </div>

      {kind === "app" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="shortcut-app">App</Label>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="appTarget"
              render={({ field }) => (
                <InstalledAppPicker id="shortcut-app" value={field.value} onChange={pickApp} invalid={Boolean(errors.appTarget)} />
              )}
            />
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={browseForProgram}>
              <FolderOpen aria-hidden="true" />
              Browse
            </Button>
          </div>
          {errors.appTarget ? (
            <p className="text-xs text-destructive">{errors.appTarget.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Any app in Start, or a program (.exe) or shortcut (.lnk) you browse for.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="shortcut-url">Address</Label>
            <Input
              id="shortcut-url"
              inputMode="url"
              spellCheck={false}
              placeholder="https://github.com"
              aria-invalid={errors.url ? true : undefined}
              {...register("url", {
                onBlur: (event) => {
                  const normal = normalizeUrl(event.target.value);
                  if (normal && normal !== event.target.value) setValue("url", normal, { shouldValidate: true });
                },
              })}
            />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Open in</Label>
            <Controller
              control={control}
              name="browser"
              render={({ field }) => <OptionSelect value={field.value} onChange={field.onChange} options={browserOptions} />}
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {shortcut ? "Save" : "Add shortcut"}
        </Button>
      </DialogFooter>
    </form>
  );
}
