import { useEffect, useState } from "react";
import { AppWindow, Globe } from "lucide-react";
import type { ShortcutKind } from "@/lib/db/appShortcuts";
import { peekRefinedIcon, refineSiteIcon, type RefinedIcon } from "@/lib/siteIcon";
import { cn } from "@/lib/utils";

interface ShortcutIconProps {
  kind: ShortcutKind;
  icon: string | null;
  /** Lift a website's logo off the white square it came on (its own icon; not an image chosen by hand). */
  refine?: boolean;
  className?: string;
}

/** The website's logo, worked out once (see lib/siteIcon); null until it is ready. */
function useSiteLogo(icon: string | null, refine: boolean): RefinedIcon | null {
  const [logo, setLogo] = useState<{ for: string; value: RefinedIcon } | null>(null);
  useEffect(() => {
    if (!icon || !refine) return;
    let cancelled = false;
    void refineSiteIcon(icon).then((value) => {
      if (!cancelled) setLogo({ for: icon, value });
    });
    return () => {
      cancelled = true;
    };
  }, [icon, refine]);
  if (!icon) return null;
  if (!refine) return { src: icon, tone: null };
  return logo?.for === icon ? logo.value : (peekRefinedIcon(icon) ?? null);
}

/**
 * A shortcut's icon at tile size, the real logo standing on the glass. App icons come trimmed and squared
 * from Windows; a website's logo is lifted off any white square it was served on and trimmed the same
 * way, and a one-colour mark that a theme would swallow (a black mark on dark glass) is inverted there.
 * No icon: a generic glyph on a glass plate.
 */
export function ShortcutIcon({ kind, icon, refine = true, className }: ShortcutIconProps) {
  const logo = useSiteLogo(kind === "website" ? icon : null, refine);

  if (!icon) {
    const Glyph = kind === "website" ? Globe : AppWindow;
    return (
      <span
        aria-hidden="true"
        className={cn(
          "grid size-16 place-items-center rounded-[30%] glass-well text-foreground/55 shadow-[inset_0_1px_0_var(--glass-edge),0_6px_14px_-8px_rgb(2_4_18/0.55)] ring-1 ring-[var(--glass-rim)] ring-inset",
          className,
        )}
      >
        <Glyph className="size-[42%]" strokeWidth={1.6} />
      </span>
    );
  }

  const src = kind === "app" ? icon : logo?.src;
  return (
    <span aria-hidden="true" className={cn("grid size-16 place-items-center", className)}>
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn(
            "size-[88%] object-contain drop-shadow-[0_4px_6px_rgb(2_4_18/0.28)]",
            logo?.tone === "dark" && "dark:invert",
            logo?.tone === "light" && "invert dark:invert-0",
          )}
        />
      )}
    </span>
  );
}
