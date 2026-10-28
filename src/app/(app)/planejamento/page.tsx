import type { Metadata } from "next";
import { Target, Users } from "lucide-react";
import { MonthSwitcher } from "@/components/shell/month-switcher";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { can, getAppContext } from "@/features/auth/session";
import { budgetLines, byUrgency, totalsByCategory } from "@/features/finance/aggregations";
import { ratio, summarizePeriod } from "@/features/finance/calculations";
import { StatTile } from "@/features/finance/components/stat-tile";
import { BudgetForm, type BudgetFormRow } from "@/features/planning/components/budget-form";
import { BudgetMeter } from "@/features/planning/components/budget-meter";
import { getBudget } from "@/features/planning/queries";
import { ensureRecurringTransactions, getFinanceOptions, getTransactionsInRange } from "@/features/transactions/queries";
import { parseMonthParam, todayIn } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Planejamento" };

export default async function PlanningPage({ searchParams }: PageProps<"/planejamento">) {
  const [{ household }, params] = await Promise.all([getAppContext(), searchParams]);
  if (!household) {
    return (
      <Card>
        <EmptyState icon={Users} title="Nenhuma família vinculada" description="Peça ao responsável para adicionar você." />
      </Card>
    );
  }

  const today = todayIn(household.timeZone);
  const month = parseMonthParam(params.mes, today);
  await ensureRecurringTransactions(household.id);
  const [options, entries, budget] = await Promise.all([
    getFinanceOptions(household.id),
    getTransactionsInRange(household.id, { from: month, to: month }),
    getBudget(household.id, month),
  ]);

  const summary = summarizePeriod(entries);
  const plannedTotal = budget.items.reduce((sum, item) => sum + item.plannedCents, 0);
  const lines = byUrgency(budgetLines(budget.items, entries, options.categories));
  const categories = new Map(options.categories.map((category) => [category.id, category]));
  const plannedIds = new Set(budget.items.map((item) => item.categoryId));
  const spent = totalsByCategory(entries, options.categories);
  const spentById = new Map(spent.map((row) => [row.categoryId, row.cents]));
  const unplanned = spent.filter((row) => row.categoryId === null || !plannedIds.has(row.categoryId));
  const canManage = can(household, "planning.manage");

  const formRows: BudgetFormRow[] = options.categories
    .filter((category) => category.kind === "expense" && category.parentId === null)
    .filter((category) => !category.archived || plannedIds.has(category.id))
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      plannedCents: budget.items.find((item) => item.categoryId === category.id)?.plannedCents ?? 0,
      spentCents: spentById.get(category.id) ?? 0,
    }));

  return (
    <>
      <PageHeader title="Planejamento" description="Quanto a família pretende gastar em cada categoria." />
      <div className="flex flex-col gap-5">
        <MonthSwitcher month={month} basePath="/planejamento" className="self-center sm:self-start" />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Renda prevista" marker="bg-income" value={formatMoney(summary.incomeCents)} />
          <StatTile
            label="Total planejado"
            value={formatMoney(plannedTotal)}
            detail={`${formatPercent(ratio(plannedTotal, summary.incomeCents))} da renda`}
          />
          <StatTile
            label="Gasto no mês"
            marker="bg-expense"
            value={formatMoney(summary.expenseCents)}
            detail="Inclui contas pendentes do mês"
          />
          <StatTile
            label="Saldo previsto"
            value={formatMoney(summary.balanceCents)}
            detail="Receitas − despesas − investimentos"
          />
        </div>

        {lines.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Planejado × realizado</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {lines.map((line) => (
                <BudgetMeter key={line.categoryId} usage={line} label={categories.get(line.categoryId)?.name ?? "Categoria"} />
              ))}
            </CardContent>
          </Card>
        ) : null}

        {unplanned.length > 0 && lines.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Fora do planejamento</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {unplanned.map((row) => (
                  <li key={row.categoryId ?? "none"} className="flex justify-between gap-3">
                    <span>{row.categoryId ? (categories.get(row.categoryId)?.name ?? "Categoria") : "Sem categoria"}</span>
                    <span className="tabular-nums">{formatMoney(row.cents)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Orçamento por categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetForm month={month} rows={formRows} canCopy={budget.items.length === 0} />
            </CardContent>
          </Card>
        ) : lines.length === 0 ? (
          <Card>
            <EmptyState
              icon={Target}
              title="Nenhum planejamento para este mês"
              description="Quem administra a família define quanto pretende gastar em cada categoria."
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
