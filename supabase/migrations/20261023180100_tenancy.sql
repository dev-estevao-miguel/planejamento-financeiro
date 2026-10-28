-- =============================================================================
-- Multi-tenancy: profiles, households (tenants), members, roles, permissions.
--
-- Every financial record belongs to exactly one household. A user (profile)
-- can belong to several households; access is always resolved through an
-- active household_members row — never through hardcoded user checks.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: one row per auth user. Holds only non-sensitive identity data that
-- other members of the same household may see.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Login handle ("marido", "esposa"). Globally unique, stored lowercase.
  username text not null unique
    constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  display_name text not null
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  full_name text
    constraint profiles_full_name_length check (char_length(full_name) <= 160),
  avatar_url text
    constraint profiles_avatar_url_length check (char_length(avatar_url) <= 2048),
  status public.account_status not null default 'pending_activation',
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

-- -----------------------------------------------------------------------------
-- profile_contacts: sensitive contact data, readable only by its owner.
-- Changes go through server-side verification flows (no client UPDATE grant).
-- -----------------------------------------------------------------------------
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  phone_e164 text
    constraint profile_contacts_phone_format check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz,
  recovery_email text
    constraint profile_contacts_recovery_email_format
    check (char_length(recovery_email) <= 254 and recovery_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  recovery_email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profile_contacts enable row level security;
revoke all on public.profile_contacts from anon, authenticated;

-- -----------------------------------------------------------------------------
-- households: the tenant. "Família Demo" is simply an example row.
-- -----------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint households_name_length check (char_length(btrim(name)) between 2 and 80),
  currency_code char(3) not null default 'BRL'
    constraint households_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  locale text not null default 'pt-BR',
  time_zone text not null default 'America/Recife',
  emergency_reserve_months smallint not null default 6
    constraint households_emergency_reserve_months_range check (emergency_reserve_months between 1 and 36),
  -- SaaS placeholder (free/premium/family). Billing tables come later.
  plan_code text not null default 'free',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.households enable row level security;
revoke all on public.households from anon, authenticated;

-- -----------------------------------------------------------------------------
-- user_preferences
-- -----------------------------------------------------------------------------
create table public.user_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system'
    constraint user_preferences_theme check (theme in ('system', 'light', 'dark')),
  default_household_id uuid references public.households (id) on delete set null,
  locale text not null default 'pt-BR',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;

-- -----------------------------------------------------------------------------
-- household_members
-- profile_id is nullable so a household can later list dependents without a
-- login (e.g. children). Such members must have a display_name.
-- -----------------------------------------------------------------------------
create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text
    constraint household_members_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  -- Free label shown in the UI ("Marido", "Esposa", "Filho"...).
  relationship text
    constraint household_members_relationship_length check (char_length(relationship) <= 40),
  role public.household_role not null default 'member',
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint household_members_household_id_id_key unique (household_id, id),
  constraint household_members_household_profile_key unique (household_id, profile_id),
  constraint household_members_identity check (profile_id is not null or display_name is not null)
);
alter table public.household_members enable row level security;
revoke all on public.household_members from anon, authenticated;

create index household_members_profile_active_idx
  on public.household_members (profile_id, household_id)
  where status = 'active';

-- -----------------------------------------------------------------------------
-- Permissions: role defaults + per-member overrides.
-- OWNER implicitly holds every permission and cannot be restricted.
-- -----------------------------------------------------------------------------
create table public.role_permissions (
  role public.household_role not null,
  permission public.app_permission not null,
  primary key (role, permission)
);
alter table public.role_permissions enable row level security;
revoke all on public.role_permissions from anon, authenticated;

insert into public.role_permissions (role, permission) values
  ('admin', 'finance.view'),
  ('admin', 'finance.create'),
  ('admin', 'finance.edit'),
  ('admin', 'finance.delete'),
  ('admin', 'planning.manage'),
  ('admin', 'members.manage'),
  ('admin', 'household.manage'),
  ('member', 'finance.view'),
  ('member', 'finance.create'),
  ('member', 'finance.edit'),
  ('viewer', 'finance.view');

create table public.member_permissions (
  household_id uuid not null,
  member_id uuid not null,
  permission public.app_permission not null,
  -- true = grant beyond the role default; false = revoke a role default.
  granted boolean not null,
  created_at timestamptz not null default now(),
  primary key (member_id, permission),
  constraint member_permissions_member_fk foreign key (household_id, member_id)
    references public.household_members (household_id, id) on delete cascade
);
alter table public.member_permissions enable row level security;
revoke all on public.member_permissions from anon, authenticated;

-- -----------------------------------------------------------------------------
-- household_invites (flow implemented in a later phase). Only a SHA-256 hash
-- of the invite token is stored.
-- -----------------------------------------------------------------------------
create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  role public.household_role not null default 'member'
    constraint household_invites_not_owner check (role <> 'owner'),
  relationship text
    constraint household_invites_relationship_length check (char_length(relationship) <= 40),
  token_hash text not null unique,
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.household_invites enable row level security;
revoke all on public.household_invites from anon, authenticated;

create index household_invites_household_idx on public.household_invites (household_id);

-- -----------------------------------------------------------------------------
-- A household must never be left without an active owner. Deferred so that an
-- ownership transfer (promote + demote) can happen inside one transaction.
-- -----------------------------------------------------------------------------
create or replace function private.ensure_household_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.households h where h.id = old.household_id)
     and not exists (
       select 1
       from public.household_members m
       where m.household_id = old.household_id
         and m.role = 'owner'
         and m.status = 'active'
         and m.profile_id is not null
     ) then
    raise exception using errcode = 'P0001', message = 'household_owner_required';
  end if;
  return null;
end;
$$;

create constraint trigger household_members_keep_owner
  after update or delete on public.household_members
  deferrable initially deferred
  for each row execute function private.ensure_household_has_owner();

-- -----------------------------------------------------------------------------
-- New auth users get a profile. Identity data comes from app_metadata, which
-- (unlike user_metadata) cannot be edited by the user. Accounts are created by
-- the server; a missing username makes the creation fail on purpose.
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, full_name)
  values (
    new.id,
    lower(new.raw_app_meta_data ->> 'username'),
    coalesce(new.raw_app_meta_data ->> 'display_name', new.raw_app_meta_data ->> 'username'),
    new.raw_app_meta_data ->> 'full_name'
  );
  insert into public.profile_contacts (profile_id) values (new.id);
  insert into public.user_preferences (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_row();
create trigger profile_contacts_touch before update on public.profile_contacts
  for each row execute function private.touch_row();
create trigger households_touch before update on public.households
  for each row execute function private.touch_row();
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function private.touch_row();
create trigger household_members_touch before update on public.household_members
  for each row execute function private.touch_row();
