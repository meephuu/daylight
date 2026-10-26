import { StarField } from "@/components/ambient/StarField";
import { ambientAt, starsAt, useAmbientMinutes, useAmbientPrefs } from "@/lib/ambient";

/**
 * A very blurry glow behind the whole app that follows the time of day: an orange circle at the
 * top left in the morning, a pale-blue ellipse at the top middle in the afternoon, a red-orange
 * circle at the top right in the evening. At night the glow gives way to twinkling stars.
 */
export function AmbientBackground() {
  const minutes = useAmbientMinutes();
  const glow = ambientAt(minutes);
  const nightStars = useAmbientPrefs((state) => state.nightStars);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Softer on the light theme, where a strong glow would look washed out. */}
      <div className="absolute inset-0 opacity-50 dark:opacity-100">
        <div
          className="absolute rounded-full"
          style={{
            left: `${glow.x}%`,
            top: `${glow.y}%`,
            width: `${glow.width}vw`,
            height: `${glow.height}vw`,
            transform: "translate(-50%, -50%)",
            backgroundColor: glow.color,
            opacity: glow.opacity,
            filter: "blur(clamp(70px, 8vw, 150px))",
            // Smooths the small steps of the real clock and the testing slider.
            transition: "left 500ms linear, top 500ms linear, width 500ms linear, height 500ms linear, background-color 500ms linear, opacity 500ms linear",
          }}
        />
      </div>
      <StarField visibility={nightStars ? starsAt(minutes) : 0} />
    </div>
  );
}
