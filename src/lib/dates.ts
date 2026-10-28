/**
 * Calendar dates travel as ISO strings ("2026-10-23") and monthly competences
 * as the first day of the month ("2026-10-01"), exactly like the DATE columns
 * in Postgres. Avoiding `new Date("2026-10-23")` sidesteps UTC-shift bugs
 * (it would render as 22/10 in America/Recife).
 */
export type IsoDate = string;

export const DEFAULT_TIME_ZONE = "America/Recife";
const DEFAULT_LOCALE = "pt-BR";
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(value);
  if (!match) throw new RangeError("Expected a date in YYYY-MM-DD format");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError("Invalid calendar date");
  }
  return { year, month, day };
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's calendar date in the household's time zone. */
export function todayIn(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Hour of day (0-23) in the household's time zone. */
export function hourIn(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now));
}

export type PartOfDay = "morning" | "afternoon" | "evening";

export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** "2026-10-23" -> "23/10/2026" */
export function formatDate(value: IsoDate): string {
  const { year, month, day } = parseIsoDate(value);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function monthStart(value: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(value);
  return toIsoDate(year, month, 1);
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const { year, month } = parseIsoDate(value);
  const index = year * 12 + (month - 1) + months;
  return toIsoDate(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** "2026-10-01" -> "Outubro/2026" (long) or "Out/2026" (short). */
export function formatMonth(value: IsoDate, style: "long" | "short" = "long", locale = DEFAULT_LOCALE): string {
  const { year, month } = parseIsoDate(value);
  const name = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/\.$/, "");
  const label = style === "short" ? name.slice(0, 3) : name;
  return `${label.charAt(0).toLocaleUpperCase(locale)}${label.slice(1)}/${year}`;
}

/** Share of the month already elapsed, counting today (23 Oct -> 23/31). */
export function monthElapsedRatio(today: IsoDate): number {
  const { year, month, day } = parseIsoDate(today);
  return day / daysInMonth(year, month);
}

export type PeriodPreset =
  | "current_month"
  | "previous_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "current_year";

/** Inclusive range of monthly competences (first days of month). */
export interface MonthRange {
  from: IsoDate;
  to: IsoDate;
}

export function resolvePeriod(preset: PeriodPreset, today: IsoDate): MonthRange {
  const current = monthStart(today);
  switch (preset) {
    case "current_month":
      return { from: current, to: current };
    case "previous_month": {
      const previous = addMonths(current, -1);
      return { from: previous, to: previous };
    }
    case "last_3_months":
      return { from: addMonths(current, -2), to: current };
    case "last_6_months":
      return { from: addMonths(current, -5), to: current };
    case "last_12_months":
      return { from: addMonths(current, -11), to: current };
    case "current_year":
      return { from: toIsoDate(parseIsoDate(today).year, 1, 1), to: current };
  }
}

/** Every month in the range, oldest first. */
export function monthsInRange({ from, to }: MonthRange): IsoDate[] {
  const months: IsoDate[] = [];
  for (let month = monthStart(from); month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Same day `months` later, clamped to the month length (31/01 + 1 -> 28/02). */
export function addMonthsKeepingDay(value: IsoDate, months: number): IsoDate {
  const { day } = parseIsoDate(value);
  const target = parseIsoDate(addMonths(value, months));
  return toIsoDate(target.year, target.month, Math.min(day, daysInMonth(target.year, target.month)));
}

/** "2026-10" (URL form) -> "2026-10-01"; anything invalid falls back. */
export function parseMonthParam(value: unknown, fallback: IsoDate): IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return monthStart(fallback);
  try {
    return monthStart(`${value}-01`);
  } catch {
    return monthStart(fallback);
  }
}

/** "2026-10-01" -> "2026-10" (URL form). */
export function toMonthParam(value: IsoDate): string {
  return value.slice(0, 7);
}

/** List headers: "Hoje", "Ontem", otherwise "sex., 23/10". */
export function formatDayLabel(value: IsoDate, today: IsoDate, locale = DEFAULT_LOCALE): string {
  const { year, month, day } = parseIsoDate(value);
  const date = Date.UTC(year, month - 1, day);
  const todayParts = parseIsoDate(today);
  const diffDays = Math.round((Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day) - date) / 86_400_000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays === -1) return "Amanhã";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date);
  return `${weekday}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}
