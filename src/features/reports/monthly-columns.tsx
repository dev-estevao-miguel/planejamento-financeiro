import { formatMonth, type IsoDate } from "@/lib/dates";
import { formatCompactMoney, formatMoney, type Cents } from "@/lib/money";

interface MonthlyColumnsProps {
  months: { month: IsoDate; incomeCents: Cents; expenseCents: Cents }[];
}

const SERIES = [
  { key: "incomeCents", label: "Receitas", fill: "bg-chart-1" },
  { key: "expenseCents", label: "Despesas", fill: "bg-chart-2" },
] as const;

const PLOT_HEIGHT = 160;

/** Round the axis top up to 1 / 2 / 5 × 10^n so ticks are clean numbers. */
function niceMax(value: Cents): Cents {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * Income × expense per month: two series (validated categorical slots 1-2),
 * legend always on, one tooltip per month listing both values, and the same
 * numbers in a table view.
 */
export function MonthlyColumns({ months }: MonthlyColumnsProps) {
  const top = niceMax(Math.max(...months.flatMap((month) => [month.incomeCents, month.expenseCents]), 0));
  const ticks = [top, top / 2, 0];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">Receitas e despesas por mês</figcaption>
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legenda">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2.5 rounded-[3px] ${series.fill}`} />
            {series.label}
          </li>
        ))}
      </ul>

      <div className="flex gap-2" aria-hidden>
        <div className="flex flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {formatCompactMoney(Math.round(tick))}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex items-end border-b border-chart-grid" style={{ height: PLOT_HEIGHT }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-chart-grid" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-chart-grid" />
            {months.map((month) => (
              <div
                key={month.month}
                tabIndex={0}
                className="group relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md outline-none hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60"
              >
                {SERIES.map((series) => (
                  <div
                    key={series.key}
                    className={`w-full max-w-[24px] rounded-t-[4px] ${series.fill}`}
                    style={{ height: `${(month[series.key] / top) * 100}%`, minHeight: month[series.key] > 0 ? 2 : 0 }}
                  />
                ))}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-[var(--shadow-float)] group-hover:block group-focus-visible:block">
                  <p className="mb-1 font-medium">{formatMonth(month.month)}</p>
                  {SERIES.map((series) => (
                    <p key={series.key} className="flex items-center gap-2">
                      <span className={`h-0.5 w-3 rounded ${series.fill}`} />
                      <strong className="tabular-nums">{formatMoney(month[series.key])}</strong>
                      <span className="text-muted-foreground">{series.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex">
            {months.map((month) => (
              <span key={month.month} className="flex-1 truncate pt-1.5 text-center text-[11px] text-muted-foreground">
                {formatMonth(month.month, "short").split("/")[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver tabela</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-medium">Mês</th>
              <th className="py-1 text-right font-medium">Receitas</th>
              <th className="py-1 text-right font-medium">Despesas</th>
              <th className="py-1 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {months.map((month) => (
              <tr key={month.month} className="border-t border-border">
                <td className="py-1.5">{formatMonth(month.month)}</td>
                <td className="py-1.5 text-right">{formatMoney(month.incomeCents)}</td>
                <td className="py-1.5 text-right">{formatMoney(month.expenseCents)}</td>
                <td className="py-1.5 text-right">{formatMoney(month.incomeCents - month.expenseCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
