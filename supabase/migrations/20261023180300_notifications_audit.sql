-- =============================================================================
-- Notifications (in-app inbox + Web Push subscriptions) and audit trail.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notifications: one row per recipient. Text is NOT stored: the client renders
-- it from `type` + `data` (i18n-friendly). `data` must never contain secrets,
-- phone numbers or e-mails.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type public.notification_type not null,
  entity_type text constraint notifications_entity_type_format check (entity_type ~ '^[a-z_]{1,40}$'),
  entity_id uuid,
  data jsonb not null default '{}'::jsonb
    constraint notifications_data_object check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  type public.notification_type not null,
  in_app boolean not null default true,
  push boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (profile_id, household_id, type)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;

-- -----------------------------------------------------------------------------
-- push_subscriptions: one row per browser/device (not per user). Registered by
-- the server so an endpoint can be safely moved between accounts on a shared
-- device; clients may only list and revoke their own.
-- -----------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique
    constraint push_subscriptions_endpoint_format
    check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null constraint push_subscriptions_p256dh_length check (char_length(p256dh) <= 256),
  auth_secret text not null constraint push_subscriptions_auth_length check (char_length(auth_secret) <= 256),
  user_agent text constraint push_subscriptions_user_agent_length check (char_length(user_agent) <= 512),
  device_label text constraint push_subscriptions_device_label_length check (char_length(device_label) <= 80),
  failure_count integer not null default 0,
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create index push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id)
  where revoked_at is null;

-- -----------------------------------------------------------------------------
-- audit_logs: append-only. entity_id has no FK on purpose, so history survives
-- the deletion of the record it describes.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null constraint audit_logs_action_format check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id uuid,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;

create index audit_logs_household_created_idx on public.audit_logs (household_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Generic row auditing. Usage: execute function private.audit_row_change('<entity>')
-- Produces actions like transaction.created / transaction.updated /
-- transaction.deleted (soft or hard) / member.role_changed.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity constant text := tg_argv[0];
  -- Bookkeeping columns that add noise without meaning.
  v_ignored constant text[] := array['created_at', 'updated_at', 'updated_by', 'search_text'];
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changes jsonb;
  v_action text;
  v_household_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - v_ignored;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - v_ignored;
  end if;
  v_row := coalesce(v_new, v_old);
  v_household_id := coalesce(
    v_row ->> 'household_id',
    case when v_entity = 'household' then v_row ->> 'id' end
  )::uuid;

  -- Deleting a whole household cascades; there is nothing left to log into.
  if not exists (select 1 from public.households h where h.id = v_household_id) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_changes := jsonb_build_object('after', v_new);
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_changes := jsonb_build_object('before', v_old);
  else
    select jsonb_object_agg(n.key, jsonb_build_object('from', v_old -> n.key, 'to', n.value))
      into v_changes
      from jsonb_each(v_new) as n
     where v_old -> n.key is distinct from n.value;

    if v_changes is null then
      return null;
    end if;

    v_action := case
      when v_changes ? 'deleted_at' and v_new ->> 'deleted_at' is not null then 'deleted'
      when v_changes ? 'deleted_at' then 'restored'
      when v_changes ? 'archived_at' and v_new ->> 'archived_at' is not null then 'archived'
      when v_entity = 'member' and v_changes ? 'role' then 'role_changed'
      else 'updated'
    end;
  end if;

  insert into public.audit_logs (household_id, actor_id, action, entity_type, entity_id, changes)
  values (
    v_household_id,
    auth.uid(),
    v_entity || '.' || v_action,
    v_entity,
    (v_row ->> 'id')::uuid,
    v_changes
  );
  return null;
end;
$$;

create trigger households_audit after update on public.households
  for each row execute function private.audit_row_change('household');
create trigger household_members_audit after insert or update or delete on public.household_members
  for each row execute function private.audit_row_change('member');
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit_row_change('category');
create trigger payment_methods_audit after insert or update or delete on public.payment_methods
  for each row execute function private.audit_row_change('payment_method');
create trigger recurring_rules_audit after insert or update or delete on public.recurring_rules
  for each row execute function private.audit_row_change('recurring_rule');
create trigger transactions_audit after insert or update or delete on public.transactions
  for each row execute function private.audit_row_change('transaction');
create trigger budgets_audit after insert or update or delete on public.budgets
  for each row execute function private.audit_row_change('budget');
create trigger budget_items_audit after insert or update or delete on public.budget_items
  for each row execute function private.audit_row_change('budget_item');
create trigger financial_goals_audit after insert or update or delete on public.financial_goals
  for each row execute function private.audit_row_change('goal');
create trigger goal_contributions_audit after insert or update or delete on public.goal_contributions
  for each row execute function private.audit_row_change('goal_contribution');
create trigger investments_audit after insert or update or delete on public.investments
  for each row execute function private.audit_row_change('investment');
create trigger investment_entries_audit after insert or update or delete on public.investment_entries
  for each row execute function private.audit_row_change('investment_entry');

create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function private.touch_row();
