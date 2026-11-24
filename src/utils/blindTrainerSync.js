/* Blind Chess Trainer progress for signed-in players: the device's
   progress and the account's are merged, and the result saved to both
   (supabase/013_blind_training.sql). Signed out, it does nothing and
   progress stays on the device. Never throws. */
import { getSupabase } from "./supabase";
import { storedSession } from "./restApi";
import { STAGES } from "./blindPath";

/* How far along a stage is, for choosing between two records of it. */
const reach = (r) => (r ? (r.done ? 1000 : 0) + (r.step || 0) * 10 + Math.min(9, r.sessions || 0) : -1);

/** Merges two progress records: for each stage the one further along, and
 *  the more recent streak. A record without a path (the first version's)
 *  counts as none. */
export function mergeTraining(a, b) {
  if (!b || !b.path) return a;
  if (!a || !a.path) return b;
  const path = {};
  for (const s of STAGES) {
    const x = a.path[s.id], y = b.path[s.id];
    path[s.id] = reach(y) > reach(x) ? y : x;
  }
  const sa = a.streak || { last: null, count: 0 }, sb = b.streak || { last: null, count: 0 };
  const streak = (sb.last || "") > (sa.last || "") ? sb : (sa.last || "") > (sb.last || "") ? sa : (sb.count > sa.count ? sb : sa);
  return { path, streak, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}

export async function syncTraining(local) {
  try {
    const s = storedSession();
    const userId = s && s.expires_at * 1000 > Date.now() ? s.user?.id : null;
    if (!userId) return null;
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("blind_training").select("data").eq("user_id", userId).maybeSingle();
    /* No table yet (013 not run): stay on the device. */
    if (error) return null;
    const merged = mergeTraining(local, data?.data || null);
    await supabase.from("blind_training").upsert({ user_id: userId, data: { version: 2, path: merged.path, streak: merged.streak }, updated_at: new Date().toISOString() });
    return merged;
  } catch {
    return null;
  }
}
