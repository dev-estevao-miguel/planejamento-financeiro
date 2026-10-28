import { formatMoney, type Cents } from "@/lib/money";
import type { TransactionKind } from "./labels";

/** "+ R$ 10,00" for income, "− R$ 10,00" for expenses; investments carry no sign (money is moved, not spent). */
export function formatSignedAmount(kind: TransactionKind, cents: Cents): string {
  const sign = kind === "income" ? "+ " : kind === "expense" ? "− " : "";
  return `${sign}${formatMoney(cents)}`;
}

/** Cents as typed in the amount field: 8590 -> "85,90". */
export function formatAmountInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
