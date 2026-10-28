import { z } from "zod";
import { parseMoneyInput } from "@/lib/money";

export const MAX_INSTALLMENTS = 360;
/** NUMERIC(14,2) allows more, but nothing in a household budget gets near it. */
const MAX_AMOUNT_CENTS = 99_999_999_999;

const isoDate = z.iso.date({ error: "Informe uma data válida." });

/** Empty <select>/<input> values arrive as "" and mean "none". */
const optionalUuid = z
  .string()
  .transform((value) => value || null)
  .pipe(z.uuid().nullable());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((value) => value || null);

export const transactionFormSchema = z
  .object({
    id: optionalUuid,
    kind: z.enum(["expense", "income", "investment"], { error: "Escolha o tipo." }),
    description: z.string().trim().min(1, "Informe uma descrição.").max(140, "Use no máximo 140 caracteres."),
    amount: z
      .string()
      .transform((value, context) => {
        const cents = parseMoneyInput(value);
        if (cents === null || cents <= 0) {
          context.addIssue({ code: "custom", message: "Informe um valor maior que zero." });
          return z.NEVER;
        }
        if (cents > MAX_AMOUNT_CENTS) {
          context.addIssue({ code: "custom", message: "Valor alto demais." });
          return z.NEVER;
        }
        return cents;
      }),
    occurredOn: isoDate,
    categoryId: optionalUuid,
    memberId: optionalUuid,
    paymentMethodId: optionalUuid,
    status: z.enum(["paid", "pending"]),
    notes: optionalText(1000),
    isPrivate: z.boolean(),
    installments: z.coerce
      .number({ error: "Informe o número de parcelas." })
      .int("Informe um número inteiro de parcelas.")
      .min(1, "Mínimo de 1 parcela.")
      .max(MAX_INSTALLMENTS, `Máximo de ${MAX_INSTALLMENTS} parcelas.`),
    repeatMonthly: z.boolean(),
    repeatUntil: z
      .string()
      .transform((value) => value || null)
      .pipe(isoDate.nullable()),
  })
  .refine((value) => !(value.installments > 1 && value.repeatMonthly), {
    message: "Escolha parcelar ou repetir todo mês, não os dois.",
    path: ["installments"],
  })
  .refine((value) => !(value.isPrivate && value.repeatMonthly), {
    message: "Movimentações recorrentes são sempre visíveis para a família.",
    path: ["repeatUntil"],
  })
  .refine((value) => value.amount >= value.installments, {
    message: "O valor precisa cobrir ao menos 1 centavo por parcela.",
    path: ["amount"],
  })
  .refine((value) => !value.repeatUntil || value.repeatUntil >= value.occurredOn, {
    message: "A data final precisa ser depois da primeira.",
    path: ["repeatUntil"],
  });

export type TransactionFormInput = z.infer<typeof transactionFormSchema>;

export type TransactionField =
  | "kind"
  | "description"
  | "amount"
  | "occurredOn"
  | "categoryId"
  | "memberId"
  | "paymentMethodId"
  | "status"
  | "notes"
  | "installments"
  | "repeatUntil";

/** Reads the transaction form; checkboxes are present only when checked. */
export function readTransactionForm(formData: FormData) {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    id: text("id"),
    kind: text("kind"),
    description: text("description"),
    amount: text("amount"),
    occurredOn: text("occurredOn"),
    categoryId: text("categoryId"),
    memberId: text("memberId"),
    paymentMethodId: text("paymentMethodId"),
    status: text("status") || "paid",
    notes: text("notes"),
    isPrivate: formData.get("isPrivate") === "on",
    installments: text("installments") || "1",
    repeatMonthly: formData.get("repeatMonthly") === "on",
    repeatUntil: text("repeatUntil"),
  };
}

export type TransactionFormValues = ReturnType<typeof readTransactionForm>;
