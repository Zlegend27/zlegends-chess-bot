import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";
import { loadSetting, saveSetting } from "./storage";

/* Folds this browser's anonymous client_id data (Rank Bot rating, game
   history, Rush scores) onto a freshly signed-in Discord account, so a
   returning player who just logged in for the first time doesn't look
   like they're starting from zero. Requires the `user_id` columns and
   RLS policy from supabase/001_link_accounts.sql to already exist --
   see that file's header for why this can't just be an unconditional
   "let anyone update any row" policy.

   Guarded by a per-user localStorage flag so it only ever runs once per
   account on this browser -- re-running it every reload would be
   harmless (it's an idempotent UPDATE ... WHERE user_id IS NULL) but
   pointless, and skipping the round trip is one less thing to wait on
   after signing in. */
export async function migrateAnonymousDataIfNeeded(userId) {
  if (!userId) return;
  const flagKey = `accountMigrated:${userId}`;
  if (loadSetting(flagKey, false)) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  const clientId = getClientId();
  try {
    await Promise.all([
      supabase.from("players").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
      supabase.from("games").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
      supabase.from("rush_scores").update({ user_id: userId }).eq("client_id", clientId).is("user_id", null),
    ]);
    saveSetting(flagKey, true);
  } catch {
    /* best-effort, same as every other Supabase write in this app --
       worst case the player's old data just stays unclaimed, nothing
       breaks, and this simply retries next sign-in since the flag never
       got set. */
  }
}
