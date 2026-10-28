import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { addMonths, formatMonth, toMonthParam, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

interface MonthSwitcherProps {
  month: IsoDate;
  basePath: string;
  /** Other query params to keep while switching months (filters). */
  params?: Record<string, string | undefined>;
  className?: string;
}

function hrefFor(basePath: string, month: IsoDate, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  query.set("mes", toMonthParam(month));
  return `${basePath}?${query.toString()}`;
}

/** "‹ Outubro/2026 ›" — plain links, so it works before hydration and keeps history. */
export function MonthSwitcher({ month, basePath, params = {}, className }: MonthSwitcherProps) {
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const linkClass =
    "flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground";
  return (
    <nav aria-label="Mês" className={cn("flex items-center gap-1", className)}>
      <Link href={hrefFor(basePath, previous, params)} className={linkClass} aria-label={`Mês anterior: ${formatMonth(previous)}`}>
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold tabular-nums" aria-current="date">
        {formatMonth(month)}
      </span>
      <Link href={hrefFor(basePath, next, params)} className={linkClass} aria-label={`Próximo mês: ${formatMonth(next)}`}>
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </nav>
  );
}
