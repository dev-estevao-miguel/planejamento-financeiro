-- =============================================================================
-- Foundation: extensions, internal schema, enums and generic helpers.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- `private` holds security helpers and internal tables. It is NOT listed in
-- the Data API exposed schemas, so nothing here is reachable over HTTP.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Functions are executable by PUBLIC by default in Postgres; opt in instead.
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Enums (technical names in English; labels are translated in the UI)
-- -----------------------------------------------------------------------------

create type public.household_role as enum ('owner', 'admin', 'member', 'viewer');

create type public.app_permission as enum (
  'finance.view',
  'finance.create',
  'finance.edit',
  'finance.delete',
  'planning.manage',
  'members.manage',
  'household.manage'
);

create type public.member_status as enum ('active', 'inactive');
create type public.account_status as enum ('pending_activation', 'active', 'disabled');

-- `investment` = money moved from the household budget into an investment.
-- It reduces the available balance but is not consumption.
create type public.transaction_kind as enum ('income', 'expense', 'investment');
create type public.transaction_status as enum ('pending', 'paid');
create type public.record_visibility as enum ('household', 'private');

create type public.payment_method_type as enum (
  'cash',
  'debit_card',
  'credit_card',
  'pix',
  'bank_transfer',
  'bank_slip',
  'meal_voucher',
  'other'
);

create type public.recurrence_frequency as enum ('weekly', 'monthly', 'yearly');

create type public.goal_kind as enum ('general', 'emergency_reserve');
create type public.goal_status as enum ('active', 'achieved', 'archived');

create type public.investment_type as enum (
  'savings',
  'fixed_income',
  'treasury',
  'stocks',
  'real_estate_funds',
  'funds',
  'crypto',
  'pension',
  'other'
);

create type public.investment_entry_kind as enum ('contribution', 'withdrawal', 'balance_update');

create type public.notification_type as enum (
  'transaction_created',
  'transaction_updated',
  'transaction_deleted',
  'budget_updated',
  'budget_threshold',
  'bill_due',
  'goal_reached',
  'member_joined',
  'system'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

-- First day of the month of `value`. Monthly competences are always stored as
-- a DATE on day 1 (never as free-form strings like "Out/2026").
create or replace function private.month_start(value date)
returns date
language sql
immutable
parallel safe
set search_path = ''
as $$
  select make_date(extract(year from value)::int, extract(month from value)::int, 1)
$$;

-- Accent/case-insensitive search key: "Mercado Extra" -> "mercado extra",
-- "Farmácia" -> "farmacia".
create or replace function private.normalize_search(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')))
$$;

-- Used by CHECK constraints and generated columns, which are evaluated with
-- the privileges of the writing role.
grant execute on function private.month_start(date) to authenticated, service_role;
grant execute on function private.normalize_search(text) to authenticated, service_role;

-- Keeps `updated_at` current and stamps `updated_by` on tables that have it.
-- jsonb_populate_record ignores keys that the row type does not have.
create or replace function private.touch_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_patch jsonb := jsonb_build_object('updated_at', now());
begin
  if auth.uid() is not null then
    v_patch := v_patch || jsonb_build_object('updated_by', auth.uid());
  end if;
  new := jsonb_populate_record(new, v_patch);
  return new;
end;
$$;
