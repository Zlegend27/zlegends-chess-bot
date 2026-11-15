-- Run this once in the Supabase dashboard's SQL Editor, AFTER the site
-- version that reads the leaderboard through `rush_leaderboard` is live
-- (any deploy from 2026-11-16 on). Safe to re-run. It runs as one
-- transaction: if any part fails, nothing changes.
--
-- NOT YET TESTED against a real database (written 2026-11-15 without
-- access to one). The worst a mistake here can do is stop Rush scores
-- saving or the leaderboard loading, both of which the site shrugs off;
-- it does not touch games, accounts or ratings. After running it, play a
-- Rush and check the score appears on the leaderboard.
--
-- Why: the leaderboard used to read `rush_scores` directly, and every row
-- there carries the player's client_id: the private random ID that keys
-- their saved games and lets an account claim them. Anyone could list
-- those IDs. This gives the leaderboard its own view with the ID scrambled,
-- stops the public key reading the table itself, and adds sanity limits
-- so impossible scores and floods are refused.

begin;

-- 1. The leaderboard's own window onto the scores: a scrambled player key
--    (enough to keep one row per player), no client_id.
create or replace view public.rush_leaderboard as
  select md5(client_id) as player_key, display_name, solved, duration_seconds, created_at
  from public.rush_scores;

grant select on public.rush_leaderboard to anon, authenticated;

-- 2. The public key no longer reads the table itself.
drop policy if exists "Allow anonymous select rush_scores" on public.rush_scores;
drop policy if exists "signed-in select" on public.rush_scores;

-- 2b. Signing in used to attach this browser's scores to the account with a
--     plain UPDATE, which needs to read the rows first. With reading closed,
--     it goes through this function instead (src/utils/accountMigration.js).
create or replace function public.claim_rush_scores(client text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rush_scores set user_id = auth.uid()
    where client_id = client and user_id is null and auth.uid() is not null;
$$;
revoke all on function public.claim_rush_scores(text) from public, anon;
grant execute on function public.claim_rush_scores(text) to authenticated;

-- 3. Scores have to be possible: a real duration, and no more than one
--    puzzle a second. NOT VALID leaves existing rows alone.
alter table public.rush_scores drop constraint if exists rush_scores_sane;
alter table public.rush_scores add constraint rush_scores_sane check (
  duration_seconds in (60, 180, 300)
  and solved between 0 and duration_seconds
  and (display_name is null or char_length(display_name) <= 24)
) not valid;

-- 4. A speed bump against floods: 40 scores an hour per browser.
create or replace function public.rush_scores_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.rush_scores
      where client_id = new.client_id and created_at > now() - interval '1 hour') >= 40 then
    raise exception 'too many scores this hour';
  end if;
  return new;
end;
$$;

drop trigger if exists rush_scores_limit on public.rush_scores;
create trigger rush_scores_limit
  before insert on public.rush_scores
  for each row execute function public.rush_scores_limit();

commit;
