import { describe, expect, it } from "vitest";
import {
  budgetUsage,
  emergencyReserve,
  goalProgress,
  monthlyAverage,
  periodChange,
  ratio,
  summarizePeriod,
  type AmountByKind,
} from "./calculations";

describe("summarizePeriod", () => {
  it("derives balance, savings and rates", () => {
    const items: AmountByKind[] = [
      { kind: "income", amountCents: 270000 },
      { kind: "income", amountCents: 180000 },
      { kind: "expense", amountCents: 300000 },
      { kind: "expense", amountCents: 15000 },
      { kind: "investment", amountCents: 50000 },
    ];
    expect(summarizePeriod(items)).toEqual({
      incomeCents: 450000,
      expenseCents: 315000,
      investmentCents: 50000,
      balanceCents: 85000,
      savingsCents: 135000,
      savingsRate: 0.3,
      investmentRate: 50000 / 450000,
      committedRate: 0.7,
    });
  });

  it("returns null rates when there is no income, instead of 0% or Infinity", () => {
    const summary = summarizePeriod([{ kind: "expense", amountCents: 469650 }]);
    expect(summary.balanceCents).toBe(-469650);
    expect(summary.savingsRate).toBeNull();
    expect(summary.committedRate).toBeNull();
  });

  it("handles an empty period", () => {
    expect(summarizePeriod([]).balanceCents).toBe(0);
  });
});

describe("budgetUsage", () => {
  it("matches the spec example (Lazer: R$ 400 planned, R$ 275 spent)", () => {
    expect(budgetUsage(40000, 27500)).toEqual({
      plannedCents: 40000,
      spentCents: 27500,
      remainingCents: 12500,
      usageRatio: 0.6875,
      status: "on_track",
    });
  });

  it.each([
    [40000, 36000, "warning"],
    [40000, 40000, "warning"],
    [40000, 40001, "exceeded"],
    [0, 0, "no_budget"],
    [0, 100, "exceeded"],
  ] as const)("planned %i / spent %i -> %s", (planned, spent, status) => {
    expect(budgetUsage(planned, spent).status).toBe(status);
  });

  it("reports how much the budget was exceeded by", () => {
    expect(budgetUsage(40000, 45000).remainingCents).toBe(-5000);
  });

  it("accepts a custom warning threshold", () => {
    expect(budgetUsage(10000, 8000, 0.8).status).toBe("warning");
  });
});

describe("goalProgress", () => {
  it("tracks remaining amount and clamps the bar", () => {
    expect(goalProgress(35000, 100000)).toMatchObject({ remainingCents: 65000, progressRatio: 0.35, achieved: false });
    expect(goalProgress(120000, 100000)).toMatchObject({ remainingCents: 0, progressRatio: 1, achieved: true });
  });

  it("rejects a non-positive target", () => {
    expect(() => goalProgress(0, 0)).toThrow(RangeError);
  });
});

describe("emergencyReserve", () => {
  it("multiplies the essential monthly cost by the configured months", () => {
    expect(emergencyReserve(250000, 6, 300000)).toMatchObject({
      targetCents: 1500000,
      remainingCents: 1200000,
      progressRatio: 0.2,
    });
  });

  it("needs a known essential cost", () => {
    expect(emergencyReserve(0, 6, 0)).toBeNull();
  });
});

describe("helpers", () => {
  it("computes ratios safely", () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(1, 0)).toBeNull();
  });

  it("computes month-over-month change", () => {
    expect(periodChange(112000, 100000)).toBeCloseTo(0.12);
    expect(periodChange(100, 0)).toBeNull();
  });

  it("averages monthly totals in whole cents", () => {
    expect(monthlyAverage([100, 101])).toBe(101);
    expect(monthlyAverage([])).toBe(0);
  });
});
