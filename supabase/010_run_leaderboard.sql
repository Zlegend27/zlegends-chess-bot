-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run. It
-- runs as one transaction: if any part fails, nothing changes.
--
-- NOT TESTED against the real database (written without access to it). The
-- worst a mistake here can do is stop Rogue Chess Run scores saving or its
-- leaderboard loading, both of which the site shrugs off; it does not touch
-- games, accounts, ratings or the Rush scores. After running it, finish a
-- Rogue Chess Run from floor 1 and check it shows on the leaderboard's
-- "Rogue Run" tab.
--
-- Why: Chess Tactica's Rogue Chess Run gets a leaderboard. Only runs from
-- floor 1 are sent. A run's score is its floors cleared (a floor taken with
-- a challenge counts double), so at most 80 for the 40 floors.
--
-- Privacy, as for the Rush scores (006_leaderboard_safety.sql): the public
-- key may add rows but not read the table; the leaderboard reads a view
-- that scrambles the browser's private client_id. A signed-in player's
-- scores carry their account and are deleted with it.

begin;

create table if not exists public.run_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id text not null,
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  display_name text,
  score int not null,
  floor int not null,
  won boolean not null default false,
  hard boolean not null default false
);

-- Scores have to be possible.
alter table public.run_scores drop constraint if exists run_scores_sane;
alter table public.run_scores add constraint run_scores_sane check (
  score between 0 and 100
  and floor between 1 and 40
  and (won = false or floor = 40)
  and char_length(client_id) between 8 and 64
  and (display_name is null or char_length(display_name) <= 24)
);

-- Anyone may add a score, as themselves or signed out; nobody reads the
-- table with the public key.
alter table public.run_scores enable row level security;
revoke select, update, delete on public.run_scores from anon, authenticated;
drop policy if exists "add run scores" on public.run_scores;
create policy "add run scores" on public.run_scores
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- The leaderboard's window: a scrambled player key, no client_id.
create or replace view public.run_leaderboard as
  select md5(client_id) as player_key, display_name, score, floor, won, hard, created_at
  from public.run_scores;
grant select on public.run_leaderboard to anon, authenticated;

-- A speed bump against floods: 20 runs an hour per browser (a real run
-- takes far longer than three minutes).
create or replace function public.run_scores_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.run_scores
      where client_id = new.client_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many runs this hour';
  end if;
  return new;
end;
$$;

drop trigger if exists run_scores_limit on public.run_scores;
create trigger run_scores_limit
  before insert on public.run_scores
  for each row execute function public.run_scores_limit();

commit;
