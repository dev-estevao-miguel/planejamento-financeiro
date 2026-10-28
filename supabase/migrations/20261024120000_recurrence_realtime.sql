-- =============================================================================
-- Recurring transactions generator, scheduled job and Realtime publication.
--
--   * private.rule_occurrences: occurrence dates of a rule inside a window
--     (day 31 falls on the last day of shorter months).
--   * private.generate_recurring_transactions: materializes occurrences into
--     `transactions` up to the end of NEXT month (household time zone).
--     Idempotent: unique (recurring_rule_id, occurrence_date) + generated_until,
--     so a soft-deleted occurrence never comes back.
--   * public.ensure_recurring_transactions: the same generator on demand for
--     one household, so the app never depends on the scheduled job having run.
--   * pg_cron (00:05 America/Recife = 03:05 UTC) where the extension exists.
--   * Realtime: transactions, budget_items and notifications are published;
--     postgres_changes applies the same RLS as the Data API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit: generated_until moves every day; it is bookkeeping, not a user change.
-- Same function as in the notifications_audit migration, plus that column.
-- -----------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity constant text := tg_argv[0];
  -- Bookkeeping columns that add noise without meaning.
  v_ignored constant text[] := array['created_at', 'updated_at', 'updated_by', 'search_text', 'generated_until'];
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

-- -----------------------------------------------------------------------------
-- Occurrence dates of a rule inside [p_from, p_to]
-- -----------------------------------------------------------------------------
create or replace function private.rule_occurrences(
  p_frequency public.recurrence_frequency,
  p_interval_count integer,
  p_day_of_month integer,
  p_starts_on date,
  p_from date,
  p_to date
)
returns setof date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day integer := coalesce(p_day_of_month, extract(day from p_starts_on)::int);
  v_step_months integer := case p_frequency when 'yearly' then 12 else 1 end * p_interval_count;
  v_month date := private.month_start(p_starts_on);
  v_last_day integer;
  v_date date;
begin
  if p_to < p_from then
    return;
  end if;

  if p_frequency = 'weekly' then
    v_date := p_starts_on;
    if p_from > p_starts_on then
      -- Jump straight to the first occurrence inside the window.
      v_date := p_starts_on + ((p_from - p_starts_on) / (7 * p_interval_count)) * 7 * p_interval_count;
    end if;
    while v_date <= p_to loop
      if v_date >= p_from then
        return next v_date;
      end if;
      v_date := v_date + 7 * p_interval_count;
    end loop;
    return;
  end if;

  loop
    v_last_day := extract(day from (v_month + interval '1 month' - interval '1 day'))::int;
    v_date := v_month + (least(v_day, v_last_day) - 1);
    exit when v_date > p_to;
    if v_date >= p_from and v_date >= p_starts_on then
      return next v_date;
    end if;
    v_month := (v_month + make_interval(months => v_step_months))::date;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Generator. NULL = every household (scheduled job).
-- -----------------------------------------------------------------------------
create or replace function private.generate_recurring_transactions(p_household_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
  v_from date;
  v_to date;
  v_count integer;
  v_total integer := 0;
begin
  for v_rule in
    select
      r.*,
      -- Last day of next month, in the household's calendar.
      (private.month_start((now() at time zone h.time_zone)::date) + interval '2 months' - interval '1 day')::date
        as horizon
    from public.recurring_rules r
    join public.households h on h.id = r.household_id
    where r.paused_at is null
      and (p_household_id is null or r.household_id = p_household_id)
    for update of r skip locked
  loop
    v_from := greatest(coalesce(v_rule.generated_until + 1, v_rule.starts_on), v_rule.starts_on);
    v_to := least(v_rule.horizon, coalesce(v_rule.ends_on, v_rule.horizon));
    continue when v_to < v_from;

    insert into public.transactions (
      household_id, kind, status, description, amount, category_id, member_id, payment_method_id,
      occurred_on, due_on, is_planned, notes, recurring_rule_id, occurrence_date, created_by
    )
    select
      v_rule.household_id, v_rule.kind, v_rule.default_status, v_rule.description, v_rule.amount,
      v_rule.category_id, v_rule.member_id, v_rule.payment_method_id,
      d, case when v_rule.kind = 'expense' then d end, true, v_rule.notes, v_rule.id, d, v_rule.created_by
    from private.rule_occurrences(
      v_rule.frequency, v_rule.interval_count, v_rule.day_of_month, v_rule.starts_on, v_from, v_to
    ) as d
    on conflict (recurring_rule_id, occurrence_date) do nothing;

    get diagnostics v_count = row_count;
    v_total := v_total + v_count;

    update public.recurring_rules set generated_until = v_to where id = v_rule.id;
  end loop;

  return v_total;
end;
$$;

-- Resuming a paused rule does not back-fill the period it was paused.
create or replace function private.skip_paused_occurrences()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.paused_at is not null and new.paused_at is null then
    new.generated_until := greatest(coalesce(old.generated_until, new.starts_on - 1), current_date - 1);
  end if;
  return new;
end;
$$;

create trigger recurring_rules_resume
  before update of paused_at on public.recurring_rules
  for each row execute function private.skip_paused_occurrences();

create or replace function public.ensure_recurring_transactions(p_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission(p_household_id, 'finance.view') then
    raise exception using errcode = 'P0001', message = 'not_found_or_forbidden';
  end if;
  return private.generate_recurring_transactions(p_household_id);
end;
$$;

revoke execute on function
  private.rule_occurrences(public.recurrence_frequency, integer, integer, date, date, date),
  private.generate_recurring_transactions(uuid),
  private.skip_paused_occurrences()
from public, anon, authenticated;
revoke all on function public.ensure_recurring_transactions(uuid) from public, anon;
grant execute on function public.ensure_recurring_transactions(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Scheduled job (Supabase). Skipped where pg_cron is not available (tests).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'generate-recurring-transactions',
      '5 3 * * *',
      'select private.generate_recurring_transactions()'
    );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Realtime. Skipped where the Supabase publication does not exist (tests).
-- -----------------------------------------------------------------------------
do $$
declare
  v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;
  foreach v_table in array array['transactions', 'budget_items', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
