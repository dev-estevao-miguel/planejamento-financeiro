import { addMonthsKeepingDay, type IsoDate } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export interface Installment {
  number: number;
  amountCents: Cents;
  occurredOn: IsoDate;
}

/**
 * Splits a purchase into monthly installments. Leftover cents go to the first
 * installments, so the parts always add up to the total exactly
 * (R$ 100,00 / 3 -> 33,34 + 33,33 + 33,33).
 */
export function splitInstallments(totalCents: Cents, count: number, firstDate: IsoDate): Installment[] {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("Installment count must be a positive integer");
  if (!Number.isSafeInteger(totalCents) || totalCents < count) {
    throw new RangeError("Total must cover at least one cent per installment");
  }
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    amountCents: base + (index < remainder ? 1 : 0),
    occurredOn: addMonthsKeepingDay(firstDate, index),
  }));
}
