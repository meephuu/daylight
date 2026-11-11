import { forwardRef, useState } from "react";
import { Search, X } from "lucide-react";
import { OptionSelect } from "@/components/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/db/categories";
import type { PaymentMethod } from "@/lib/db/paymentMethods";
import { hasActiveFilters, type ExpenseFilters, type SortKey } from "@/lib/expenses";
import { parseBahtToSatang, satangToInput } from "@/lib/money";

interface ExpenseFilterBarProps {
  filters: ExpenseFilters;
  onChange: (filters: ExpenseFilters) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onClear: () => void;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Highest amount" },
  { value: "amount-asc", label: "Lowest amount" },
];

/** A THB amount box that keeps what is typed and reports a number once it is valid (or null when empty). */
function AmountBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : satangToInput(value));
  const parsed = text.trim() === "" ? null : parseBahtToSatang(text);
  const invalid = text.trim() !== "" && parsed === null;

  return (
    <Input
      value={text}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const result = next.trim() === "" ? null : parseBahtToSatang(next);
        if (next.trim() === "" || result !== null) onChange(result);
      }}
      inputMode="decimal"
      placeholder={label}
      aria-label={label}
      aria-invalid={invalid}
      autoComplete="off"
      className="w-28"
    />
  );
}

export const SearchBox = forwardRef<HTMLInputElement, { value: string; onChange: (value: string) => void }>(
  function SearchBox({ value, onChange }, ref) {
    return (
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search notes, categories, amounts…   ( / )"
          aria-label="Search transactions"
          autoComplete="off"
          className="pr-8 pl-8"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  },
);

export const ExpenseFilterBar = forwardRef<HTMLInputElement, ExpenseFilterBarProps>(function ExpenseFilterBar(
  { filters, onChange, sort, onSortChange, categories, paymentMethods, onClear },
  searchRef,
) {
  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...categories.map((category) => ({ value: String(category.id), label: category.archived ? `${category.name} (archived)` : category.name })),
  ];
  const methodOptions = [
    { value: "all", label: "Any payment method" },
    { value: "none", label: "No payment method" },
    ...paymentMethods.map((method) => ({ value: String(method.id), label: method.name })),
  ];
  const methodValue = filters.paymentMethod === null ? "all" : String(filters.paymentMethod);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox ref={searchRef} value={filters.search} onChange={(search) => onChange({ ...filters, search })} />
      <OptionSelect
        className="w-44"
        value={filters.categoryId === null ? "all" : String(filters.categoryId)}
        onChange={(value) => onChange({ ...filters, categoryId: value === "all" ? null : Number(value) })}
        options={categoryOptions}
      />
      <OptionSelect
        className="w-48"
        value={methodValue}
        onChange={(value) =>
          onChange({ ...filters, paymentMethod: value === "all" ? null : value === "none" ? "none" : Number(value) })
        }
        options={methodOptions}
      />
      <AmountBox label="Min THB" value={filters.minSatang} onChange={(minSatang) => onChange({ ...filters, minSatang })} />
      <AmountBox label="Max THB" value={filters.maxSatang} onChange={(maxSatang) => onChange({ ...filters, maxSatang })} />
      <OptionSelect className="w-40" value={sort} onChange={(value) => onSortChange(value as SortKey)} options={SORT_OPTIONS} />
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
});
