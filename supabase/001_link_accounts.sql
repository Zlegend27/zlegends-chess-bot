-- Run this once in the Supabase dashboard's SQL Editor, after enabling
-- the Discord provider (see the README section on account setup).
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

-- One claim-your-own-anonymous-rows policy per table. Existing INSERT
-- policies (already in place, since anon writes already work today)
-- are untouched -- this only adds the ability to UPDATE the new column.
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
