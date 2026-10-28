import "server-only";
import { cache } from "react";
import type { IsoDate } from "@/lib/dates";
import { toCents, type Cents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentMethodType, TransactionKind, TransactionStatus } from "./labels";
import { searchPattern } from "./search";

/**
 * Data access for transactions and the reference data around them. Every
 * query runs as the signed-in user, so RLS decides what comes back; the
 * household filter only narrows it to the active household.
 */

export interface CategoryOption {
  id: string;
  parentId: string | null;
  kind: TransactionKind;
  name: string;
  /** "Moradia › Aluguel" for subcategories. */
  label: string;
  icon: string | null;
  color: string | null;
  isEssential: boolean;
  archived: boolean;
}

export interface MemberOption {
  id: string;
  profileId: string | null;
  name: string;
  active: boolean;
}

export interface PaymentMethodOption {
  id: string;
  name: string;
  type: PaymentMethodType;
  archived: boolean;
}

export interface FinanceOptions {
  categories: CategoryOption[];
  members: MemberOption[];
  paymentMethods: PaymentMethodOption[];
}

export interface TransactionItem {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  description: string;
  amountCents: Cents;
  occurredOn: IsoDate;
  competenceMonth: IsoDate;
  dueOn: IsoDate | null;
  isPlanned: boolean;
  isPrivate: boolean;
  notes: string | null;
  categoryId: string | null;
  memberId: string | null;
  paymentMethodId: string | null;
  recurringRuleId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  createdBy: string | null;
}

const TRANSACTION_COLUMNS =
  "id, kind, status, description, amount, occurred_on, competence_month, due_on, is_planned, visibility, notes, category_id, member_id, payment_method_id, recurring_rule_id, installment_number, installment_total, created_by";

type TransactionRow = {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  description: string;
  amount: number;
  occurred_on: string;
  competence_month: string;
  due_on: string | null;
  is_planned: boolean;
  visibility: "household" | "private";
  notes: string | null;
  category_id: string | null;
  member_id: string | null;
  payment_method_id: string | null;
  recurring_rule_id: string | null;
  installment_number: number | null;
  installment_total: number | null;
  created_by: string | null;
};

function toItem(row: TransactionRow): TransactionItem {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    description: row.description,
    amountCents: toCents(row.amount),
    occurredOn: row.occurred_on,
    competenceMonth: row.competence_month,
    dueOn: row.due_on,
    isPlanned: row.is_planned,
    isPrivate: row.visibility === "private",
    notes: row.notes,
    categoryId: row.category_id,
    memberId: row.member_id,
    paymentMethodId: row.payment_method_id,
    recurringRuleId: row.recurring_rule_id,
    installmentNumber: row.installment_number,
    installmentTotal: row.installment_total,
    createdBy: row.created_by,
  };
}

export const getFinanceOptions = cache(async (householdId: string): Promise<FinanceOptions> => {
  const supabase = await createSupabaseServerClient();
  const [categoriesResult, membersResult, methodsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, kind, name, icon, color, is_essential, sort_order, archived_at")
      .eq("household_id", householdId)
      .order("sort_order")
      .order("name"),
    supabase
      .from("household_members")
      .select("id, profile_id, display_name, status, joined_at, profile:profiles(display_name)")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase
      .from("payment_methods")
      .select("id, name, type, archived_at")
      .eq("household_id", householdId)
      .order("name"),
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (membersResult.error) throw membersResult.error;
  if (methodsResult.error) throw methodsResult.error;

  const rows = categoriesResult.data;
  const names = new Map(rows.map((row) => [row.id, row.name]));
  // Parents first, each followed by its subcategories.
  const parents = rows.filter((row) => row.parent_id === null);
  const ordered = parents.flatMap((parent) => [parent, ...rows.filter((row) => row.parent_id === parent.id)]);

  return {
    categories: ordered.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      kind: row.kind,
      name: row.name,
      label: row.parent_id ? `${names.get(row.parent_id) ?? ""} › ${row.name}` : row.name,
      icon: row.icon,
      color: row.color,
      isEssential: row.is_essential,
      archived: row.archived_at !== null,
    })),
    members: membersResult.data.map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      name: row.display_name ?? row.profile?.display_name ?? "Membro",
      active: row.status === "active",
    })),
    paymentMethods: methodsResult.data.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      archived: row.archived_at !== null,
    })),
  };
});

/**
 * Materializes due recurring occurrences for the household (idempotent and
 * cheap once up to date). Failure must never break a page, so it only logs.
 */
export const ensureRecurringTransactions = cache(async (householdId: string): Promise<void> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ensure_recurring_transactions", { p_household_id: householdId });
  if (error) console.error(`[recurrence] ensure failed (code=${error.code ?? "unknown"})`);
});

export const TRANSACTIONS_PAGE_SIZE = 50;

export interface TransactionFilters {
  month: IsoDate;
  kind?: TransactionKind;
  status?: TransactionStatus;
  memberId?: string;
  /** Matches the category and its subcategories. */
  categoryIds?: string[];
  search?: string;
  page: number;
}

export async function listTransactions(
  householdId: string,
  filters: TransactionFilters,
): Promise<{ items: TransactionItem[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS, { count: "exact" })
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .eq("competence_month", filters.month);

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.memberId) query = query.eq("member_id", filters.memberId);
  if (filters.categoryIds?.length) query = query.in("category_id", filters.categoryIds);
  if (filters.search) query = query.ilike("search_text", searchPattern(filters.search));

  const from = (filters.page - 1) * TRANSACTIONS_PAGE_SIZE;
  const { data, error, count } = await query
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE - 1);
  if (error) throw error;
  return { items: data.map(toItem), total: count ?? 0 };
}

export async function getTransaction(householdId: string, id: string): Promise<TransactionItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("household_id", householdId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? toItem(data) : null;
}

/** Page size PostgREST returns at most (Supabase default max-rows). */
const API_MAX_ROWS = 1000;

/** Every non-deleted transaction with a competence inside [from, to] (months). */
export async function getTransactionsInRange(
  householdId: string,
  range: { from: IsoDate; to: IsoDate },
): Promise<TransactionItem[]> {
  const supabase = await createSupabaseServerClient();
  const items: TransactionItem[] = [];
  for (let offset = 0; ; offset += API_MAX_ROWS) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .gte("competence_month", range.from)
      .lte("competence_month", range.to)
      .order("occurred_on")
      .order("id")
      .range(offset, offset + API_MAX_ROWS - 1);
    if (error) throw error;
    items.push(...data.map(toItem));
    if (data.length < API_MAX_ROWS) return items;
  }
}
