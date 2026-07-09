import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";

/** Best-effort submit, mirroring gameHistory.js's saveGame -- never
 *  throws, never blocks the "rush over" screen from showing immediately.
 *  One row per completed run rather than "best score only" so the table
 *  doubles as a simple history if ever needed later. */
export async function submitRushScore({ duration, solved, displayName }) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("rush_scores").insert({
      client_id: getClientId(),
      display_name: (displayName || "").trim().slice(0, 24) || null,
      duration_seconds: duration,
      solved,
    });
  } catch {
    /* leaderboard is a nice-to-have, not worth surfacing an error over */
  }
}

/** Top N players for one Rush duration, best solved count first (earliest
 *  achiever breaks ties). Every run is stored as its own row, so this
 *  fetches a deeper slice and keeps only each player's best run --
 *  otherwise one person's ten attempts could fill the whole board.
 *  Returns [] on any failure/misconfiguration so the leaderboard UI can
 *  just show "no scores yet" either way. */
export async function fetchLeaderboard(duration, limit = 10) {
  const supabase = await getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("rush_scores")
      .select("client_id, display_name, solved, created_at")
      .eq("duration_seconds", duration)
      .order("solved", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit * 10);
    if (error || !data) return [];
    const seen = new Set();
    const best = [];
    for (const row of data) {
      if (seen.has(row.client_id)) continue;
      seen.add(row.client_id);
      best.push(row);
      if (best.length >= limit) break;
    }
    return best;
  } catch {
    return [];
  }
}
