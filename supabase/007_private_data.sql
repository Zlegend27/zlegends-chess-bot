-- Run this once in the Supabase dashboard's SQL Editor, AFTER the site
-- version that uses these functions is live (any deploy from 2026-11-16
-- on; that version works both before and after this file). Safe to
-- re-run. One transaction: if any part fails, nothing changes.
--
-- Tested locally against a copy of the schema (supabase/rules.test.js).
--
-- What it fixes. Until now the public key could:
--   * read every saved game, player row and Rank Bot move, and
--   * overwrite any player's rating and name.
-- A browser proves a row is its own with its client_id, a random secret
-- that never leaves the browser. Rules can't check that on a plain table
-- read, so reading and updating now go through small functions that take
-- the client_id and return or change only that browser's rows (plus the
-- signed-in account's). The tables themselves stop being readable or
-- updatable with the public key. Adding rows (saving a game, logging a
-- move) is unchanged.
--
-- After this, scripts that read everything (scripts/backup.mjs,
-- scripts/review-lab/rankbot-live.mjs) need SUPABASE_SERVICE_KEY in .env.

begin;

-- A player's saved games, newest first: the signed-in account's games from
-- any device, plus this browser's games that no account has claimed.
create or replace function public.my_games(client text, lim int default 15, off int default 0)
returns table (id uuid, created_at timestamptz, difficulty_label text, player_color int, winner int, result_text text, result_reason text, pgn text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.created_at, g.difficulty_label, g.player_color, g.winner, g.result_text, g.result_reason, g.pgn
  from public.games g
  where g.pgn is not null
    and ((auth.uid() is not null and g.user_id = auth.uid()) or (g.client_id = client and g.user_id is null))
  order by g.created_at desc
  limit least(greatest(lim, 0), 100) offset greatest(off, 0);
$$;

-- This browser's finished games against the rated bots, oldest first, for
-- the rating estimate (src/utils/gameHistory.js estimateRating).
create or replace function public.my_rated_games(client text, labels text[])
returns table (winner int, player_color int, difficulty_label text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.winner, g.player_color, g.difficulty_label, g.created_at
  from public.games g
  where g.client_id = client
    and (g.user_id is null or g.user_id = auth.uid())
    and g.result_reason is distinct from 'Abandoned'
    and g.difficulty_label = any (labels)
  order by g.created_at asc
  limit 5000;
$$;

-- This browser's Rank Bot rating row.
create or replace function public.my_player(client text)
returns table (rank_elo int, rank_games int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.rank_elo, p.rank_games
  from public.players p
  where p.client_id = client and (p.user_id is null or p.user_id = auth.uid());
$$;

-- Saves this browser's Rank Bot rating and name. A row that an account has
-- claimed can only be changed by that account.
create or replace function public.sync_player(client text, name text, elo int, games int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.players (client_id, display_name, rank_elo, rank_games, updated_at)
  values (client, nullif(left(btrim(coalesce(name, '')), 24), ''), elo, coalesce(games, 0), now())
  on conflict (client_id) do update
    set display_name = excluded.display_name, rank_elo = excluded.rank_elo,
        rank_games = excluded.rank_games, updated_at = excluded.updated_at
    where players.user_id is null or players.user_id = auth.uid();
$$;

-- Signing in attaches this browser's unclaimed rows to the account.
create or replace function public.claim_my_data(client text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  update public.players set user_id = me where client_id = client and user_id is null;
  update public.games set user_id = me where client_id = client and user_id is null;
  update public.rush_scores set user_id = me where client_id = client and user_id is null;
end;
$$;

revoke all on function public.my_games(text, int, int) from public;
revoke all on function public.my_rated_games(text, text[]) from public;
revoke all on function public.my_player(text) from public;
revoke all on function public.sync_player(text, text, int, int) from public;
revoke all on function public.claim_my_data(text) from public, anon;
grant execute on function public.my_games(text, int, int) to anon, authenticated;
grant execute on function public.my_rated_games(text, text[]) to anon, authenticated;
grant execute on function public.my_player(text) to anon, authenticated;
grant execute on function public.sync_player(text, text, int, int) to anon, authenticated;
grant execute on function public.claim_my_data(text) to authenticated;

-- The tables stop being readable with the public key...
drop policy if exists "Allow anonymous select" on public.games;
drop policy if exists "signed-in select" on public.games;
drop policy if exists "Allow anonymous select players" on public.players;
drop policy if exists "signed-in select" on public.players;
drop policy if exists "Allow anonymous select rank_bot_moves" on public.rank_bot_moves;

-- ...and player rows stop being writable directly (sync_player does it).
drop policy if exists "Allow anonymous upsert players" on public.players;
drop policy if exists "Allow anonymous update own player" on public.players;
drop policy if exists "signed-in insert" on public.players;
drop policy if exists "signed-in update own" on public.players;

-- Claiming goes through claim_my_data, so the direct UPDATE policies go.
drop policy if exists "claim own rows by client_id" on public.players;
drop policy if exists "claim own rows by client_id" on public.games;
drop policy if exists "claim own rows by client_id" on public.rush_scores;

commit;
