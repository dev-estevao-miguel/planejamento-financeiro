import type { Enums } from "@/types/database";

type HouseholdRole = Enums<"household_role">;
export type AppPermission = Enums<"app_permission">;

/** Mirrors public.role_permissions (tenancy migration). The database stays the
 *  authority: this only decides what the interface offers. */
const ROLE_PERMISSIONS: Record<Exclude<HouseholdRole, "owner">, readonly AppPermission[]> = {
  admin: [
    "finance.view",
    "finance.create",
    "finance.edit",
    "finance.delete",
    "planning.manage",
    "members.manage",
    "household.manage",
  ],
  member: ["finance.view", "finance.create", "finance.edit"],
  viewer: ["finance.view"],
};

const ALL_PERMISSIONS: readonly AppPermission[] = ROLE_PERMISSIONS.admin;

/** Role defaults plus per-member overrides; the owner always holds everything. */
export function effectivePermissions(
  role: HouseholdRole,
  overrides: readonly { permission: AppPermission; granted: boolean }[],
): AppPermission[] {
  if (role === "owner") return [...ALL_PERMISSIONS];
  const permissions = new Set(ROLE_PERMISSIONS[role]);
  for (const { permission, granted } of overrides) {
    if (granted) permissions.add(permission);
    else permissions.delete(permission);
  }
  return ALL_PERMISSIONS.filter((permission) => permissions.has(permission));
}

export function can(household: { permissions: readonly AppPermission[] } | null, permission: AppPermission): boolean {
  return household?.permissions.includes(permission) ?? false;
}
