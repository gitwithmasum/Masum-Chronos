-- MASUM CHRONOS — dedicated Supabase project schema (v2 cloud foundation).
-- Run this in a NEW, dedicated Supabase project. Never install in Aurora Bachelor or NovaStudy.
-- All exposed tables have row-level security. Never put service-role credentials in the app.

create table if not exists public.chronos_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 100),
  payload jsonb not null default '{}'::jsonb,
  modified_at bigint not null check (modified_at >= 0),
  deleted boolean not null default false,
  primary key (user_id, id),
  constraint chronos_mission_payload_type check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.chronos_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  modified_at bigint not null check (modified_at >= 0),
  constraint chronos_pref_payload_type check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.chronos_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint chronos_backup_payload_type check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists chronos_missions_user_changed on public.chronos_missions (user_id, modified_at desc);
create index if not exists chronos_backups_user_latest on public.chronos_backups (user_id, created_at desc);

alter table public.chronos_missions enable row level security;
alter table public.chronos_preferences enable row level security;
alter table public.chronos_backups enable row level security;

-- Restrict all CRUD to authenticated row owners, including ownership on INSERT / UPDATE.
drop policy if exists chronos_missions_owner_read on public.chronos_missions;
create policy chronos_missions_owner_read on public.chronos_missions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists chronos_missions_owner_insert on public.chronos_missions;
create policy chronos_missions_owner_insert on public.chronos_missions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists chronos_missions_owner_update on public.chronos_missions;
create policy chronos_missions_owner_update on public.chronos_missions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists chronos_missions_owner_delete on public.chronos_missions;
create policy chronos_missions_owner_delete on public.chronos_missions for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists chronos_preferences_owner_read on public.chronos_preferences;
create policy chronos_preferences_owner_read on public.chronos_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists chronos_preferences_owner_insert on public.chronos_preferences;
create policy chronos_preferences_owner_insert on public.chronos_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists chronos_preferences_owner_update on public.chronos_preferences;
create policy chronos_preferences_owner_update on public.chronos_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists chronos_backups_owner_read on public.chronos_backups;
create policy chronos_backups_owner_read on public.chronos_backups for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists chronos_backups_owner_insert on public.chronos_backups;
create policy chronos_backups_owner_insert on public.chronos_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists chronos_backups_owner_delete on public.chronos_backups;
create policy chronos_backups_owner_delete on public.chronos_backups for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase Data API access still requires explicit grants in projects with API grants disabled.
revoke all on public.chronos_missions, public.chronos_preferences, public.chronos_backups from anon;
grant select, insert, update, delete on public.chronos_missions to authenticated;
grant select, insert, update on public.chronos_preferences to authenticated;
grant select, insert, delete on public.chronos_backups to authenticated;

-- Atomic timestamp-guarded writes prevent a stale device from overwriting newer missions.
-- SECURITY INVOKER preserves caller RLS; ownership is always auth.uid(), never supplied by client.
create or replace function public.chronos_upsert_missions(p_rows jsonb)
returns void language plpgsql security invoker
set search_path = public
as $chronos$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'Expected an array with at most 500 mission rows';
  end if;
  insert into public.chronos_missions (user_id, id, payload, modified_at, deleted)
  select (select auth.uid()), x.id, coalesce(x.payload, '{}'::jsonb), x.modified_at, coalesce(x.deleted,false)
    from jsonb_to_recordset(p_rows) as x(id text, payload jsonb, modified_at bigint, deleted boolean)
   where x.id is not null and char_length(x.id) between 1 and 100 and x.modified_at >= 0
  on conflict (user_id, id) do update
     set payload = excluded.payload,
         modified_at = excluded.modified_at,
         deleted = excluded.deleted
    where excluded.modified_at > public.chronos_missions.modified_at
       or (excluded.modified_at = public.chronos_missions.modified_at
           and excluded.deleted = true and public.chronos_missions.deleted = false);
end;
$chronos$;
revoke all on function public.chronos_upsert_missions(jsonb) from public, anon;
grant execute on function public.chronos_upsert_missions(jsonb) to authenticated;

-- Idempotent, version-guarded preference writes prevent stale devices from overwriting newer settings.
create or replace function public.chronos_upsert_preferences(p_payload jsonb, p_modified_at bigint)
returns void language plpgsql security invoker
set search_path = public
as $chronos$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or p_modified_at < 0
     or pg_column_size(p_payload) > 131072 then raise exception 'Invalid preferences'; end if;
  insert into public.chronos_preferences(user_id,payload,modified_at)
  values((select auth.uid()),p_payload,p_modified_at)
  on conflict(user_id) do update
    set payload=excluded.payload,modified_at=excluded.modified_at
    where excluded.modified_at > public.chronos_preferences.modified_at;
end;
$chronos$;
revoke all on function public.chronos_upsert_preferences(jsonb,bigint) from public, anon;
grant execute on function public.chronos_upsert_preferences(jsonb,bigint) to authenticated;
