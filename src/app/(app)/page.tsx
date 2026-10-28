import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  PartyPopper,
  Plus,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { MonthSwitcher } from "@/components/shell/month-switcher";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { can, firstName, getAppContext } from "@/features/auth/session";
import { budgetLines, byUrgency, foldTail, totalsByCategory, totalsByMember } from "@/features/finance/aggregations";
import { financeAlerts, type FinanceAlert } from "@/features/finance/alerts";
import { periodChange, summarizePeriod } from "@/features/finance/calculations";
import { CategoryBars } from "@/features/finance/components/category-bars";
import { StatTile } from "@/features/finance/components/stat-tile";
import { BudgetMeter } from "@/features/planning/components/budget-meter";
import { getBudget } from "@/features/planning/queries";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { ensureRecurringTransactions, getFinanceOptions, getTransactionsInRange } from "@/features/transactions/queries";
import {
  addMonths,
  DEFAULT_TIME_ZONE,
  formatMonth,
  hourIn,
  monthElapsedRatio,
  monthStart,
  parseMonthParam,
  partOfDay,
  toMonthParam,
  todayIn,
} from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { formatMoney } from "@/lib/money";

const GREETINGS = { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AlertRow({ icon: Icon, tone, children, href }: { icon: LucideIcon; tone: string; children: ReactNode; href: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-surface-muted">
        <Icon className={cn("size-5 shrink-0", tone)} aria-hidden />
        <span className="flex-1">{children}</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const [{ user, household }, params] = await Promise.all([getAppContext(), searchParams]);
  const timeZone = household?.timeZone ?? DEFAULT_TIME_ZONE;
  const today = todayIn(timeZone);

  const greeting = (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {GREETINGS[partOfDay(hourIn(timeZone))]}, {firstName(user.displayName)} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{household?.name ?? "Você ainda não faz parte de uma família"}</p>
    </header>
  );

  if (!household) {
    return (
      <div className="flex flex-col gap-6">
        {greeting}
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhuma família vinculada"
            description="Peça ao responsável pela família para adicionar você como membro."
          />
        </Card>
      </div>
    );
  }

  const month = parseMonthParam(params.mes, today);
  const isCurrentMonth = month === monthStart(today);
  const memberParam = typeof params.pessoa === "string" && UUID.test(params.pessoa) ? params.pessoa : null;

  await ensureRecurringTransactions(household.id);
  const [options, allEntries, budget] = await Promise.all([
    getFinanceOptions(household.id),
    getTransactionsInRange(household.id, { from: addMonths(month, -1), to: month }),
    getBudget(household.id, month),
  ]);

  const member = memberParam ? options.members.find((item) => item.id === memberParam) : undefined;
  const scoped = member ? allEntries.filter((item) => item.memberId === member.id) : allEntries;
  const entries = scoped.filter((item) => item.competenceMonth === month);
  const previous = scoped.filter((item) => item.competenceMonth !== month);

  const summary = summarizePeriod(entries);
  const realized = summarizePeriod(entries.filter((item) => item.status === "paid"));
  const previousExpense = summarizePeriod(previous).expenseCents;
  const expenseChange = periodChange(summary.expenseCents, previousExpense);
  const lines = member ? [] : byUrgency(budgetLines(budget.items, entries, options.categories));
  const alerts = financeAlerts(entries, lines, summary, today);
  const categories = new Map(options.categories.map((category) => [category.id, category]));
  const members = new Map(options.members.map((item) => [item.id, item.name]));

  const byCategory = totalsByCategory(entries, options.categories);
  const { top, otherCents } = foldTail(byCategory, 5);
  const categoryRows = [
    ...top.map((row) => ({
      key: row.categoryId ?? "none",
      label: row.categoryId ? (categories.get(row.categoryId)?.name ?? "Categoria") : "Sem categoria",
      cents: row.cents,
    })),
    ...(otherCents > 0 ? [{ key: "other", label: "Outras", cents: otherCents }] : []),
  ];
  const incomeByMember = [...totalsByMember(entries, "income")].sort((a, b) => b[1] - a[1]);
  const recent = [...entries]
    .filter((item) => item.occurredOn <= today)
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1))
    .slice(0, 5);

  const elapsed = Math.round(monthElapsedRatio(today) * 100);
  const monthName = formatMonth(month).split("/")[0];
  const listHref = `/movimentacoes?mes=${toMonthParam(month)}`;
  const personHref = (id: string | null) => {
    const query = new URLSearchParams({ mes: toMonthParam(month) });
    if (id) query.set("pessoa", id);
    return `/?${query.toString()}`;
  };

  function alertRow(alert: FinanceAlert) {
    switch (alert.type) {
      case "overdue_bills":
        return (
          <AlertRow key={alert.type} icon={CircleAlert} tone="text-expense" href={`${listHref}&tipo=expense&situacao=pending`}>
            {alert.count} {alert.count === 1 ? "conta vencida" : "contas vencidas"} · {formatMoney(alert.cents)}
          </AlertRow>
        );
      case "bills_due_soon":
        return (
          <AlertRow key={alert.type} icon={CalendarClock} tone="text-warning" href={`${listHref}&tipo=expense&situacao=pending`}>
            {alert.count} {alert.count === 1 ? "conta vence" : "contas vencem"} nos próximos {alert.days} dias ·{" "}
            {formatMoney(alert.cents)}
          </AlertRow>
        );
      case "budget_exceeded":
      case "budget_warning": {
        const names = alert.categoryIds.map((id) => categories.get(id)?.name ?? "Categoria").join(", ");
        return (
          <AlertRow
            key={alert.type}
            icon={alert.type === "budget_exceeded" ? CircleAlert : TriangleAlert}
            tone={alert.type === "budget_exceeded" ? "text-expense" : "text-warning"}
            href={`/planejamento?mes=${toMonthParam(month)}`}
          >
            {alert.type === "budget_exceeded" ? "Orçamento estourado" : "Perto do limite"}: {names}
          </AlertRow>
        );
      }
      case "negative_balance":
        return (
          <AlertRow key={alert.type} icon={CircleAlert} tone="text-expense" href={listHref}>
            O previsto do mês fecha {formatMoney(alert.cents)} no negativo
          </AlertRow>
        );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {params["bem-vindo"] ? (
        <Alert tone="info" className="animate-fade-in">
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4" aria-hidden /> Conta ativada! Bem-vindo ao Planejamento Financeiro.
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        {greeting}
        <MonthSwitcher month={month} basePath="/" params={{ pessoa: member?.id }} />
      </div>

      {options.members.length > 1 ? (
        <nav aria-label="Filtrar por pessoa" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ id: null, name: "Todos" }, ...options.members.filter((item) => item.active)].map((item) => {
            const active = (member?.id ?? null) === item.id;
            return (
              <Link
                key={item.id ?? "all"}
                href={personHref(item.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active ? "border-transparent bg-primary-solid text-primary-solid-foreground" : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          {member ? `Saldo de ${member.name} em ${monthName}` : `Saldo previsto de ${monthName}`}
        </p>
        <p className={cn("mt-1 text-5xl font-semibold tracking-tight", summary.balanceCents < 0 && "text-expense")}>
          {formatMoney(summary.balanceCents)}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Realizado até agora:{" "}
          {formatMoney(realized.balanceCents)}
        </p>
        {isCurrentMonth ? (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>
                {monthName} está {elapsed}% concluído
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-chart-track"
              role="progressbar"
              aria-label={`Progresso de ${monthName}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={elapsed}
            >
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${elapsed}%` }} />
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Receitas"
          marker="bg-income"
          value={formatMoney(summary.incomeCents)}
          detail={`${formatMoney(realized.incomeCents)} recebido`}
        />
        <StatTile
          label="Despesas"
          marker="bg-expense"
          value={formatMoney(summary.expenseCents)}
          detail={
            expenseChange === null
              ? `${formatMoney(realized.expenseCents)} pago`
              : `${expenseChange >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(expenseChange), { digits: 0 })} vs. ${formatMonth(addMonths(month, -1), "short").split("/")[0]}`
          }
        />
        <StatTile
          label="Investimentos"
          marker="bg-investment"
          value={formatMoney(summary.investmentCents)}
          detail={`${formatPercent(summary.investmentRate, { digits: 0 })} da renda`}
        />
        <StatTile
          label="Economia"
          value={formatMoney(summary.savingsCents)}
          detail={`Taxa de poupança: ${formatPercent(summary.savingsRate, { digits: 0 })}`}
        />
      </div>

      {alerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Atenção</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="flex flex-col">{alerts.map(alertRow)}</ul>
          </CardContent>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={member ? `Nada lançado para ${member.name} neste mês` : "Nenhuma movimentação neste mês"}
            description="Registre receitas e despesas para ver saldo, gastos por categoria e planejado × realizado."
            action={
              can(household, "finance.create") ? (
                <Link href="/movimentacoes/nova" className={buttonClasses()}>
                  <Plus className="size-4" aria-hidden /> Adicionar movimentação
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {categoryRows.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Despesas por categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars rows={categoryRows} totalCents={summary.expenseCents} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Planejado × realizado</CardTitle>
              <Link href={`/planejamento?mes=${toMonthParam(month)}`} className="text-sm font-medium text-primary">
                Ver tudo
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {member ? (
                <p className="text-sm text-muted-foreground">O planejamento é da família; volte para “Todos” para ver.</p>
              ) : lines.length > 0 ? (
                lines.slice(0, 4).map((line) => (
                  <BudgetMeter key={line.categoryId} usage={line} label={categories.get(line.categoryId)?.name ?? "Categoria"} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum orçamento definido para {monthName}.{" "}
                  <Link href={`/planejamento?mes=${toMonthParam(month)}`} className="font-medium text-primary">
                    Planejar agora
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {!member && incomeByMember.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Renda por pessoa</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {incomeByMember.map(([id, cents]) => (
                    <li key={id ?? "household"} className="flex justify-between gap-3">
                      <span>{id ? (members.get(id) ?? "Membro") : "Família"}</span>
                      <span className="tabular-nums">
                        {formatMoney(cents)}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {formatPercent(summary.incomeCents > 0 ? cents / summary.incomeCents : null, { digits: 0 })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {recent.length > 0 ? (
            <div className={cn(!member && incomeByMember.length > 0 ? "" : "lg:col-span-2")}>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-base font-semibold tracking-tight">Últimas movimentações</h2>
                <Link href={listHref} className="text-sm font-medium text-primary">
                  Ver todas
                </Link>
              </div>
              <TransactionList items={recent} options={options} today={today} canEdit={can(household, "finance.edit")} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
