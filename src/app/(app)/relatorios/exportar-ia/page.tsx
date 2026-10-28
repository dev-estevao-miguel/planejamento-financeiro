import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AiExportBuilder } from "@/features/ai-export/ai-export-builder";
import type { AiExportData } from "@/features/ai-export/build-prompt";
import { getAppContext } from "@/features/auth/session";
import { budgetLines } from "@/features/finance/aggregations";
import { getBudget } from "@/features/planning/queries";
import { buildPeriodReport } from "@/features/reports/period-report";
import { ensureRecurringTransactions, getFinanceOptions, getTransactionsInRange } from "@/features/transactions/queries";
import { monthsInRange, resolvePeriod, toMonthParam, todayIn, type PeriodPreset } from "@/lib/dates";

export const metadata: Metadata = { title: "Exportar para IA" };

const PRESETS: readonly PeriodPreset[] = ["current_month", "last_3_months", "last_6_months", "last_12_months", "current_year"];

export default async function AiExportPage({ searchParams }: PageProps<"/relatorios/exportar-ia">) {
  const [{ household }, params] = await Promise.all([getAppContext(), searchParams]);
  if (!household) {
    return (
      <Card>
        <EmptyState icon={Users} title="Nenhuma família vinculada" description="Peça ao responsável para adicionar você." />
      </Card>
    );
  }

  const preset = PRESETS.find((item) => item === params.periodo) ?? "last_3_months";
  const today = todayIn(household.timeZone);
  const range = resolvePeriod(preset, today);

  await ensureRecurringTransactions(household.id);
  const [options, entries, budget] = await Promise.all([
    getFinanceOptions(household.id),
    getTransactionsInRange(household.id, range),
    getBudget(household.id, range.to),
  ]);
  const report = buildPeriodReport(entries, monthsInRange(range), options.categories);
  const names = new Map(options.members.map((member) => [member.id, member.name]));
  const categoryNames = new Map(options.categories.map((category) => [category.id, category.name]));
  const lastMonth = entries.filter((entry) => entry.competenceMonth === range.to);

  // Only display names and aggregates cross to the browser (allowlist).
  const data: AiExportData = {
    householdName: household.name,
    period: range,
    months: report.months,
    expensesByCategory: report.categories.map(({ name, cents, essential }) => ({ name, cents, essential })),
    members: report.members.flatMap((row) =>
      row.memberId
        ? [{ name: names.get(row.memberId) ?? "Membro", incomeCents: row.incomeCents, expenseCents: row.expenseCents }]
        : [],
    ),
    budgets: budgetLines(budget.items, lastMonth, options.categories).map((line) => ({
      name: categoryNames.get(line.categoryId) ?? "Categoria",
      plannedCents: line.plannedCents,
      spentCents: line.spentCents,
    })),
    investmentsCents: report.summary.investmentCents,
  };

  return (
    <>
      <PageHeader
        title="Exportar para IA"
        description="Monte um texto com os números da família para pedir uma análise a um assistente de IA."
      />
      <Card className="p-5">
        <AiExportBuilder data={data} fileName={`financas-${toMonthParam(range.from)}-a-${toMonthParam(range.to)}.txt`} />
      </Card>
    </>
  );
}
