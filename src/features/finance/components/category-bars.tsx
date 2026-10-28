import { formatPercent } from "@/lib/format";
import { formatMoney, type Cents } from "@/lib/money";

export interface CategoryBarRow {
  key: string;
  label: string;
  cents: Cents;
}

/**
 * Magnitude by category: one series, so one hue (no legend; the card title names
 * it). Every value is printed at the bar tip, so the list doubles as its own table;
 * the tooltip only repeats it with the share of the total.
 */
export function CategoryBars({ rows, totalCents }: { rows: CategoryBarRow[]; totalCents: Cents }) {
  const max = Math.max(...rows.map((row) => row.cents), 1);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const share = formatPercent(totalCents > 0 ? row.cents / totalCents : null, { digits: 0 });
        return (
          <li key={row.key} title={`${row.label}: ${formatMoney(row.cents)} (${share} do total)`} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatMoney(row.cents)} <span className="text-xs font-normal text-muted-foreground">· {share}</span>
              </span>
            </div>
            <div className="h-2.5" aria-hidden>
              <div
                className="h-full rounded-r-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max((row.cents / max) * 100, 1)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
