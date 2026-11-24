-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
-- One transaction: if any part fails, nothing changes.
--
-- Tested locally against a copy of the schema (supabase/rules.test.js).
--
-- The Blind Chess Trainer's progress for signed-in players: each drill's
-- level and totals, and the practice streak, so it follows the account to
-- other devices. Signed-out players keep it on their device only.
--
-- One row per account. Only that account can read or change it; nobody
-- can read anyone else's. Deleting the account deletes the row (the
-- foreign key cascades). Sizes are capped, and the flood guard from 012
-- covers new rows.

begin;

create table if not exists public.blind_training (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (pg_column_size(data) <= 8192),
  updated_at timestamptz not null default now()
);

alter table public.blind_training enable row level security;

drop policy if exists "read own blind training" on public.blind_training;
create policy "read own blind training" on public.blind_training
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "add own blind training" on public.blind_training;
create policy "add own blind training" on public.blind_training
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "change own blind training" on public.blind_training;
create policy "change own blind training" on public.blind_training
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.blind_training from anon, authenticated;
grant select, insert, update on public.blind_training to authenticated;

create index if not exists blind_training_updated_idx on public.blind_training (updated_at desc);
drop trigger if exists blind_training_flood on public.blind_training;
create trigger blind_training_flood before insert on public.blind_training
  for each row execute function public.flood_guard('300', 'updated_at');

commit;
