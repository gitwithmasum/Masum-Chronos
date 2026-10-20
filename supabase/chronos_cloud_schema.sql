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
