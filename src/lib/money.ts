/**
 * Money is handled as integer cents everywhere in TypeScript, mirroring the
 * NUMERIC(14,2) columns in Postgres. Floats only appear at the edges (parsing
 * DB numbers, Intl formatting) and are rounded immediately.
 */
export type Cents = number;

const DEFAULT_LOCALE = "pt-BR";
const DEFAULT_CURRENCY = "BRL";

/** Converts a DB numeric (number or "1234.56" string) to integer cents. */
export function toCents(value: number | string): Cents {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("Amount must be a finite number");
    return Math.round(value * 100);
  }
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError("Amount must be a decimal like 1234.56");
  const [, sign, units, fraction = ""] = match;
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -cents : cents;
}

/** Converts cents to the exact decimal string sent to Postgres ("1234.56"). */
export function toDecimalString(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "R$ 1.234,56" (with a non-breaking space, as Intl produces). */
export function formatMoney(
  cents: Cents,
  { locale = DEFAULT_LOCALE, currency = DEFAULT_CURRENCY }: { locale?: string; currency?: string } = {},
): string {
  assertCents(cents);
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Axis ticks: "R$ 5 mil", "R$ 1,2 mi". */
export function formatCompactMoney(cents: Cents, { locale = DEFAULT_LOCALE, currency = DEFAULT_CURRENCY } = {}): string {
  assertCents(cents);
  return new Intl.NumberFormat(locale, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(
    cents / 100,
  );
}

/**
 * Parses what a person types in a pt-BR money field into cents.
 *   "2700" -> 270000   "2.700" -> 270000   "2.700,50" -> 270050
 *   "85,9" -> 8590     "R$ 85,90" -> 8590  "85.90" -> 8590 (mobile keyboards)
 * Returns null when the text is not a valid non-negative amount.
 */
export function parseMoneyInput(input: string): Cents | null {
  const cleaned = input.replace(/R\$|\s| /g, "");
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let integerPart: string;
  let fractionPart = "";

  if (lastComma !== -1) {
    // Comma is the decimal separator; dots are thousands separators.
    if (cleaned.indexOf(",") !== lastComma || lastDot > lastComma) return null;
    integerPart = cleaned.slice(0, lastComma);
    fractionPart = cleaned.slice(lastComma + 1);
  } else if (lastDot !== -1 && cleaned.indexOf(".") === lastDot && cleaned.length - lastDot - 1 <= 2) {
    // A single dot followed by 1-2 digits reads as a decimal point.
    integerPart = cleaned.slice(0, lastDot);
    fractionPart = cleaned.slice(lastDot + 1);
  } else {
    integerPart = cleaned;
  }

  if (!isValidThousands(integerPart) || !/^\d{0,2}$/.test(fractionPart)) return null;
  const units = Number(integerPart.replace(/\./g, ""));
  if (!Number.isSafeInteger(units * 100)) return null;
  return units * 100 + Number(fractionPart.padEnd(2, "0"));
}

function isValidThousands(value: string): boolean {
  if (!value.includes(".")) return /^\d+$/.test(value);
  return /^\d{1,3}(\.\d{3})+$/.test(value);
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function assertCents(cents: Cents): void {
  if (!Number.isSafeInteger(cents)) throw new RangeError("Cents must be a safe integer");
}
