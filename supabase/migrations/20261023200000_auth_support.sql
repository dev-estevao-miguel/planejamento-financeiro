-- =============================================================================
-- Auth support for username login (Phase 2).
--
--   * Activation codes: first access and password reset without SMS. Stored
--     only as a bcrypt hash; single use; expire; burned after 5 wrong tries.
--   * Login throttling per user and per IP (keys are SHA-256 hashes computed
--     by the server, so raw IPs are never stored).
--
-- Tables live in `private` (not exposed). The functions are the only way in
-- and are executable by service_role only, i.e. by our server code.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create table private.account_activations (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  failed_attempts smallint not null default 0,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table private.auth_throttle (
  key_hash text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

-- -----------------------------------------------------------------------------
-- Activation codes
-- -----------------------------------------------------------------------------
create or replace function public.auth_issue_activation(
  p_profile_id uuid,
  p_code text,
  p_valid_for interval default interval '72 hours',
  p_issued_by uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires_at timestamptz := now() + p_valid_for;
begin
  if char_length(p_code) < 8 then
    raise exception using errcode = 'P0001', message = 'activation_code_too_short';
  end if;

  insert into private.account_activations (profile_id, code_hash, expires_at, failed_attempts, issued_by)
  values (p_profile_id, extensions.crypt(p_code, extensions.gen_salt('bf', 8)), v_expires_at, 0, p_issued_by)
  on conflict (profile_id) do update
    set code_hash = excluded.code_hash,
        expires_at = excluded.expires_at,
        failed_attempts = 0,
        issued_by = excluded.issued_by,
        created_at = now();
  return v_expires_at;
end;
$$;

-- Returns the profile id when the code is valid for that username, else NULL.
-- Every wrong code counts; after 5 the code stops working until reissued.
create or replace function public.auth_check_activation(p_username text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activation private.account_activations;
begin
  select a.* into v_activation
  from private.account_activations a
  join public.profiles p on p.id = a.profile_id
  where p.username = lower(btrim(p_username))
    and p.status <> 'disabled'
  for update of a;

  if not found or v_activation.expires_at < now() or v_activation.failed_attempts >= 5 then
    return null;
  end if;

  if extensions.crypt(p_code, v_activation.code_hash) = v_activation.code_hash then
    return v_activation.profile_id;
  end if;

  update private.account_activations
     set failed_attempts = failed_attempts + 1
   where profile_id = v_activation.profile_id;
  return null;
end;
$$;

-- Called after the password was set: burns the code and activates the account.
create or replace function public.auth_complete_activation(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.account_activations where profile_id = p_profile_id;
  update public.profiles
     set status = 'active',
         activated_at = coalesce(activated_at, now())
   where id = p_profile_id
     and status <> 'disabled';
end;
$$;

-- -----------------------------------------------------------------------------
-- Throttling: 5 failures inside a 15-minute window lock the key for 15 min,
-- doubling on every further 5 failures (capped at 24 h).
-- -----------------------------------------------------------------------------

-- Latest lock among the given keys, or NULL when none is locked.
create or replace function public.auth_throttle_locked_until(p_keys text[])
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(t.locked_until)
  from private.auth_throttle t
  where t.key_hash = any (p_keys)
    and t.locked_until > now()
$$;

create or replace function public.auth_throttle_register_failure(p_keys text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_failures integer;
begin
  foreach v_key in array p_keys loop
    insert into private.auth_throttle as t (key_hash, failures, window_started_at)
    values (v_key, 1, now())
    on conflict (key_hash) do update
      set failures = case
            when t.window_started_at < now() - interval '15 minutes'
                 and (t.locked_until is null or t.locked_until < now())
              then 1
            else t.failures + 1
          end,
          window_started_at = case
            when t.window_started_at < now() - interval '15 minutes'
                 and (t.locked_until is null or t.locked_until < now())
              then now()
            else t.window_started_at
          end
    returning failures into v_failures;

    if v_failures % 5 = 0 then
      update private.auth_throttle
         set locked_until = now() + least(interval '15 minutes' * power(2, v_failures / 5 - 1), interval '24 hours')
       where key_hash = v_key;
    end if;
  end loop;
end;
$$;

create or replace function public.auth_throttle_clear(p_keys text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.auth_throttle where key_hash = any (p_keys)
$$;

-- -----------------------------------------------------------------------------
-- Server-only: revoke the PUBLIC default and grant service_role explicitly.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.auth_issue_activation(uuid, text, interval, uuid),
  public.auth_check_activation(text, text),
  public.auth_complete_activation(uuid),
  public.auth_throttle_locked_until(text[]),
  public.auth_throttle_register_failure(text[]),
  public.auth_throttle_clear(text[])
from public, anon, authenticated;

grant execute on function
  public.auth_issue_activation(uuid, text, interval, uuid),
  public.auth_check_activation(text, text),
  public.auth_complete_activation(uuid),
  public.auth_throttle_locked_until(text[]),
  public.auth_throttle_register_failure(text[]),
  public.auth_throttle_clear(text[])
to service_role;
