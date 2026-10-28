import { sumCents, type Cents } from "@/lib/money";

/**
 * Single source of truth for every financial formula shown in the app.
 * Pure functions over integer cents: no I/O, no UI, fully unit-tested.
 *
 * Definitions (also documented in docs/ARCHITECTURE.md):
 *   balance       = income - expenses - investments  ("saldo disponível")
 *   savings       = income - expenses                 ("economia do mês";
 *                   investing is a way of saving, so it is not subtracted)
 *   savingsRate   = savings / income
 *   committedRate = expenses / income                 ("renda comprometida")
 * Ratios are returned as fractions (0.6875 = 68,75%) or null when the
 * denominator is zero, so the UI can show "—" instead of a fake 0% or ∞.
 */

export type TransactionKind = "income" | "expense" | "investment";

export interface AmountByKind {
  kind: TransactionKind;
  amountCents: Cents;
}

export function ratio(part: Cents, whole: Cents): number | null {
  return whole === 0 ? null : part / whole;
}

export function totalOfKind(items: Iterable<AmountByKind>, kind: TransactionKind): Cents {
  const amounts: Cents[] = [];
  for (const item of items) if (item.kind === kind) amounts.push(item.amountCents);
  return sumCents(amounts);
}

export interface PeriodSummary {
  incomeCents: Cents;
  expenseCents: Cents;
  investmentCents: Cents;
  balanceCents: Cents;
  savingsCents: Cents;
  savingsRate: number | null;
  investmentRate: number | null;
  committedRate: number | null;
}

export function summarizePeriod(items: readonly AmountByKind[]): PeriodSummary {
  const incomeCents = totalOfKind(items, "income");
  const expenseCents = totalOfKind(items, "expense");
  const investmentCents = totalOfKind(items, "investment");
  const savingsCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    investmentCents,
    balanceCents: savingsCents - investmentCents,
    savingsCents,
    savingsRate: ratio(savingsCents, incomeCents),
    investmentRate: ratio(investmentCents, incomeCents),
    committedRate: ratio(expenseCents, incomeCents),
  };
}

export type BudgetStatus = "no_budget" | "on_track" | "warning" | "exceeded";

/** Usage at or above this share of the plan raises a warning. */
export const DEFAULT_BUDGET_WARNING_RATIO = 0.9;

export interface BudgetUsage {
  plannedCents: Cents;
  spentCents: Cents;
  /** Negative when the budget was exceeded. */
  remainingCents: Cents;
  usageRatio: number | null;
  status: BudgetStatus;
}

export function budgetUsage(
  plannedCents: Cents,
  spentCents: Cents,
  warningRatio: number = DEFAULT_BUDGET_WARNING_RATIO,
): BudgetUsage {
  const usageRatio = ratio(spentCents, plannedCents);
  let status: BudgetStatus;
  if (plannedCents === 0) status = spentCents > 0 ? "exceeded" : "no_budget";
  else if (spentCents > plannedCents) status = "exceeded";
  else if (usageRatio !== null && usageRatio >= warningRatio) status = "warning";
  else status = "on_track";

  return { plannedCents, spentCents, remainingCents: plannedCents - spentCents, usageRatio, status };
}

export interface GoalProgress {
  currentCents: Cents;
  targetCents: Cents;
  remainingCents: Cents;
  /** Clamped to [0, 1] for progress bars. */
  progressRatio: number;
  achieved: boolean;
}

export function goalProgress(currentCents: Cents, targetCents: Cents): GoalProgress {
  if (targetCents <= 0) throw new RangeError("Goal target must be positive");
  return {
    currentCents,
    targetCents,
    remainingCents: Math.max(targetCents - currentCents, 0),
    progressRatio: Math.min(Math.max(currentCents / targetCents, 0), 1),
    achieved: currentCents >= targetCents,
  };
}

/** Emergency reserve target = average essential monthly cost x months. */
export function emergencyReserve(essentialMonthlyCents: Cents, months: number, currentCents: Cents): GoalProgress | null {
  if (!Number.isInteger(months) || months < 1) throw new RangeError("Months must be a positive integer");
  if (essentialMonthlyCents <= 0) return null;
  return goalProgress(currentCents, essentialMonthlyCents * months);
}

/** Relative change vs. a previous period (0.12 = 12% higher). */
export function periodChange(currentCents: Cents, previousCents: Cents): number | null {
  return previousCents === 0 ? null : (currentCents - previousCents) / previousCents;
}

/** Average of monthly totals, rounded to whole cents. */
export function monthlyAverage(monthlyTotals: readonly Cents[]): Cents {
  if (monthlyTotals.length === 0) return 0;
  return Math.round(sumCents(monthlyTotals) / monthlyTotals.length);
}
