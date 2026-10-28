import { formatMonth, type IsoDate } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { formatMoney, type Cents } from "@/lib/money";

/**
 * Builds the text a person can paste into an AI assistant. ALLOWLIST by
 * construction: the input type only carries aggregates and display names, so
 * ids, e-mails, phone numbers or tokens cannot reach the text. Every section is
 * opt-in and the full text is always shown before copying or downloading.
 */

export interface AiExportMonth {
  month: IsoDate;
  incomeCents: Cents;
  expenseCents: Cents;
  investmentCents: Cents;
}

export interface AiExportData {
  householdName: string;
  period: { from: IsoDate; to: IsoDate };
  months: AiExportMonth[];
  expensesByCategory: { name: string; cents: Cents; essential: boolean }[];
  members: { name: string; incomeCents: Cents; expenseCents: Cents }[];
  budgets: { name: string; plannedCents: Cents; spentCents: Cents }[];
  investmentsCents: Cents;
}

export interface AiExportOptions {
  includeNames: boolean;
  includeIndividual: boolean;
  includeCategories: boolean;
  includeBudgets: boolean;
  includeInvestments: boolean;
  question: string;
}

export const DEFAULT_AI_EXPORT_OPTIONS: AiExportOptions = {
  includeNames: false,
  includeIndividual: true,
  includeCategories: true,
  includeBudgets: true,
  includeInvestments: true,
  question: "",
};

const MAX_QUESTION_LENGTH = 1000;

function periodLabel({ from, to }: { from: IsoDate; to: IsoDate }): string {
  return from === to ? formatMonth(from) : `${formatMonth(from)} a ${formatMonth(to)}`;
}

export function buildAiPrompt(data: AiExportData, options: AiExportOptions): string {
  const lines: string[] = [];
  const total = data.months.reduce(
    (sum, month) => ({
      income: sum.income + month.incomeCents,
      expense: sum.expense + month.expenseCents,
      investment: sum.investment + month.investmentCents,
    }),
    { income: 0, expense: 0, investment: 0 },
  );
  const label = (name: string, index: number) => (options.includeNames ? name : `Pessoa ${index + 1}`);

  lines.push(
    "Você é um consultor financeiro pessoal. Analise os dados abaixo de uma família brasileira (valores em reais)",
    "e responda em português, de forma objetiva: pontos de atenção, oportunidades de economia e um plano prático",
    "para os próximos meses. Não invente dados que não estejam aqui.",
    "",
    `Família: ${options.includeNames ? data.householdName : "(nome omitido)"}`,
    `Período: ${periodLabel(data.period)}`,
    "",
    "## Resumo do período",
    `- Receitas: ${formatMoney(total.income)}`,
    `- Despesas: ${formatMoney(total.expense)}`,
  );
  if (options.includeInvestments) lines.push(`- Investimentos/aportes: ${formatMoney(total.investment)}`);
  lines.push(
    `- Saldo (receitas − despesas${options.includeInvestments ? " − investimentos" : ""}): ${formatMoney(
      total.income - total.expense - (options.includeInvestments ? total.investment : 0),
    )}`,
    `- Renda comprometida com despesas: ${formatPercent(total.income > 0 ? total.expense / total.income : null)}`,
  );

  if (data.months.length > 1) {
    lines.push("", "## Mês a mês");
    for (const month of data.months) {
      const parts = [`receitas ${formatMoney(month.incomeCents)}`, `despesas ${formatMoney(month.expenseCents)}`];
      if (options.includeInvestments) parts.push(`investimentos ${formatMoney(month.investmentCents)}`);
      lines.push(`- ${formatMonth(month.month)}: ${parts.join(", ")}`);
    }
  }

  if (options.includeCategories && data.expensesByCategory.length > 0) {
    lines.push("", "## Despesas por categoria");
    for (const category of data.expensesByCategory) {
      const share = formatPercent(total.expense > 0 ? category.cents / total.expense : null, { digits: 0 });
      lines.push(`- ${category.name}${category.essential ? " (essencial)" : ""}: ${formatMoney(category.cents)} (${share})`);
    }
  }

  if (options.includeBudgets && data.budgets.length > 0) {
    lines.push("", "## Planejado × realizado (último mês do período)");
    for (const budget of data.budgets) {
      lines.push(`- ${budget.name}: planejado ${formatMoney(budget.plannedCents)}, gasto ${formatMoney(budget.spentCents)}`);
    }
  }

  if (options.includeIndividual && data.members.length > 0) {
    lines.push("", "## Por pessoa");
    data.members.forEach((member, index) => {
      lines.push(
        `- ${label(member.name, index)}: renda ${formatMoney(member.incomeCents)}, despesas atribuídas ${formatMoney(member.expenseCents)}`,
      );
    });
  }

  if (options.includeInvestments && data.investmentsCents > 0) {
    lines.push("", `Total aportado em investimentos no período: ${formatMoney(data.investmentsCents)}.`);
  }

  const question = options.question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (question) lines.push("", "## Pergunta da família", question);

  return lines.join("\n");
}
