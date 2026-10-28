-- =============================================================================
-- Security: permission helpers, Row Level Security policies and grants.
--
-- Layers (all must agree for a write to succeed):
--   1. Table/column GRANTs: what the `authenticated` role may touch at all.
--      Columns such as household_id (on update), created_by, deleted_at and
--      generated_until are never client-writable.
--   2. RLS policies: which rows, resolved through household_members + roles.
--   3. Composite FKs (finance migration): references stay inside a household.
-- `anon` gets nothing. service_role (server only) bypasses RLS by design.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so they can read membership tables without
-- recursing into their own RLS; they only ever answer for auth.uid().
-- Policies call them as `household_id in (select ...)` so Postgres evaluates
-- them once per statement instead of once per row.
-- -----------------------------------------------------------------------------
create or replace function private.my_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
$$;

create or replace function private.households_with_permission(p_permission public.app_permission)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.profile_id = (select auth.uid())
    and m.status = 'active'
    and (
      m.role = 'owner'
      or coalesce(
        (
          select mp.granted
          from public.member_permissions mp
          where mp.member_id = m.id
            and mp.permission = p_permission
        ),
        exists (
          select 1
          from public.role_permissions rp
          where rp.role = m.role
            and rp.permission = p_permission
        )
      )
    )
$$;

create or replace function private.has_permission(p_household_id uuid, p_permission public.app_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_household_id in (select private.households_with_permission(p_permission))
$$;

-- Profiles that share at least one household with the current user (including
-- former members, so "created by" keeps resolving in history).
create or replace function private.visible_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct other.profile_id
  from public.household_members me
  join public.household_members other on other.household_id = me.household_id
  where me.profile_id = (select auth.uid())
    and me.status = 'active'
    and other.profile_id is not null
$$;

grant execute on function private.my_household_ids() to authenticated, service_role;
grant execute on function private.households_with_permission(public.app_permission) to authenticated, service_role;
grant execute on function private.has_permission(uuid, public.app_permission) to authenticated, service_role;
grant execute on function private.visible_profile_ids() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Identity & tenancy
-- -----------------------------------------------------------------------------

-- profiles
grant select on public.profiles to authenticated;
grant update (display_name, full_name, avatar_url) on public.profiles to authenticated;

create policy "profiles: read self and co-members"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select private.visible_profile_ids()));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- profile_contacts (phone etc.): owner only, read-only from the client.
grant select on public.profile_contacts to authenticated;

create policy "profile_contacts: read self"
  on public.profile_contacts for select to authenticated
  using (profile_id = (select auth.uid()));

-- user_preferences
grant select on public.user_preferences to authenticated;
grant update (theme, default_household_id, locale, onboarding_completed_at)
  on public.user_preferences to authenticated;

create policy "user_preferences: read self"
  on public.user_preferences for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "user_preferences: update self"
  on public.user_preferences for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and (default_household_id is null or default_household_id in (select private.my_household_ids()))
  );

-- households: creation / deletion go through server flows.
grant select on public.households to authenticated;
grant update (name, locale, time_zone, emergency_reserve_months) on public.households to authenticated;

create policy "households: members read"
  on public.households for select to authenticated
  using (id in (select private.my_household_ids()));

create policy "households: household.manage updates"
  on public.households for update to authenticated
  using (id in (select private.households_with_permission('household.manage')))
  with check (id in (select private.households_with_permission('household.manage')));

-- household_members / member_permissions: read-only for clients. Invites, role
-- changes and ownership transfer are server-side RPCs with explicit checks.
grant select on public.household_members to authenticated;

create policy "household_members: members read"
  on public.household_members for select to authenticated
  using (household_id in (select private.my_household_ids()));

grant select on public.member_permissions to authenticated;

create policy "member_permissions: members read"
  on public.member_permissions for select to authenticated
  using (household_id in (select private.my_household_ids()));

grant select on public.role_permissions to authenticated;

create policy "role_permissions: readable reference data"
  on public.role_permissions for select to authenticated
  using (true);

grant select (id, household_id, role, relationship, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at)
  on public.household_invites to authenticated;

create policy "household_invites: members.manage reads"
  on public.household_invites for select to authenticated
  using (household_id in (select private.households_with_permission('members.manage')));

-- -----------------------------------------------------------------------------
-- Setup data managed under planning.manage: categories, payment methods
-- (archived, never deleted, so history keeps its labels)
-- -----------------------------------------------------------------------------
grant select on public.categories to authenticated;
grant insert (id, household_id, parent_id, kind, name, icon, color, is_essential, sort_order)
  on public.categories to authenticated;
grant update (parent_id, name, icon, color, is_essential, sort_order, archived_at)
  on public.categories to authenticated;

create policy "categories: finance.view reads"
  on public.categories for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "categories: planning.manage inserts"
  on public.categories for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "categories: planning.manage updates"
  on public.categories for update to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')))
  with check (household_id in (select private.households_with_permission('planning.manage')));

grant select on public.payment_methods to authenticated;
grant insert (id, household_id, name, type, owner_member_id, closing_day, due_day)
  on public.payment_methods to authenticated;
grant update (name, type, owner_member_id, closing_day, due_day, archived_at)
  on public.payment_methods to authenticated;

create policy "payment_methods: finance.view reads"
  on public.payment_methods for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "payment_methods: planning.manage inserts"
  on public.payment_methods for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "payment_methods: planning.manage updates"
  on public.payment_methods for update to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')))
  with check (household_id in (select private.households_with_permission('planning.manage')));

-- -----------------------------------------------------------------------------
-- Transactions and recurring rules
-- -----------------------------------------------------------------------------
grant select on public.recurring_rules to authenticated;
grant insert (
  id, household_id, kind, description, amount, category_id, member_id, payment_method_id,
  frequency, interval_count, day_of_month, starts_on, ends_on, default_status, notes
) on public.recurring_rules to authenticated;
grant update (
  description, amount, category_id, member_id, payment_method_id,
  frequency, interval_count, day_of_month, ends_on, default_status, notes, paused_at
) on public.recurring_rules to authenticated;
grant delete on public.recurring_rules to authenticated;

create policy "recurring_rules: finance.view reads"
  on public.recurring_rules for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "recurring_rules: finance.create inserts"
  on public.recurring_rules for insert to authenticated
  with check (household_id in (select private.households_with_permission('finance.create')));
create policy "recurring_rules: finance.edit updates"
  on public.recurring_rules for update to authenticated
  using (household_id in (select private.households_with_permission('finance.edit')))
  with check (household_id in (select private.households_with_permission('finance.edit')));
-- Deleting a rule keeps already generated transactions (FK sets NULL).
create policy "recurring_rules: finance.delete deletes"
  on public.recurring_rules for delete to authenticated
  using (household_id in (select private.households_with_permission('finance.delete')));

-- Transactions are never hard-deleted by clients: see public.soft_delete_transaction.
-- Private transactions (visibility = 'private') are only visible to their creator.
grant select on public.transactions to authenticated;
grant insert (
  id, household_id, kind, status, description, amount, category_id, member_id, payment_method_id,
  occurred_on, competence_month, due_on, is_planned, visibility, notes,
  installment_group_id, installment_number, installment_total
) on public.transactions to authenticated;
grant update (
  kind, status, description, amount, category_id, member_id, payment_method_id,
  occurred_on, competence_month, due_on, is_planned, visibility, notes
) on public.transactions to authenticated;

create policy "transactions: finance.view reads"
  on public.transactions for select to authenticated
  using (
    household_id in (select private.households_with_permission('finance.view'))
    and (visibility = 'household' or created_by = (select auth.uid()))
  );
create policy "transactions: finance.create inserts"
  on public.transactions for insert to authenticated
  with check (
    household_id in (select private.households_with_permission('finance.create'))
    and (visibility = 'household' or created_by = (select auth.uid()))
  );
create policy "transactions: finance.edit updates"
  on public.transactions for update to authenticated
  using (
    household_id in (select private.households_with_permission('finance.edit'))
    and deleted_at is null
    and (visibility = 'household' or created_by = (select auth.uid()))
  )
  with check (
    household_id in (select private.households_with_permission('finance.edit'))
    and (visibility = 'household' or created_by = (select auth.uid()))
  );

-- Same error for "does not exist" and "not allowed": no enumeration of ids.
create or replace function public.soft_delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select t.household_id into v_household_id
  from public.transactions t
  where t.id = p_transaction_id
    and t.deleted_at is null
    and (t.visibility = 'household' or t.created_by = (select auth.uid()));

  if v_household_id is null
     or not private.has_permission(v_household_id, 'finance.delete') then
    raise exception using errcode = 'P0001', message = 'not_found_or_forbidden';
  end if;

  update public.transactions
     set deleted_at = now(), deleted_by = (select auth.uid())
   where id = p_transaction_id;
end;
$$;

create or replace function public.restore_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
begin
  select t.household_id into v_household_id
  from public.transactions t
  where t.id = p_transaction_id
    and t.deleted_at is not null
    and (t.visibility = 'household' or t.created_by = (select auth.uid()));

  if v_household_id is null
     or not private.has_permission(v_household_id, 'finance.delete') then
    raise exception using errcode = 'P0001', message = 'not_found_or_forbidden';
  end if;

  update public.transactions
     set deleted_at = null, deleted_by = null
   where id = p_transaction_id;
end;
$$;

revoke all on function public.soft_delete_transaction(uuid) from public, anon;
revoke all on function public.restore_transaction(uuid) from public, anon;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.restore_transaction(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Planning: budgets and budget items
-- -----------------------------------------------------------------------------
grant select, delete on public.budgets to authenticated;
grant insert (id, household_id, month, notes) on public.budgets to authenticated;
grant update (notes) on public.budgets to authenticated;

create policy "budgets: finance.view reads"
  on public.budgets for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "budgets: planning.manage inserts"
  on public.budgets for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "budgets: planning.manage updates"
  on public.budgets for update to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')))
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "budgets: planning.manage deletes"
  on public.budgets for delete to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')));

grant select, delete on public.budget_items to authenticated;
grant insert (id, household_id, budget_id, category_id, planned_amount, alert_threshold_pct, notes)
  on public.budget_items to authenticated;
grant update (planned_amount, alert_threshold_pct, notes) on public.budget_items to authenticated;

create policy "budget_items: finance.view reads"
  on public.budget_items for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "budget_items: planning.manage inserts"
  on public.budget_items for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "budget_items: planning.manage updates"
  on public.budget_items for update to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')))
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "budget_items: planning.manage deletes"
  on public.budget_items for delete to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')));

-- -----------------------------------------------------------------------------
-- Goals
-- -----------------------------------------------------------------------------
grant select on public.financial_goals to authenticated;
grant insert (id, household_id, kind, name, target_amount, starting_amount, target_date, icon, color, notes)
  on public.financial_goals to authenticated;
grant update (name, target_amount, starting_amount, target_date, status, achieved_at, icon, color, notes)
  on public.financial_goals to authenticated;

create policy "financial_goals: finance.view reads"
  on public.financial_goals for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "financial_goals: planning.manage inserts"
  on public.financial_goals for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "financial_goals: planning.manage updates"
  on public.financial_goals for update to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')))
  with check (household_id in (select private.households_with_permission('planning.manage')));

grant select, delete on public.goal_members to authenticated;
grant insert (household_id, goal_id, member_id) on public.goal_members to authenticated;

create policy "goal_members: finance.view reads"
  on public.goal_members for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "goal_members: planning.manage inserts"
  on public.goal_members for insert to authenticated
  with check (household_id in (select private.households_with_permission('planning.manage')));
create policy "goal_members: planning.manage deletes"
  on public.goal_members for delete to authenticated
  using (household_id in (select private.households_with_permission('planning.manage')));

grant select on public.goal_contributions to authenticated;
grant insert (id, household_id, goal_id, member_id, amount, contributed_on, transaction_id, notes)
  on public.goal_contributions to authenticated;
grant update (member_id, amount, contributed_on, notes) on public.goal_contributions to authenticated;

create policy "goal_contributions: finance.view reads"
  on public.goal_contributions for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "goal_contributions: finance.create inserts"
  on public.goal_contributions for insert to authenticated
  with check (household_id in (select private.households_with_permission('finance.create')));
create policy "goal_contributions: finance.edit updates"
  on public.goal_contributions for update to authenticated
  using (
    household_id in (select private.households_with_permission('finance.edit'))
    and deleted_at is null
  )
  with check (household_id in (select private.households_with_permission('finance.edit')));

-- -----------------------------------------------------------------------------
-- Investments
-- -----------------------------------------------------------------------------
grant select on public.investments to authenticated;
grant insert (id, household_id, name, type, institution, member_id, goal_id, objective, notes)
  on public.investments to authenticated;
grant update (name, type, institution, member_id, goal_id, objective, notes, archived_at)
  on public.investments to authenticated;

create policy "investments: finance.view reads"
  on public.investments for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "investments: finance.create inserts"
  on public.investments for insert to authenticated
  with check (household_id in (select private.households_with_permission('finance.create')));
create policy "investments: finance.edit updates"
  on public.investments for update to authenticated
  using (household_id in (select private.households_with_permission('finance.edit')))
  with check (household_id in (select private.households_with_permission('finance.edit')));

grant select on public.investment_entries to authenticated;
grant insert (id, household_id, investment_id, kind, amount, entry_date, transaction_id, notes)
  on public.investment_entries to authenticated;
grant update (kind, amount, entry_date, notes) on public.investment_entries to authenticated;

create policy "investment_entries: finance.view reads"
  on public.investment_entries for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
create policy "investment_entries: finance.create inserts"
  on public.investment_entries for insert to authenticated
  with check (household_id in (select private.households_with_permission('finance.create')));
create policy "investment_entries: finance.edit updates"
  on public.investment_entries for update to authenticated
  using (
    household_id in (select private.households_with_permission('finance.edit'))
    and deleted_at is null
  )
  with check (household_id in (select private.households_with_permission('finance.edit')));

-- -----------------------------------------------------------------------------
-- Notifications, push subscriptions, audit
-- -----------------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: recipient reads"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "notifications: recipient marks as read"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy "notifications: recipient deletes"
  on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

grant select, delete on public.notification_preferences to authenticated;
grant insert (profile_id, household_id, type, in_app, push) on public.notification_preferences to authenticated;
grant update (in_app, push) on public.notification_preferences to authenticated;

create policy "notification_preferences: own rows"
  on public.notification_preferences for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and household_id in (select private.my_household_ids())
  );

-- Keys (p256dh/auth_secret) are only needed by the server that sends pushes.
grant select (id, profile_id, user_agent, device_label, created_at, last_success_at, revoked_at)
  on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;

create policy "push_subscriptions: owner reads"
  on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "push_subscriptions: owner deletes"
  on public.push_subscriptions for delete to authenticated
  using (profile_id = (select auth.uid()));

grant select on public.audit_logs to authenticated;

create policy "audit_logs: finance.view reads"
  on public.audit_logs for select to authenticated
  using (household_id in (select private.households_with_permission('finance.view')));
