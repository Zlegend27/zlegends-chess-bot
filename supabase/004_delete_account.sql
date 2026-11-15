-- Run this once in the Supabase dashboard's SQL Editor. Safe to re-run.
--
-- Lets a signed-in player delete their own account from the profile page
-- (src/utils/auth.js deleteAccount). Until this has been run, the button
-- tells them to email support instead, so nothing breaks either way.
--
-- What it deletes, for the caller only (auth.uid()): their Rank Bot move
-- log, their saved games, their Rush scores, their player row, and then
-- the account itself (which also removes its logins and sessions).
--
-- Security note: SECURITY DEFINER, because a player can't otherwise delete
-- from auth.users. It takes no arguments and only ever acts on auth.uid(),
-- so one player can't delete another. Signed-out callers are refused.

create or replace function public.delete_my_account()
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
  delete from public.rank_bot_moves
    where game_uid in (select game_uid from public.games where user_id = me and game_uid is not null);
  delete from public.games where user_id = me;
  delete from public.rush_scores where user_id = me;
  delete from public.players where user_id = me;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
