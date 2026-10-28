import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import type { BudgetStatus, BudgetUsage } from "@/features/finance/calculations";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

const STATUS: Record<BudgetStatus, { label: string; icon: LucideIcon; fill: string; ink: string }> = {
  on_track: { label: "No caminho", icon: CircleCheck, fill: "bg-chart-1", ink: "text-muted-foreground" },
  warning: { label: "Atenção", icon: TriangleAlert, fill: "bg-status-warning", ink: "text-warning" },
  exceeded: { label: "Estourou", icon: CircleAlert, fill: "bg-status-critical", ink: "text-expense" },
  no_budget: { label: "Sem plano", icon: CircleCheck, fill: "bg-chart-1", ink: "text-muted-foreground" },
};

/** Planned × spent meter: same-ramp track, fill by status, always with icon + label (never color alone). */
export function BudgetMeter({ usage, label, compact = false }: { usage: BudgetUsage; label: string; compact?: boolean }) {
  const status = STATUS[usage.status];
  const Icon = status.icon;
  const percent = usage.usageRatio === null ? null : Math.round(usage.usageRatio * 100);
  const width = Math.min(100, percent ?? (usage.spentCents > 0 ? 100 : 0));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatMoney(usage.spentCents)} de {formatMoney(usage.plannedCents)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label}: ${percent ?? 0}% do planejado`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent ?? 0, 100)}
        className="h-2 overflow-hidden rounded-full bg-chart-track"
      >
        <div className={cn("h-full rounded-full", status.fill)} style={{ width: `${width}%` }} />
      </div>
      {compact ? null : (
        <p className={cn("flex items-center gap-1.5 text-xs", status.ink)}>
          <Icon className="size-3.5" aria-hidden />
          {status.label}
          {percent !== null ? ` · ${percent}%` : ""}
          <span className="text-muted-foreground">
            {" · "}
            {usage.remainingCents >= 0
              ? `pode gastar ${formatMoney(usage.remainingCents)}`
              : `${formatMoney(-usage.remainingCents)} acima`}
          </span>
        </p>
      )}
    </div>
  );
}
