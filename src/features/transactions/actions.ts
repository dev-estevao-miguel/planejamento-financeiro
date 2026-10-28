"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { can, getAppContext, type AppPermission, type CurrentHousehold } from "@/features/auth/session";
import { monthStart, parseIsoDate, toMonthParam } from "@/lib/dates";
import { toDecimalString, type Cents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { splitInstallments } from "./installments";
import { databaseErrorMessage, TRANSACTION_MESSAGES } from "./labels";
import {
  readTransactionForm,
  transactionFormSchema,
  type TransactionField,
  type TransactionFormInput,
  type TransactionFormValues,
} from "./schemas";

export interface TransactionFormState {
  status: "idle" | "error" | "saved";
  message?: string;
  fieldErrors?: Partial<Record<TransactionField, string>>;
  /** Echoed back so the form keeps what the person typed. */
  values?: TransactionFormValues;
  redirectTo?: string;
}

export interface MutationResult {
  ok: boolean;
  message: string;
}

/** Postgres numeric accepts the exact decimal; JSON numbers round-trip 2 decimals exactly. */
function amount(cents: Cents): number {
  return Number(toDecimalString(cents));
}

async function householdWith(
  permission: AppPermission,
): Promise<{ household: CurrentHousehold } | { error: string }> {
  const { household } = await getAppContext();
  if (!household) return { error: TRANSACTION_MESSAGES.noHousehold };
  if (!can(household, permission)) return { error: TRANSACTION_MESSAGES.forbidden };
  return { household };
}

function logFailure(step: string, error: { code?: string } | null) {
  console.error(`[transactions] ${step} failed (code=${error?.code ?? "unknown"})`);
}

// -----------------------------------------------------------------------------
// Create / edit
// -----------------------------------------------------------------------------
export async function saveTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const values = readTransactionForm(formData);
  const parsed = transactionFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<TransactionField, string>> = {};
    for (const issue of parsed.error.issues) {
      const name = issue.path[0] as TransactionField;
      fieldErrors[name] ??= issue.message;
    }
    return { status: "error", message: TRANSACTION_MESSAGES.invalid, fieldErrors, values };
  }

  const input = parsed.data;
  const access = await householdWith(input.id ? "finance.edit" : "finance.create");
  if ("error" in access) return { status: "error", message: access.error, values };

  const householdId = access.household.id;
  const error = input.id
    ? await updateTransaction(householdId, input.id, input)
    : input.repeatMonthly
      ? await createRecurring(householdId, input)
      : await createTransactions(householdId, input);
  if (error) return { status: "error", message: error, values };

  refresh();
  return {
    status: "saved",
    message: input.id ? "Movimentação atualizada." : savedMessage(input),
    redirectTo: `/movimentacoes?mes=${toMonthParam(monthStart(input.occurredOn))}`,
  };
}

function savedMessage(input: TransactionFormInput): string {
  if (input.repeatMonthly) return "Movimentação recorrente criada.";
  if (input.installments > 1) return `Compra registrada em ${input.installments} parcelas.`;
  return "Movimentação registrada.";
}

function baseRow(input: TransactionFormInput) {
  return {
    kind: input.kind,
    description: input.description,
    category_id: input.categoryId,
    member_id: input.memberId,
    payment_method_id: input.paymentMethodId,
    notes: input.notes,
  };
}

async function updateTransaction(householdId: string, id: string, input: TransactionFormInput): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      ...baseRow(input),
      status: input.status,
      amount: amount(input.amount),
      occurred_on: input.occurredOn,
      // The trigger only derives the competence on insert; a new date moves it.
      competence_month: monthStart(input.occurredOn),
      visibility: input.isPrivate ? "private" : "household",
    })
    .eq("household_id", householdId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    logFailure("update", error);
    return databaseErrorMessage(error);
  }
  return data ? null : databaseErrorMessage({ message: "not_found_or_forbidden" });
}

async function createTransactions(householdId: string, input: TransactionFormInput): Promise<string | null> {
  const parts = splitInstallments(input.amount, input.installments, input.occurredOn);
  const groupId = parts.length > 1 ? randomUUID() : null;
  const rows = parts.map((part, index) => ({
    ...baseRow(input),
    household_id: householdId,
    // Later installments have not been paid yet.
    status: index === 0 ? input.status : ("pending" as const),
    amount: amount(part.amountCents),
    occurred_on: part.occurredOn,
    competence_month: monthStart(part.occurredOn),
    due_on: input.kind === "expense" && (index > 0 || input.status === "pending") ? part.occurredOn : null,
    visibility: input.isPrivate ? ("private" as const) : ("household" as const),
    installment_group_id: groupId,
    installment_number: groupId ? part.number : null,
    installment_total: groupId ? parts.length : null,
  }));

  const supabase = await createSupabaseServerClient();
  // One request = one statement: every installment is saved, or none.
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    logFailure("insert", error);
    return databaseErrorMessage(error);
  }
  return null;
}

async function createRecurring(householdId: string, input: TransactionFormInput): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: rule, error } = await supabase
    .from("recurring_rules")
    .insert({
      ...baseRow(input),
      household_id: householdId,
      amount: amount(input.amount),
      frequency: "monthly",
      day_of_month: parseIsoDate(input.occurredOn).day,
      starts_on: input.occurredOn,
      ends_on: input.repeatUntil,
      default_status: "pending",
    })
    .select("id")
    .single();
  if (error) {
    logFailure("insert recurring rule", error);
    return databaseErrorMessage(error);
  }

  const { error: ensureError } = await supabase.rpc("ensure_recurring_transactions", { p_household_id: householdId });
  if (ensureError) {
    logFailure("generate occurrences", ensureError);
    return null; // The rule exists; the daily job generates the occurrences.
  }
  if (input.status === "paid") {
    const { error: statusError } = await supabase
      .from("transactions")
      .update({ status: "paid" })
      .eq("recurring_rule_id", rule.id)
      .eq("occurrence_date", input.occurredOn);
    if (statusError) logFailure("mark first occurrence paid", statusError);
  }
  return null;
}

// -----------------------------------------------------------------------------
// Quick mutations (list and edit screen)
// -----------------------------------------------------------------------------
const idSchema = z.uuid();

export async function setTransactionStatusAction(id: string, status: "paid" | "pending"): Promise<MutationResult> {
  if (!idSchema.safeParse(id).success || (status !== "paid" && status !== "pending")) {
    return { ok: false, message: TRANSACTION_MESSAGES.unavailable };
  }
  const access = await householdWith("finance.edit");
  if ("error" in access) return { ok: false, message: access.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({ status })
    .eq("household_id", access.household.id)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) logFailure("status", error);
    return { ok: false, message: databaseErrorMessage(error ?? { message: "not_found_or_forbidden" }) };
  }
  refresh();
  return { ok: true, message: status === "paid" ? "Marcada como paga." : "Marcada como pendente." };
}

async function callDeletionRpc(
  name: "soft_delete_transaction" | "restore_transaction",
  id: string,
): Promise<MutationResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, message: TRANSACTION_MESSAGES.unavailable };
  const access = await householdWith("finance.delete");
  if ("error" in access) return { ok: false, message: access.error };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(name, { p_transaction_id: id });
  if (error) {
    logFailure(name, error);
    return { ok: false, message: databaseErrorMessage(error) };
  }
  refresh();
  return { ok: true, message: name === "soft_delete_transaction" ? "Movimentação excluída." : "Movimentação restaurada." };
}

export async function deleteTransactionAction(id: string): Promise<MutationResult> {
  return callDeletionRpc("soft_delete_transaction", id);
}

export async function restoreTransactionAction(id: string): Promise<MutationResult> {
  return callDeletionRpc("restore_transaction", id);
}
