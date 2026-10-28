import { describe, expect, it } from "vitest";
import { budgetLines, byUrgency, foldTail, topLevelCategory, totalsByCategory, totalsByMember, type Entry } from "./aggregations";

const CATEGORIES = [
  { id: "moradia", parentId: null },
  { id: "aluguel", parentId: "moradia" },
  { id: "alimentacao", parentId: null },
  { id: "salario", parentId: null },
];

function entry(partial: Partial<Entry>): Entry {
  return {
    kind: "expense",
    status: "paid",
    amountCents: 100,
    categoryId: null,
    memberId: null,
    competenceMonth: "2026-10-01",
    ...partial,
  };
}

const ENTRIES: Entry[] = [
  entry({ categoryId: "aluguel", amountCents: 120000 }),
  entry({ categoryId: "moradia", amountCents: 30000, status: "pending" }),
  entry({ categoryId: "alimentacao", amountCents: 45000, memberId: "maria" }),
  entry({ categoryId: null, amountCents: 5000 }),
  entry({ kind: "income", categoryId: "salario", amountCents: 310000, memberId: "joao" }),
  entry({ kind: "income", categoryId: "salario", amountCents: 205000, memberId: "maria" }),
];

describe("aggregations", () => {
  it("rolls subcategories into their parent", () => {
    expect(topLevelCategory("aluguel", CATEGORIES)).toBe("moradia");
    expect(topLevelCategory("moradia", CATEGORIES)).toBe("moradia");
    expect(topLevelCategory(null, CATEGORIES)).toBeNull();
    expect(totalsByCategory(ENTRIES, CATEGORIES)).toEqual([
      { categoryId: "moradia", cents: 150000 },
      { categoryId: "alimentacao", cents: 45000 },
      { categoryId: null, cents: 5000 },
    ]);
  });

  it("totals one kind per member", () => {
    expect(totalsByMember(ENTRIES, "income")).toEqual(
      new Map([
        ["joao", 310000],
        ["maria", 205000],
      ]),
    );
  });

  it("folds the tail into 'other'", () => {
    expect(foldTail([{ cents: 5 }, { cents: 3 }, { cents: 2 }, { cents: 1 }], 2)).toEqual({
      top: [{ cents: 5 }, { cents: 3 }],
      otherCents: 3,
    });
  });

  it("compares planned and spent per category, most urgent first", () => {
    const lines = budgetLines(
      [
        { categoryId: "alimentacao", plannedCents: 50000, alertThresholdPct: 90 },
        { categoryId: "moradia", plannedCents: 140000, alertThresholdPct: 90 },
        { categoryId: "salario", plannedCents: 10000, alertThresholdPct: 90 },
      ],
      ENTRIES,
      CATEGORIES,
    );
    expect(byUrgency(lines).map((line) => [line.categoryId, line.status, line.remainingCents])).toEqual([
      ["moradia", "exceeded", -10000],
      ["alimentacao", "warning", 5000],
      ["salario", "on_track", 10000],
    ]);
  });
});
