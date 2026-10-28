import type { Metadata } from "next";
import Link from "next/link";
import { Bot, ChartPie, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAppContext } from "@/features/auth/session";
import { foldTail } from "@/features/finance/aggregations";
import { CategoryBars } from "@/features/finance/components/category-bars";
import { StatTile } from "@/features/finance/components/stat-tile";
import { MonthlyColumns } from "@/features/reports/monthly-columns";
import { buildPeriodReport } from "@/features/reports/period-report";
import { ensureRecurringTransactions, getFinanceOptions, getTransactionsInRange } from "@/features/transactions/queries";
import { formatMonth, monthsInRange, resolvePeriod, todayIn, type PeriodPreset } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Relatórios" };

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "current_month", label: "Este mês" },
  { value: "last_3_months", label: "3 meses" },
  { value: "last_6_months", label: "6 meses" },
  { value: "last_12_months", label: "12 meses" },
  { value: "current_year", label: "Este ano" },
];

export default async function ReportsPage({ searchParams }: PageProps<"/relatorios">) {
  const [{ household }, params] = await Promise.all([getAppContext(), searchParams]);
  if (!household) {
    return (
      <Card>
        <EmptyState icon={Users} title="Nenhuma família vinculada" description="Peça ao responsável para adicionar você." />
      </Card>
    );
  }

  const preset = PRESETS.find((item) => item.value === params.periodo)?.value ?? "last_6_months";
  const today = todayIn(household.timeZone);
  const range = resolvePeriod(preset, today);
  const months = monthsInRange(range);

  await ensureRecurringTransactions(household.id);
  const [options, entries] = await Promise.all([getFinanceOptions(household.id), getTransactionsInRange(household.id, range)]);
  const report = buildPeriodReport(entries, months, options.categories);
  const members = new Map(options.members.map((member) => [member.id, member.name]));
  const { top, otherCents } = foldTail(report.categories, 7);
  const categoryRows = [
    ...top.map((row) => ({ key: row.categoryId ?? "none", label: row.name, cents: row.cents })),
    ...(otherCents > 0 ? [{ key: "other", label: "Outras", cents: otherCents }] : []),
  ];
  const periodText = range.from === range.to ? formatMonth(range.from) : `${formatMonth(range.from)} a ${formatMonth(range.to)}`;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`Para onde o dinheiro vai · ${periodText}`}
        action={
          <Link href={`/relatorios/exportar-ia?periodo=${preset}`} className={buttonClasses({ variant: "secondary" })}>
            <Bot className="size-4" aria-hidden /> Exportar para IA
          </Link>
        }
      />

      <div className="flex flex-col gap-6">
        <nav aria-label="Período" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PRESETS.map((item) => (
            <Link
              key={item.value}
              href={`/relatorios?periodo=${item.value}`}
              aria-current={item.value === preset ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                item.value === preset
                  ? "border-transparent bg-primary-solid text-primary-solid-foreground"
                  : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={ChartPie}
              title="Sem movimentações no período"
              description="Os relatórios aparecem conforme a família registra receitas e despesas."
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Receitas" marker="bg-income" value={formatMoney(report.summary.incomeCents)} />
              <StatTile
                label="Despesas"
                marker="bg-expense"
                value={formatMoney(report.summary.expenseCents)}
                detail={`Média mensal: ${formatMoney(report.averageExpenseCents)}`}
              />
              <StatTile
                label="Taxa de poupança"
                value={formatPercent(report.summary.savingsRate)}
                detail={`Economia: ${formatMoney(report.summary.savingsCents)}`}
              />
              <StatTile
                label="Gastos essenciais"
                value={formatPercent(report.essentialRatio)}
                detail="Das despesas, em categorias essenciais"
              />
            </div>

            {months.length > 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Receitas × despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyColumns months={report.months} />
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Despesas por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryRows.length > 0 ? (
                    <CategoryBars rows={categoryRows} totalCents={report.summary.expenseCents} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Por pessoa</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Pessoa</th>
                        <th className="py-1 text-right font-medium">Renda</th>
                        <th className="py-1 text-right font-medium">Despesas</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {report.members.map((row) => (
                        <tr key={row.memberId ?? "household"} className="border-t border-border">
                          <td className="py-2">{row.memberId ? (members.get(row.memberId) ?? "Membro") : "Família"}</td>
                          <td className="py-2 text-right">{formatMoney(row.incomeCents)}</td>
                          <td className="py-2 text-right">{formatMoney(row.expenseCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-muted-foreground">
                    “Família” reúne o que não tem um responsável definido (contas da casa).
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
