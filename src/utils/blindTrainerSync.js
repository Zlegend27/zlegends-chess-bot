/* Blind Chess Trainer progress for signed-in players: the device's
   progress and the account's are merged, and the result saved to both
   (supabase/013_blind_training.sql). Signed out, it does nothing and
   progress stays on the device. Never throws. */
import { getSupabase } from "./supabase";
import { storedSession } from "./restApi";
import { DRILLS } from "./blindDrills";

/** Merges two progress records: for each drill the one practised more,
 *  and the more recent streak. */
export function mergeTraining(a, b) {
  if (!b) return a;
  if (!a) return b;
  const drills = {};
  for (const d of DRILLS) {
    const x = a.drills?.[d.id], y = b.drills?.[d.id];
    drills[d.id] = !y ? x : !x ? y : (y.answered || 0) > (x.answered || 0) ? y : x;
  }
  const sa = a.streak || { last: null, count: 0 }, sb = b.streak || { last: null, count: 0 };
  const streak = (sb.last || "") > (sa.last || "") ? sb : (sa.last || "") > (sb.last || "") ? sa : (sb.count > sa.count ? sb : sa);
  return { drills, streak, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
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
    await supabase.from("blind_training").upsert({ user_id: userId, data: { drills: merged.drills, streak: merged.streak }, updated_at: new Date().toISOString() });
    return merged;
  } catch {
    return null;
  }
}
