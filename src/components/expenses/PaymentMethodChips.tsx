import { getCategoryIcon } from "@/lib/categoryIcons";
import type { PaymentMethod } from "@/lib/db/paymentMethods";
import { cn } from "@/lib/utils";

interface PaymentMethodChipsProps {
  methods: PaymentMethod[];
  value: number | null;
  /** Pressing the chosen chip again clears the choice (null). */
  onChange: (methodId: number | null) => void;
  className?: string;
}

/** Pick how an expense was paid; optional, so the chosen chip toggles off. */
export function PaymentMethodChips({ methods, value, onChange, className }: PaymentMethodChipsProps) {
  return (
    <div role="group" aria-label="Payment method" className={cn("flex flex-wrap gap-1.5", className)}>
      {methods.map((method) => {
        const selected = method.id === value;
        const Icon = getCategoryIcon(method.icon);
        return (
          <button
            key={method.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : method.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors outline-none",
              "hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/10 font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {method.name}
          </button>
        );
      })}
    </div>
  );
}
