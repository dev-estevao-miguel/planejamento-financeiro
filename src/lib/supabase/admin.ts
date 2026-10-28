import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Privileged client (secret key, bypasses RLS). Server-only and reserved for
 * flows that cannot run as the user: username login lookup, account
 * activation, push delivery and bootstrap scripts. Never pass its results to
 * the client without filtering them first.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
