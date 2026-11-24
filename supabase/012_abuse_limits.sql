-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
-- One transaction: if any part fails, nothing changes.
--
-- Tested locally against a copy of the schema (supabase/rules.test.js).
--
-- What it fixes. The site's public key (which anyone can read from the
-- site's code) may add rows to several tables without going through the
-- site. Two holes:
--   1. Size: a saved game, a Rank Bot move, a Blind Chess phrase or a
--      player row could be any size, so a few scripted requests of
--      megabytes each could fill the free plan's 500 MB and stop saving
--      for everyone.
--   2. Rate: apart from Rush scores, nothing limited how fast rows could
--      be added, and the per-browser limit there trusts an ID the browser
--      makes up itself.
--
-- So: (1) every column the public can write gets a size limit (NOT VALID:
-- rows already there are left alone, new ones are checked), and (2) a
-- flood guard caps how many rows each table takes per minute across the
-- whole site. The caps are far above real use (a busy minute today is a
-- handful of games); when one is hit, adding fails for the rest of that
-- minute and the site carries on (saving these is never required to
-- play). Scores, events and saved games are nice to have; losing a minute
-- of them under attack beats losing the database.

begin;

-- ---------------------------------------------------------------- sizes
alter table public.games drop constraint if exists games_sane;
alter table public.games add constraint games_sane check (
  char_length(client_id) <= 64
  and (pgn is null or char_length(pgn) <= 20000)
  and (moves is null or pg_column_size(moves) <= 20000)
  and (difficulty_label is null or char_length(difficulty_label) <= 100)
  and (style is null or char_length(style) <= 100)
  and (engine_version is null or char_length(engine_version) <= 100)
  and (result_text is null or char_length(result_text) <= 200)
  and (result_reason is null or char_length(result_reason) <= 100)
) not valid;

alter table public.rank_bot_moves drop constraint if exists rank_bot_moves_sane;
alter table public.rank_bot_moves add constraint rank_bot_moves_sane check (
  char_length(client_id) <= 64
  and ply between 0 and 2000
  and (detail is null or pg_column_size(detail) <= 2048)
) not valid;

alter table public.blind_utterances drop constraint if exists blind_utterances_sane;
alter table public.blind_utterances add constraint blind_utterances_sane check (
  char_length(client_id) <= 64
  and char_length(text) <= 500
) not valid;

alter table public.players drop constraint if exists players_sane;
alter table public.players add constraint players_sane check (
  char_length(client_id) <= 64
  and (display_name is null or char_length(display_name) <= 40)
  and (rank_elo is null or rank_elo between 0 and 4000)
  and rank_games between 0 and 1000000
) not valid;

alter table public.rush_scores drop constraint if exists rush_scores_client_sane;
alter table public.rush_scores add constraint rush_scores_client_sane check (char_length(client_id) <= 64) not valid;

-- ---------------------------------------------------------- flood guard
-- flood_guard(cap, column): refuses a new row when the table already has
-- more than `cap` rows from the last minute, by `column` (created_at
-- unless given). Runs as the table owner so it can count rows the public
-- can't read; it only counts, never returns rows.
create or replace function public.flood_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int := TG_ARGV[0]::int;
  col text := coalesce(TG_ARGV[1], 'created_at');
  recent int;
begin
  execute format(
    'select count(*) from (select 1 from %I.%I where %I > now() - interval ''1 minute'' limit %s) t',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, col, cap + 1
  ) into recent;
  if recent >= cap then
    raise exception 'Too many new rows right now. Try again in a minute.' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.flood_guard() from public, anon, authenticated;

-- The counts read the newest rows, so each table needs its time indexed.
create index if not exists games_created_idx on public.games (created_at desc);
create index if not exists rank_bot_moves_created_idx on public.rank_bot_moves (created_at desc);
create index if not exists blind_utterances_created_idx on public.blind_utterances (created_at desc);
create index if not exists rush_scores_created_idx on public.rush_scores (created_at desc);
create index if not exists run_scores_created_idx on public.run_scores (created_at desc);
create index if not exists players_updated_idx on public.players (updated_at desc);

drop trigger if exists games_flood on public.games;
create trigger games_flood before insert on public.games
  for each row execute function public.flood_guard('120');
drop trigger if exists rank_bot_moves_flood on public.rank_bot_moves;
create trigger rank_bot_moves_flood before insert on public.rank_bot_moves
  for each row execute function public.flood_guard('3000');
drop trigger if exists blind_utterances_flood on public.blind_utterances;
create trigger blind_utterances_flood before insert on public.blind_utterances
  for each row execute function public.flood_guard('120');
drop trigger if exists events_flood on public.events;
create trigger events_flood before insert on public.events
  for each row execute function public.flood_guard('1500');
drop trigger if exists rush_scores_flood on public.rush_scores;
create trigger rush_scores_flood before insert on public.rush_scores
  for each row execute function public.flood_guard('300');
drop trigger if exists run_scores_flood on public.run_scores;
create trigger run_scores_flood before insert on public.run_scores
  for each row execute function public.flood_guard('300');
drop trigger if exists players_flood on public.players;
create trigger players_flood before insert on public.players
  for each row execute function public.flood_guard('300', 'updated_at');

commit;
