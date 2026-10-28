import { Lock, Repeat } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDayLabel, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatSignedAmount } from "../format";
import { KIND_TONE, STATUS_LABELS } from "../labels";
import type { FinanceOptions, TransactionItem } from "../queries";
import { CategoryIcon } from "./category-icon";
import { StatusToggle } from "./row-actions";

interface TransactionListProps {
  items: TransactionItem[];
  options: FinanceOptions;
  today: IsoDate;
  canEdit: boolean;
}

function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone === "muted" && "bg-surface-muted text-muted-foreground",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "danger" && "bg-expense-soft text-expense",
      )}
    >
      {children}
    </span>
  );
}

/** Movements grouped by day, newest first. Each row opens the edit screen. */
export function TransactionList({ items, options, today, canEdit }: TransactionListProps) {
  const categories = new Map(options.categories.map((category) => [category.id, category]));
  const members = new Map(options.members.map((member) => [member.id, member.name]));
  const methods = new Map(options.paymentMethods.map((method) => [method.id, method]));

  const days = new Map<IsoDate, TransactionItem[]>();
  for (const item of items) days.set(item.occurredOn, [...(days.get(item.occurredOn) ?? []), item]);

  return (
    <div className="flex flex-col gap-5">
      {[...days].map(([day, dayItems]) => (
        <section key={day} aria-labelledby={`dia-${day}`}>
          <h2 id={`dia-${day}`} className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {formatDayLabel(day, today)}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]">
            {dayItems.map((item) => {
              const category = item.categoryId ? categories.get(item.categoryId) : undefined;
              const method = item.paymentMethodId ? methods.get(item.paymentMethodId) : undefined;
              const meta = [
                category?.label ?? "Sem categoria",
                item.memberId ? members.get(item.memberId) : "Família",
                method?.name ?? null,
              ].filter(Boolean);
              const overdue = item.status === "pending" && item.kind === "expense" && (item.dueOn ?? item.occurredOn) < today;

              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <CategoryIcon icon={category?.icon} color={category?.color} />
                  <Link href={`/movimentacoes/${item.id}`} className="min-w-0 flex-1 rounded-lg outline-offset-4">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{item.description}</span>
                      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", KIND_TONE[item.kind])}>
                        {formatSignedAmount(item.kind, item.amountCents)}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="truncate">{meta.join(" · ")}</span>
                      {item.status === "pending" ? (
                        <Badge tone={overdue ? "danger" : "warning"}>
                          {overdue ? "Vencida" : STATUS_LABELS[item.kind].pending}
                        </Badge>
                      ) : null}
                      {item.installmentTotal ? (
                        <Badge>
                          {item.installmentNumber}/{item.installmentTotal}
                        </Badge>
                      ) : null}
                      {item.recurringRuleId ? (
                        <Badge>
                          <Repeat className="size-3" aria-hidden /> Recorrente
                        </Badge>
                      ) : null}
                      {item.isPrivate ? (
                        <Badge>
                          <Lock className="size-3" aria-hidden /> Privada
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                  {canEdit ? (
                    <StatusToggle id={item.id} status={item.status} paidLabel={STATUS_LABELS[item.kind].paid} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
