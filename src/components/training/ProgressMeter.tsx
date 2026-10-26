interface ProgressMeterProps {
  value: number;
  max: number;
  label: string;
  className?: string;
}

/** Thin meter: chart-blue fill on a pale wash of the same blue. */
export function ProgressMeter({ value, max, label, className }: ProgressMeterProps) {
  const percent = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`h-2 overflow-hidden rounded-full ${className ?? ""}`}
      style={{ backgroundColor: "color-mix(in srgb, var(--viz-bar) 18%, transparent)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${percent}%`, backgroundColor: "var(--viz-bar)" }}
      />
    </div>
  );
}
