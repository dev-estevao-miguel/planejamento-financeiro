-- =============================================================================
-- Function privilege hardening (found while validating the remote project).
--
-- The foundation migration ran `alter default privileges in schema private
-- revoke execute on functions from public`, which is a no-op: per-schema
-- default privileges can only ADD to Postgres' built-in PUBLIC EXECUTE grant,
-- never remove it. Every private function was therefore executable by PUBLIC
-- (anon included). It was not reachable — anon has no USAGE on `private` and
-- the schema is not exposed by the Data API — but least privilege demands an
-- explicit per-object revoke. New functions must be revoked the same way.
-- =============================================================================

revoke execute on all functions in schema private from public, anon, authenticated;

-- Only what is evaluated with the caller's privileges: RLS policy helpers,
-- CHECK constraints and generated columns. Trigger functions need no grant.
grant execute on function
  private.month_start(date),
  private.normalize_search(text),
  private.my_household_ids(),
  private.households_with_permission(public.app_permission),
  private.has_permission(uuid, public.app_permission),
  private.visible_profile_ids()
to authenticated, service_role;

-- Supabase's "automatic RLS" event-trigger function lives in `public`, so the
-- Data API lists it as an RPC anyone may call (advisors 0028/0029). Event
-- triggers do not check EXECUTE, so revoking it does not affect the feature.
-- Guarded because projects created without that option do not have it.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
