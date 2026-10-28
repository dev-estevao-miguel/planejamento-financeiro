import "server-only";
import type { PlannedItem } from "@/features/finance/aggregations";
import type { IsoDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface BudgetData {
  budgetId: string | null;
  items: PlannedItem[];
}

/** The month's budget (planned amount per category). Realized values are always computed. */
export async function getBudget(householdId: string, month: IsoDate): Promise<BudgetData> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("id, budget_items(category_id, planned_amount, alert_threshold_pct)")
    .eq("household_id", householdId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  return {
    budgetId: data?.id ?? null,
    items: (data?.budget_items ?? []).map((item) => ({
      categoryId: item.category_id,
      plannedCents: toCents(item.planned_amount),
      alertThresholdPct: item.alert_threshold_pct,
    })),
  };
}
