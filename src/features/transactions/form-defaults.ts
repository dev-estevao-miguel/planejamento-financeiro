import type { IsoDate } from "@/lib/dates";
import { formatAmountInput } from "./format";
import type { TransactionKind } from "./labels";
import type { FinanceOptions, TransactionItem } from "./queries";
import type { TransactionFormValues } from "./schemas";

export function emptyTransactionValues(kind: TransactionKind, today: IsoDate, memberId: string): TransactionFormValues {
  return {
    id: "",
    kind,
    description: "",
    amount: "",
    occurredOn: today,
    categoryId: "",
    // Expenses usually belong to the household; income to whoever earns it.
    memberId: kind === "income" ? memberId : "",
    paymentMethodId: "",
    status: "paid",
    notes: "",
    isPrivate: false,
    installments: "1",
    repeatMonthly: false,
    repeatUntil: "",
  };
}

/** Edit keeps the id; duplicate drops it and moves the date to today. */
export function valuesFromTransaction(
  item: TransactionItem,
  mode: "edit" | "duplicate",
  today: IsoDate,
): TransactionFormValues {
  return {
    id: mode === "edit" ? item.id : "",
    kind: item.kind,
    description: item.description,
    amount: formatAmountInput(item.amountCents),
    occurredOn: mode === "edit" ? item.occurredOn : today,
    categoryId: item.categoryId ?? "",
    memberId: item.memberId ?? "",
    paymentMethodId: item.paymentMethodId ?? "",
    status: mode === "edit" ? item.status : "paid",
    notes: item.notes ?? "",
    isPrivate: item.isPrivate,
    installments: "1",
    repeatMonthly: false,
    repeatUntil: "",
  };
}

/** Choices offered in the form: active entries plus whatever the record already uses. */
export function formChoices(options: FinanceOptions, values: TransactionFormValues) {
  return {
    categories: options.categories.filter((item) => !item.archived || item.id === values.categoryId),
    members: options.members.filter((item) => item.active || item.id === values.memberId),
    paymentMethods: options.paymentMethods.filter((item) => !item.archived || item.id === values.paymentMethodId),
  };
}
