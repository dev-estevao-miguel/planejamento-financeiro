import { describe, expect, it } from "vitest";
import type { Entry } from "@/features/finance/aggregations";
import { buildPeriodReport } from "./period-report";

const CATEGORIES = [
  { id: "moradia", parentId: null, name: "Moradia", isEssential: true },
  { id: "aluguel", parentId: "moradia", name: "Aluguel", isEssential: true },
  { id: "lazer", parentId: null, name: "Lazer", isEssential: false },
];

function entry(partial: Partial<Entry>): Entry {
  return { kind: "expense", status: "paid", amountCents: 0, categoryId: null, memberId: null, competenceMonth: "2026-09-01", ...partial };
}

describe("period report", () => {
  it("builds monthly totals, categories, essential share and people", () => {
    const report = buildPeriodReport(
      [
        entry({ kind: "income", amountCents: 500000, memberId: "a" }),
        entry({ categoryId: "aluguel", amountCents: 150000 }),
        entry({ categoryId: "lazer", amountCents: 50000, memberId: "a", competenceMonth: "2026-10-01" }),
        entry({ kind: "income", amountCents: 300000, memberId: "b", competenceMonth: "2026-10-01" }),
      ],
      ["2026-09-01", "2026-10-01"],
      CATEGORIES,
    );
    expect(report.months).toEqual([
      { month: "2026-09-01", incomeCents: 500000, expenseCents: 150000, investmentCents: 0 },
      { month: "2026-10-01", incomeCents: 300000, expenseCents: 50000, investmentCents: 0 },
    ]);
    expect(report.averageExpenseCents).toBe(100000);
    expect(report.categories.map((row) => [row.name, row.cents])).toEqual([
      ["Moradia", 150000],
      ["Lazer", 50000],
    ]);
    expect(report.essentialRatio).toBe(0.75);
    expect(report.members).toEqual([
      { memberId: "a", incomeCents: 500000, expenseCents: 50000 },
      { memberId: "b", incomeCents: 300000, expenseCents: 0 },
      { memberId: null, incomeCents: 0, expenseCents: 150000 },
    ]);
  });
});
