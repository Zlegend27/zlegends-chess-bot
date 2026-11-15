-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
--
-- One table of small "this happened" rows written by the site's own code
-- (src/utils/track.js): a page opened, a puzzle solved, a Tactica run
-- ended, the site crashed. It's how we learn which features get used and
-- where people drop off. No third-party tracker is involved.
--
-- Until this has been run, the site notices the table is missing and
-- stops sending for that visit, so nothing breaks either way.
--
-- Privacy: anyone may ADD a row; nobody can READ rows with the public key
-- (there is no select policy). Read them in the dashboard, or with the
-- queries in supabase/stats.sql. A signed-in player's rows carry their
-- user id and are deleted with their account (004_delete_account.sql).

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 40),
  detail jsonb check (detail is null or pg_column_size(detail) <= 2048),
  client_id text check (client_id is null or char_length(client_id) <= 64),
  user_id uuid,
  app_version text check (app_version is null or char_length(app_version) <= 40)
);

create index if not exists events_name_time_idx on public.events (name, created_at desc);
create index if not exists events_time_idx on public.events (created_at desc);
create index if not exists events_user_idx on public.events (user_id) where user_id is not null;

alter table public.events enable row level security;

drop policy if exists "anyone can add an event" on public.events;
create policy "anyone can add an event" on public.events
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

revoke all on public.events from anon, authenticated;
grant insert on public.events to anon, authenticated;
