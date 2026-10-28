import type { IsoDate } from "@/lib/dates";
import type { Cents } from "@/lib/money";
import type { BudgetLine } from "./aggregations";
import type { PeriodSummary, TransactionKind } from "./calculations";

export interface AlertEntry {
  kind: TransactionKind;
  status: "paid" | "pending";
  amountCents: Cents;
  occurredOn: IsoDate;
  dueOn: IsoDate | null;
}

export type FinanceAlert =
  | { type: "overdue_bills"; count: number; cents: Cents }
  | { type: "bills_due_soon"; count: number; cents: Cents; days: number }
  | { type: "budget_exceeded"; categoryIds: string[] }
  | { type: "budget_warning"; categoryIds: string[] }
  | { type: "negative_balance"; cents: Cents };

function addDays(value: IsoDate, days: number): IsoDate {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** What deserves attention this month, most urgent first. Text is rendered by the UI. */
export function financeAlerts(
  entries: readonly AlertEntry[],
  lines: readonly BudgetLine[],
  summary: PeriodSummary,
  today: IsoDate,
  dueSoonDays = 7,
): FinanceAlert[] {
  const alerts: FinanceAlert[] = [];
  const pendingBills = entries.filter((entry) => entry.kind === "expense" && entry.status === "pending");
  const due = (entry: AlertEntry) => entry.dueOn ?? entry.occurredOn;
  const limit = addDays(today, dueSoonDays);

  const overdue = pendingBills.filter((entry) => due(entry) < today);
  if (overdue.length > 0) {
    alerts.push({ type: "overdue_bills", count: overdue.length, cents: overdue.reduce((sum, e) => sum + e.amountCents, 0) });
  }
  const soon = pendingBills.filter((entry) => due(entry) >= today && due(entry) <= limit);
  if (soon.length > 0) {
    alerts.push({
      type: "bills_due_soon",
      count: soon.length,
      cents: soon.reduce((sum, e) => sum + e.amountCents, 0),
      days: dueSoonDays,
    });
  }

  const exceeded = lines.filter((line) => line.status === "exceeded").map((line) => line.categoryId);
  if (exceeded.length > 0) alerts.push({ type: "budget_exceeded", categoryIds: exceeded });
  const warning = lines.filter((line) => line.status === "warning").map((line) => line.categoryId);
  if (warning.length > 0) alerts.push({ type: "budget_warning", categoryIds: warning });

  if (summary.balanceCents < 0) alerts.push({ type: "negative_balance", cents: -summary.balanceCents });
  return alerts;
}
