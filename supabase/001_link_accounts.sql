-- Run this once in the Supabase dashboard's SQL Editor, BEFORE enabling
-- the Discord provider. Signing in moves a player from Postgres's anon
-- role to authenticated, and supabase_setup.sql only grants anon, so with
-- Discord on and this file not yet run, a signed-in player's game saves,
-- Rush scores and rating sync are all silently rejected. Safe to re-run.
--
-- Adds a nullable user_id column to the three tables the app already
-- writes to anonymously (keyed by client_id), so a player's existing
-- Rank Bot rating / game history / Rush scores can be "claimed" by
-- their account the first time they sign in with Discord (see
-- src/utils/accountMigration.js).
--
-- Security note, read before running: the UPDATE policy below lets any
-- signed-in user claim an *unclaimed* row (user_id IS NULL) as long as
-- they supply its client_id. client_id is a crypto.randomUUID() (122
-- bits of randomness) generated client-side and never displayed
-- anywhere, so guessing someone else's to steal their history isn't
-- practical -- but it also isn't cryptographically enforced the way a
-- real ownership check would be. That's an acceptable tradeoff for
-- cosmetic/rating data with no financial or personal stakes; it would
-- NOT be an acceptable pattern if these tables ever held anything
-- sensitive.

alter table public.players     add column if not exists user_id uuid references auth.users(id);
alter table public.games       add column if not exists user_id uuid references auth.users(id);
alter table public.rush_scores add column if not exists user_id uuid references auth.users(id);

create index if not exists players_user_id_idx     on public.players(user_id);
create index if not exists games_user_id_idx       on public.games(user_id);
create index if not exists rush_scores_user_id_idx on public.rush_scores(user_id);

-- One claim-your-own-anonymous-rows policy per table. Existing anon
-- policies are untouched -- this only adds the ability to UPDATE the new
-- column.
drop policy if exists "claim own rows by client_id" on public.players;
create policy "claim own rows by client_id" on public.players
  for update
  to authenticated
  using (user_id is null)
  with check (auth.uid() = user_id);

drop policy if exists "claim own rows by client_id" on public.games;
create policy "claim own rows by client_id" on public.games
  for update
  to authenticated
  using (user_id is null)
  with check (auth.uid() = user_id);

drop policy if exists "claim own rows by client_id" on public.rush_scores;
create policy "claim own rows by client_id" on public.rush_scores
  for update
  to authenticated
  using (user_id is null)
  with check (auth.uid() = user_id);

-- Everything a signed-in player does, mirroring the anon policies in
-- supabase_setup.sql. The one difference: a row can only ever be stamped
-- with your own user_id, never someone else's.
drop policy if exists "signed-in insert" on public.games;
create policy "signed-in insert" on public.games
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "signed-in select" on public.games;
create policy "signed-in select" on public.games
  for select
  to authenticated
  using (true);

drop policy if exists "signed-in insert" on public.rush_scores;
create policy "signed-in insert" on public.rush_scores
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "signed-in select" on public.rush_scores;
create policy "signed-in select" on public.rush_scores
  for select
  to authenticated
  using (true);

drop policy if exists "signed-in insert" on public.players;
create policy "signed-in insert" on public.players
  for insert
  to authenticated
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "signed-in select" on public.players;
create policy "signed-in select" on public.players
  for select
  to authenticated
  using (true);

-- The rating sync is an upsert that never sends user_id, so it has to work
-- on a claimed row and on one the first claim hasn't reached yet.
drop policy if exists "signed-in update own" on public.players;
create policy "signed-in update own" on public.players
  for update
  to authenticated
  using (user_id is null or auth.uid() = user_id)
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "signed-in insert" on public.rank_bot_moves;
create policy "signed-in insert" on public.rank_bot_moves
  for insert
  to authenticated
  with check (true);

drop policy if exists "signed-in insert" on public.blind_utterances;
create policy "signed-in insert" on public.blind_utterances
  for insert
  to authenticated
  with check (true);

-- The music files are already public; this keeps listing them working once
-- a player is signed in.
drop policy if exists "signed-in list music" on storage.objects;
create policy "signed-in list music" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'music');
