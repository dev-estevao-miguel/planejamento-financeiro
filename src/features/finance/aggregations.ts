import type { IsoDate } from "@/lib/dates";
import type { Cents } from "@/lib/money";
import { budgetUsage, type BudgetUsage, type TransactionKind } from "./calculations";

/**
 * Grouping helpers over transactions. Pure and tested like calculations.ts;
 * the formulas themselves stay in calculations.ts.
 */

export interface Entry {
  kind: TransactionKind;
  status: "paid" | "pending";
  amountCents: Cents;
  categoryId: string | null;
  memberId: string | null;
  competenceMonth: IsoDate;
}

export interface CategoryRef {
  id: string;
  parentId: string | null;
}

/** Subcategory -> its top-level category (one level deep by schema). */
export function topLevelCategory(categoryId: string | null, categories: readonly CategoryRef[]): string | null {
  if (!categoryId) return null;
  const category = categories.find((item) => item.id === categoryId);
  return category?.parentId ?? categoryId;
}

/** Sum of one kind per top-level category, largest first. NULL = uncategorized. */
export function totalsByCategory(
  entries: readonly Entry[],
  categories: readonly CategoryRef[],
  kind: TransactionKind = "expense",
): { categoryId: string | null; cents: Cents }[] {
  const totals = new Map<string | null, Cents>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const key = topLevelCategory(entry.categoryId, categories);
    totals.set(key, (totals.get(key) ?? 0) + entry.amountCents);
  }
  return [...totals].map(([categoryId, cents]) => ({ categoryId, cents })).sort((a, b) => b.cents - a.cents);
}

/** Sum of one kind per member. NULL = the household as a whole. */
export function totalsByMember(entries: readonly Entry[], kind: TransactionKind): Map<string | null, Cents> {
  const totals = new Map<string | null, Cents>();
  for (const entry of entries) {
    if (entry.kind === kind) totals.set(entry.memberId, (totals.get(entry.memberId) ?? 0) + entry.amountCents);
  }
  return totals;
}

/** Keeps the first `limit` rows and folds the rest into one "other" row. */
export function foldTail<T extends { cents: Cents }>(rows: readonly T[], limit: number): { top: T[]; otherCents: Cents } {
  const top = rows.slice(0, limit);
  const otherCents = rows.slice(limit).reduce((sum, row) => sum + row.cents, 0);
  return { top, otherCents };
}

export interface PlannedItem {
  categoryId: string;
  plannedCents: Cents;
  alertThresholdPct: number;
}

export interface BudgetLine extends BudgetUsage {
  categoryId: string;
}

/** Planned × spent per budgeted category (spent includes pending bills of the month). */
export function budgetLines(
  planned: readonly PlannedItem[],
  entries: readonly Entry[],
  categories: readonly CategoryRef[],
): BudgetLine[] {
  const spent = new Map(totalsByCategory(entries, categories).map((row) => [row.categoryId, row.cents]));
  return planned.map((item) => ({
    categoryId: item.categoryId,
    ...budgetUsage(item.plannedCents, spent.get(item.categoryId) ?? 0, item.alertThresholdPct / 100),
  }));
}

const STATUS_WEIGHT = { exceeded: 0, warning: 1, on_track: 2, no_budget: 3 } as const;

/** Most urgent first: exceeded, then warning, then by how much of the plan is used. */
export function byUrgency(lines: readonly BudgetLine[]): BudgetLine[] {
  return [...lines].sort(
    (a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] || (b.usageRatio ?? 0) - (a.usageRatio ?? 0),
  );
}
