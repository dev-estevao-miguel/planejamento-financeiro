import { describe, expect, it } from "vitest";
import { buildAiPrompt, DEFAULT_AI_EXPORT_OPTIONS, type AiExportData } from "./build-prompt";

const DATA: AiExportData = {
  householdName: "Família Exemplo",
  period: { from: "2026-09-01", to: "2026-10-01" },
  months: [
    { month: "2026-09-01", incomeCents: 450000, expenseCents: 300000, investmentCents: 20000 },
    { month: "2026-10-01", incomeCents: 450000, expenseCents: 350000, investmentCents: 0 },
  ],
  expensesByCategory: [{ name: "Moradia", cents: 400000, essential: true }],
  members: [
    { name: "Alice", incomeCents: 500000, expenseCents: 100000 },
    { name: "Bob", incomeCents: 400000, expenseCents: 50000 },
  ],
  budgets: [{ name: "Alimentação", plannedCents: 80000, spentCents: 90000 }],
  investmentsCents: 20000,
};

describe("AI export prompt", () => {
  it("summarizes the period and hides names by default", () => {
    const text = buildAiPrompt(DATA, DEFAULT_AI_EXPORT_OPTIONS);
    expect(text).toContain("Período: Setembro/2026 a Outubro/2026");
    expect(text).toContain("Receitas: R$\u00a09.000,00");
    expect(text).toContain("Moradia (essencial)");
    expect(text).toContain("Pessoa 1: renda R$\u00a05.000,00");
    expect(text).not.toContain("Alice");
    expect(text).not.toContain("Família Exemplo");
  });

  it("leaves out every section that was not selected", () => {
    const text = buildAiPrompt(DATA, {
      includeNames: true,
      includeIndividual: false,
      includeCategories: false,
      includeBudgets: false,
      includeInvestments: false,
      question: "  Dá para guardar R$ 500 por mês?  ",
    });
    expect(text).toContain("Família: Família Exemplo");
    expect(text).not.toMatch(/Por pessoa|Despesas por categoria|Planejado|Investimentos/);
    expect(text.endsWith("Dá para guardar R$ 500 por mês?")).toBe(true);
  });
});
