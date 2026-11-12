import logo from "@/assets/logo.png";
import { useAmbientMinutes } from "@/lib/ambient";
import { skyAt, sunTimes } from "@/lib/sky";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** The moon's colour: the logo's shading, washed in light purple. */
const MOON = "#cbbcff";

/**
 * The Daylight logo. By day it is the original artwork, untouched. After dark (once the sky is mostly
 * stars) it turns into a moon: the same shape and shading, recoloured light purple, with a soft glow.
 */
export function SkyOrb({ className }: { className?: string }) {
  const minutes = useAmbientMinutes();
  // The Black theme has no time of day, so the logo stays as it is.
  const black = useTheme((state) => state.theme === "black");
  const night = !black && skyAt(minutes, true, sunTimes()).stars > 0.5;

  if (!night) {
    return <img src={logo} alt="" aria-hidden="true" className={cn("block size-7 shrink-0", className)} />;
  }

  return (
    <span aria-hidden="true" className={cn("relative isolate block size-7 shrink-0", className)}>
      <img src={logo} alt="" className="absolute inset-0 size-full brightness-150 grayscale" />
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: MOON,
          mixBlendMode: "multiply",
          maskImage: `url(${logo})`,
          WebkitMaskImage: `url(${logo})`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      />
      <span className="absolute inset-0 -z-10 rounded-full" style={{ boxShadow: `0 0 12px 1px color-mix(in srgb, ${MOON} 55%, transparent)` }} />
    </span>
  );
}
