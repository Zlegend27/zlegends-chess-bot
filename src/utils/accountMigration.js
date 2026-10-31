import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";

/* Folds this browser's anonymous client_id data (Rank Bot rating, game
   history, Rush scores) onto the signed-in Discord account, so a returning
   player doesn't look like they're starting from zero and their games
   follow them to other devices. Requires the `user_id` columns and RLS
   policies from supabase/001_link_accounts.sql to already exist -- see
   that file's header for why this can't just be an unconditional "let
   anyone update any row" policy.

   Runs on every load while signed in, not once per account: games played
   signed out, and Rush scores (which never carry a user_id), are only
   picked up here. It's an idempotent UPDATE ... WHERE user_id IS NULL. */
export async function claimAnonymousData(userId) {
  if (!userId) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  const clientId = getClientId();
  try {
    await Promise.all([
      supabase.from("players").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
      supabase.from("games").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
      supabase.from("rush_scores").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
    ]);
  } catch {
    /* best-effort, same as every other Supabase write in this app --
       worst case the old data stays unclaimed until the next load. */
  }
}
