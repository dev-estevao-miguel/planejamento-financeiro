import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";
import { effectivePermissions, type AppPermission } from "./permissions";

export type HouseholdRole = Enums<"household_role">;
export { can, type AppPermission } from "./permissions";

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
}

export interface CurrentHousehold {
  id: string;
  name: string;
  timeZone: string;
  memberId: string;
  role: HouseholdRole;
  permissions: AppPermission[];
}

export interface AppContext {
  user: CurrentUser;
  /** NULL while the account does not belong to any household yet. */
  household: CurrentHousehold | null;
}

/**
 * Data Access Layer entry point: verifies the session (JWT checked by
 * getClaims) and returns a narrow view of the user and active household.
 * Must be called inside a <Suspense> boundary (it reads cookies).
 * Deduplicated per request with React cache().
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) redirect("/entrar");

  const [profileResult, preferencesResult, membershipsResult] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name").eq("id", userId).maybeSingle(),
    supabase.from("user_preferences").select("default_household_id").eq("profile_id", userId).maybeSingle(),
    supabase
      .from("household_members")
      .select("id, role, household:households(id, name, time_zone), member_permissions(permission, granted)")
      .eq("profile_id", userId)
      .eq("status", "active")
      .order("joined_at"),
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/entrar");

  const memberships = membershipsResult.data ?? [];
  const preferredId = preferencesResult.data?.default_household_id;
  const membership = memberships.find((m) => m.household?.id === preferredId) ?? memberships[0];

  return {
    user: { id: profile.id, username: profile.username, displayName: profile.display_name },
    household:
      membership?.household != null
        ? {
            id: membership.household.id,
            name: membership.household.name,
            timeZone: membership.household.time_zone,
            memberId: membership.id,
            role: membership.role,
            permissions: effectivePermissions(membership.role, membership.member_permissions),
          }
        : null,
  };
});

/** "Maria Demo" -> "Maria" */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}
