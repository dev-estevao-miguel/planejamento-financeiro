import { getAppContext } from "@/features/auth/session";
import { getFinanceOptions } from "@/features/transactions/queries";
import { HouseholdRealtime } from "./household-realtime";

/** Reads the session (render inside <Suspense>) and mounts the live subscription. */
export async function RealtimeBridge() {
  const { user, household } = await getAppContext();
  if (!household) return null;
  const { members } = await getFinanceOptions(household.id);
  const names = Object.fromEntries(members.flatMap((member) => (member.profileId ? [[member.profileId, member.name]] : [])));
  return <HouseholdRealtime householdId={household.id} userId={user.id} names={names} />;
}
