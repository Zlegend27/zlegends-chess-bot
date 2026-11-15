-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
--
-- Lets signed-in players use PRIVATE Realtime channels for the 1v1 lobbies
-- and matches (src/pvp/channel.js). Until this is run, the site falls back
-- to public channels, as before.
--
-- The rules:
--   * the two lobbies (lobby-v1, tactica-lobby-v1): any signed-in player;
--   * a match (match-<id>): only its two players. A match id ends with the
--     first 8 characters of each player's account id (see matchAt in
--     src/utils/lobby.js), so a player may join a match only if their own
--     id is in its name.
--
-- THE SECOND STEP, in the dashboard, is what actually closes the door:
-- Realtime > Settings > turn OFF "Allow public access". Do it only after
-- checking, on the live site, that the lobby still fills and a game still
-- starts between two signed-in players. With public access off, anyone
-- not signed in (and local development guests) can't join at all.
--
-- The policy logic is tested locally with a stand-in for Supabase's
-- realtime schema (supabase/rules.test.js); the live connection itself
-- can only be tested on the real site.

create or replace function public.can_join_topic(topic text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null and (
    topic in ('lobby-v1', 'tactica-lobby-v1')
    or (topic like 'match-%' and position(left(auth.uid()::text, 8) in topic) > 0)
  );
$$;

drop policy if exists "players can listen in their lobbies and matches" on realtime.messages;
create policy "players can listen in their lobbies and matches" on realtime.messages
  for select
  to authenticated
  using (public.can_join_topic((select realtime.topic())));

drop policy if exists "players can send in their lobbies and matches" on realtime.messages;
create policy "players can send in their lobbies and matches" on realtime.messages
  for insert
  to authenticated
  with check (public.can_join_topic((select realtime.topic())));
