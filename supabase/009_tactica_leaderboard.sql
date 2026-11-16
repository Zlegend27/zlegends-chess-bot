-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run. It
-- runs as one transaction: if any part fails, nothing changes.
--
-- Tested locally (supabase/rules.test.js), not against the real database.
-- The worst a mistake here can do is stop Rush scores saving or the
-- leaderboard loading, both of which the site shrugs off. After running it,
-- play a Puzzle Rush Tactica and check the score appears on its leaderboard.
--
-- Why: Puzzle Rush Tactica (Chess Tactica's three-minute puzzle mode) gets
-- its own leaderboard. Its scores go in the same table as Puzzle Rush, told
-- apart by a new `mode` column. Until this is run, Tactica scores are simply
-- not saved and its leaderboard shows as empty; Puzzle Rush is unaffected.

begin;

-- 1. Which game a score is from. Every existing row is a Puzzle Rush score.
alter table public.rush_scores add column if not exists mode text not null default 'rush';

-- 2. Only the two games, and Tactica's is always three minutes.
alter table public.rush_scores drop constraint if exists rush_scores_mode;
alter table public.rush_scores add constraint rush_scores_mode check (
  mode in ('rush', 'tactica') and (mode = 'rush' or duration_seconds = 180)
);

-- 3. The leaderboard's window shows the mode too (a new column can only be
--    added at the end of an existing view).
create or replace view public.rush_leaderboard as
  select md5(client_id) as player_key, display_name, solved, duration_seconds, created_at, mode
  from public.rush_scores;

grant select on public.rush_leaderboard to anon, authenticated;

commit;
