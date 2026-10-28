const DEFAULT_LOCALE = "pt-BR";

/** 0.6875 -> "68,8%"; null (no base, e.g. zero income) -> "—", never a fake 0% or ∞. */
export function formatPercent(value: number | null, { locale = DEFAULT_LOCALE, digits = 1 } = {}): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(value);
}
