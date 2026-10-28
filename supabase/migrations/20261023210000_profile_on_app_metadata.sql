-- =============================================================================
-- Fix: create the profile when app_metadata receives the username.
--
-- Supabase Auth's admin createUser INSERTs the user with provider-only
-- app_metadata and applies the caller's app_metadata in a later UPDATE of the
-- same transaction. The INSERT-only trigger therefore saw no username, failed
-- the NOT NULL constraint and aborted account creation ("Database error
-- creating new user").
--
-- The profile is now created the first time app_metadata carries a username,
-- on INSERT (direct inserts) or on that UPDATE. user_metadata is still never
-- read: users can edit it themselves, app_metadata only the server.
-- =============================================================================

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(new.raw_app_meta_data ->> 'username'));
begin
  if v_username is null or v_username = ''
     or exists (select 1 from public.profiles p where p.id = new.id) then
    return new;
  end if;

  insert into public.profiles (id, username, display_name, full_name)
  values (
    new.id,
    v_username,
    coalesce(nullif(btrim(new.raw_app_meta_data ->> 'display_name'), ''), v_username),
    nullif(btrim(new.raw_app_meta_data ->> 'full_name'), '')
  );
  insert into public.profile_contacts (profile_id) values (new.id);
  insert into public.user_preferences (profile_id) values (new.id);
  return new;
end;
$$;

-- CREATE OR REPLACE keeps the existing ACL; restate it for clarity.
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_app_metadata_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (new.raw_app_meta_data ? 'username' and old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function private.handle_new_auth_user();
