import type { Enums } from "@/types/database";

export type TransactionKind = Enums<"transaction_kind">;
export type TransactionStatus = Enums<"transaction_status">;
export type PaymentMethodType = Enums<"payment_method_type">;

export const TRANSACTION_KINDS: readonly TransactionKind[] = ["expense", "income", "investment"];

export const KIND_LABELS: Record<TransactionKind, { singular: string; plural: string; new: string }> = {
  expense: { singular: "Despesa", plural: "Despesas", new: "Nova despesa" },
  income: { singular: "Receita", plural: "Receitas", new: "Nova receita" },
  investment: { singular: "Investimento", plural: "Investimentos", new: "Novo investimento" },
};

/** "Pago" reads wrong for money coming in or going to an investment. */
export const STATUS_LABELS: Record<TransactionKind, Record<TransactionStatus, string>> = {
  expense: { paid: "Pago", pending: "Pendente" },
  income: { paid: "Recebido", pending: "A receber" },
  investment: { paid: "Aplicado", pending: "A aplicar" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  cash: "Dinheiro",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
  pix: "PIX",
  bank_transfer: "Transferência",
  bank_slip: "Boleto",
  meal_voucher: "Vale-alimentação",
  other: "Outro",
};

/** Tailwind text color per kind; always paired with a sign or label, never color alone. */
export const KIND_TONE: Record<TransactionKind, string> = {
  expense: "text-expense",
  income: "text-income",
  investment: "text-investment",
};

/** Stable database error codes (see ARCHITECTURE §6) -> friendly messages. */
const DATABASE_ERRORS: Record<string, string> = {
  not_found_or_forbidden: "Essa movimentação não existe mais ou você não tem permissão para alterá-la.",
  category_kind_mismatch: "A categoria escolhida não combina com o tipo da movimentação.",
  category_not_found: "A categoria escolhida não existe mais.",
};

export const TRANSACTION_MESSAGES = {
  forbidden: "Você não tem permissão para fazer isso nesta família.",
  noHousehold: "Você ainda não faz parte de uma família.",
  unavailable: "Não foi possível salvar agora. Tente novamente em instantes.",
  invalid: "Confira os campos destacados.",
} as const;

export function databaseErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return TRANSACTION_MESSAGES.unavailable;
  if (error.message && error.message in DATABASE_ERRORS) return DATABASE_ERRORS[error.message];
  // 42501 = insufficient_privilege (RLS or column grant).
  if (error.code === "42501") return TRANSACTION_MESSAGES.forbidden;
  return TRANSACTION_MESSAGES.unavailable;
}
