import { totalsByCategory, totalsByMember, type CategoryRef, type Entry } from "@/features/finance/aggregations";
import { monthlyAverage, summarizePeriod, type PeriodSummary } from "@/features/finance/calculations";
import type { IsoDate } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export interface ReportCategory extends CategoryRef {
  name: string;
  isEssential: boolean;
}

export interface PeriodReport {
  summary: PeriodSummary;
  months: { month: IsoDate; incomeCents: Cents; expenseCents: Cents; investmentCents: Cents }[];
  averageExpenseCents: Cents;
  categories: { categoryId: string | null; name: string; cents: Cents; essential: boolean }[];
  /** Share of expenses in categories marked essential; null without expenses. */
  essentialRatio: number | null;
  members: { memberId: string | null; incomeCents: Cents; expenseCents: Cents }[];
}

/** Everything the reports page and the AI export show, from one pass over the entries. */
export function buildPeriodReport(
  entries: readonly Entry[],
  months: readonly IsoDate[],
  categories: readonly ReportCategory[],
): PeriodReport {
  const summary = summarizePeriod(entries);
  const monthly = months.map((month) => {
    const totals = summarizePeriod(entries.filter((entry) => entry.competenceMonth === month));
    return {
      month,
      incomeCents: totals.incomeCents,
      expenseCents: totals.expenseCents,
      investmentCents: totals.investmentCents,
    };
  });

  const byId = new Map(categories.map((category) => [category.id, category]));
  const byCategory = totalsByCategory(entries, categories).map((row) => {
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    return {
      categoryId: row.categoryId,
      name: category?.name ?? "Sem categoria",
      cents: row.cents,
      essential: category?.isEssential ?? false,
    };
  });
  const essentialCents = byCategory.filter((row) => row.essential).reduce((sum, row) => sum + row.cents, 0);

  const income = totalsByMember(entries, "income");
  const expense = totalsByMember(entries, "expense");
  const memberIds = new Set([...income.keys(), ...expense.keys()]);

  return {
    summary,
    months: monthly,
    averageExpenseCents: monthlyAverage(monthly.map((month) => month.expenseCents)),
    categories: byCategory,
    essentialRatio: summary.expenseCents > 0 ? essentialCents / summary.expenseCents : null,
    members: [...memberIds]
      .map((memberId) => ({ memberId, incomeCents: income.get(memberId) ?? 0, expenseCents: expense.get(memberId) ?? 0 }))
      .sort((a, b) => b.incomeCents + b.expenseCents - (a.incomeCents + a.expenseCents)),
  };
}
