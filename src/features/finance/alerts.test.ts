import { describe, expect, it } from "vitest";
import { financeAlerts, type AlertEntry } from "./alerts";
import { summarizePeriod } from "./calculations";

function bill(occurredOn: string, amountCents: number, status: "paid" | "pending" = "pending"): AlertEntry {
  return { kind: "expense", status, amountCents, occurredOn, dueOn: occurredOn };
}

describe("finance alerts", () => {
  it("separates overdue bills from bills due in the next days", () => {
    const entries = [
      bill("2026-10-05", 10000),
      bill("2026-10-20", 5000),
      bill("2026-10-23", 2000),
      bill("2026-10-30", 3000),
      bill("2026-10-31", 9999),
      bill("2026-10-01", 7000, "paid"),
    ];
    const summary = summarizePeriod([{ kind: "income", amountCents: 100000 }]);
    expect(financeAlerts(entries, [], summary, "2026-10-23")).toEqual([
      { type: "overdue_bills", count: 2, cents: 15000 },
      { type: "bills_due_soon", count: 2, cents: 5000, days: 7 },
    ]);
  });

  it("flags budgets and a negative projected balance", () => {
    const summary = summarizePeriod([
      { kind: "income", amountCents: 1000 },
      { kind: "expense", amountCents: 1500 },
    ]);
    const lines = [
      { categoryId: "a", plannedCents: 100, spentCents: 200, remainingCents: -100, usageRatio: 2, status: "exceeded" as const },
      { categoryId: "b", plannedCents: 100, spentCents: 95, remainingCents: 5, usageRatio: 0.95, status: "warning" as const },
      { categoryId: "c", plannedCents: 100, spentCents: 10, remainingCents: 90, usageRatio: 0.1, status: "on_track" as const },
    ];
    expect(financeAlerts([], lines, summary, "2026-10-23")).toEqual([
      { type: "budget_exceeded", categoryIds: ["a"] },
      { type: "budget_warning", categoryIds: ["b"] },
      { type: "negative_balance", cents: 500 },
    ]);
  });
});
