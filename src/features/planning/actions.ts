"use server";

import { refresh } from "next/cache";
import { can, getAppContext } from "@/features/auth/session";
import { TRANSACTION_MESSAGES } from "@/features/transactions/labels";
import { addMonths, monthStart, parseIsoDate, type IsoDate } from "@/lib/dates";
import { parseMoneyInput, toCents, toDecimalString, type Cents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BudgetFormState {
  status: "idle" | "error" | "saved";
  message?: string;
  /** categoryId -> message */
  fieldErrors?: Record<string, string>;
}

const PLANNED_PREFIX = "planned:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validMonth(value: unknown): IsoDate | null {
  if (typeof value !== "string") return null;
  try {
    parseIsoDate(value);
    return monthStart(value) === value ? value : null;
  } catch {
    return null;
  }
}

async function plannerHousehold(): Promise<{ householdId: string } | { error: string }> {
  const { household } = await getAppContext();
  if (!household) return { error: TRANSACTION_MESSAGES.noHousehold };
  if (!can(household, "planning.manage")) return { error: TRANSACTION_MESSAGES.forbidden };
  return { householdId: household.id };
}

function logFailure(step: string, error: { code?: string } | null) {
  console.error(`[planning] ${step} failed (code=${error?.code ?? "unknown"})`);
}

/**
 * Writes the planned amounts of a month: positive -> insert/update, empty or
 * zero -> remove the line. Column grants do not allow an UPSERT (it would
 * rewrite household_id/month), so existing rows are updated explicitly.
 */
async function writeBudget(householdId: string, month: IsoDate, planned: Map<string, Cents>): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  const existing = await supabase.from("budgets").select("id").eq("household_id", householdId).eq("month", month).maybeSingle();
  if (existing.error) {
    logFailure("load budget", existing.error);
    return TRANSACTION_MESSAGES.unavailable;
  }
  let budgetId = existing.data?.id ?? null;
  if (!budgetId) {
    const created = await supabase.from("budgets").insert({ household_id: householdId, month }).select("id").single();
    if (created.error) {
      logFailure("create budget", created.error);
      return created.error.code === "42501" ? TRANSACTION_MESSAGES.forbidden : TRANSACTION_MESSAGES.unavailable;
    }
    budgetId = created.data.id;
  }

  const items = await supabase.from("budget_items").select("id, category_id").eq("budget_id", budgetId);
  if (items.error) {
    logFailure("load budget items", items.error);
    return TRANSACTION_MESSAGES.unavailable;
  }
  const current = new Map(items.data.map((item) => [item.category_id, item.id]));

  const writes = [...planned].map(([categoryId, cents]) => {
    const itemId = current.get(categoryId);
    if (cents === 0) return itemId ? supabase.from("budget_items").delete().eq("id", itemId) : null;
    const amount = Number(toDecimalString(cents));
    return itemId
      ? supabase.from("budget_items").update({ planned_amount: amount }).eq("id", itemId)
      : supabase
          .from("budget_items")
          .insert({ household_id: householdId, budget_id: budgetId, category_id: categoryId, planned_amount: amount });
  });
  const results = await Promise.all(writes.filter((write) => write !== null));
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    logFailure("write budget items", failed.error);
    return failed.error.code === "42501" ? TRANSACTION_MESSAGES.forbidden : TRANSACTION_MESSAGES.unavailable;
  }
  return null;
}

export async function saveBudgetAction(_previous: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const month = validMonth(formData.get("month"));
  if (!month) return { status: "error", message: TRANSACTION_MESSAGES.unavailable };

  const planned = new Map<string, Cents>();
  const fieldErrors: Record<string, string> = {};
  for (const [name, value] of formData) {
    if (!name.startsWith(PLANNED_PREFIX) || typeof value !== "string") continue;
    const categoryId = name.slice(PLANNED_PREFIX.length);
    if (!UUID.test(categoryId)) continue;
    const cents = value.trim() === "" ? 0 : parseMoneyInput(value);
    if (cents === null) fieldErrors[categoryId] = "Valor inválido.";
    else planned.set(categoryId, cents);
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: TRANSACTION_MESSAGES.invalid, fieldErrors };
  }

  const access = await plannerHousehold();
  if ("error" in access) return { status: "error", message: access.error };
  const error = await writeBudget(access.householdId, month, planned);
  if (error) return { status: "error", message: error };

  refresh();
  return { status: "saved", message: "Planejamento salvo." };
}

/** Copies last month's planned amounts into a month that has none yet. */
export async function copyPreviousBudgetAction(month: string): Promise<{ ok: boolean; message: string }> {
  const target = validMonth(month);
  if (!target) return { ok: false, message: TRANSACTION_MESSAGES.unavailable };
  const access = await plannerHousehold();
  if ("error" in access) return { ok: false, message: access.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("budget_items(category_id, planned_amount)")
    .eq("household_id", access.householdId)
    .eq("month", addMonths(target, -1))
    .maybeSingle();
  if (error) {
    logFailure("load previous budget", error);
    return { ok: false, message: TRANSACTION_MESSAGES.unavailable };
  }
  const previous = data?.budget_items ?? [];
  if (previous.length === 0) return { ok: false, message: "O mês anterior não tem planejamento para copiar." };

  const planned = new Map(previous.map((item) => [item.category_id, toCents(item.planned_amount)]));
  const writeError = await writeBudget(access.householdId, target, planned);
  if (writeError) return { ok: false, message: writeError };
  refresh();
  return { ok: true, message: "Planejamento copiado do mês anterior." };
}
