/**
 * Money is stored and calculated as whole satang (1 baht = 100 satang), so sums never pick up
 * floating-point errors. Only these helpers turn it into text and back.
 */
const amountFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** 123400 -> "THB 1,234.00" (negative: "-THB 1,234.00"). */
export function formatTHB(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  return `${sign}THB ${amountFormat.format(Math.abs(satang) / 100)}`;
}

/** 1,284 / 12.9K - for chart labels, where space is tight (no currency prefix). */
export function formatCompactBaht(satang: number): string {
  return compactFormat.format(satang / 100);
}

/** 12345 -> "123.45": what goes into an amount field when editing (no thousands separators). */
export function satangToInput(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const AMOUNT_PATTERN = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;

/**
 * "1,234.50", "1234.5", "฿ 80" or "THB 80" -> satang. Returns null for anything that is not a valid
 * non-negative amount with at most two decimals, so a typo never turns into a different number.
 */
export function parseBahtToSatang(text: string): number | null {
  const cleaned = text.replace(/THB|฿/gi, "").replace(/\s/g, "");
  if (!AMOUNT_PATTERN.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.replace(/,/g, "").split(".");
  const satang = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(satang) ? satang : null;
}
