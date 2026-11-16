import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";
import { cleanName } from "./cleanName";

/* The two leaderboards share one table, told apart by `mode`: "rush" is
   Puzzle Rush, "tactica" is Puzzle Rush Tactica (always three minutes). */
export const TACTICA_RUSH_SECONDS = 180;

/** Best-effort submit, mirroring gameHistory.js's saveGame -- never
 *  throws, never blocks the "rush over" screen from showing immediately.
 *  One row per completed run rather than "best score only" so the table
 *  doubles as a simple history if ever needed later. A Puzzle Rush score
 *  leaves `mode` to the table's default, so it saves the same before and
 *  after supabase/009_tactica_leaderboard.sql; a Tactica score needs that
 *  file run, and is quietly dropped until it is. */
export async function submitRushScore({ duration, solved, displayName, mode = "rush" }) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("rush_scores").insert({
      client_id: getClientId(),
      display_name: (displayName || "").trim().slice(0, 24) || null,
      duration_seconds: duration,
      solved,
      ...(mode === "rush" ? null : { mode }),
    });
  } catch {
    /* leaderboard is a nice-to-have, not worth surfacing an error over */
  }
}

/** Top N players for one Rush duration, best solved count first (earliest
 *  achiever breaks ties). Every run is stored as its own row, so this
 *  fetches a deeper slice and keeps only each player's best run --
 *  otherwise one person's ten attempts could fill the whole board.
 *  Reads the rush_leaderboard view (supabase/006_leaderboard_safety.sql),
 *  which leaves out players' private ids; before that file has been run it
 *  falls back to the table. Before 009 has been run the view has no `mode`:
 *  Puzzle Rush then reads it unfiltered (every row is Puzzle Rush) and
 *  Tactica has no scores. Names that aren't fit to show become "Player".
 *  Returns [] on any failure/misconfiguration so the leaderboard UI can
 *  just show "no scores yet" either way. */
export async function fetchLeaderboard(duration, limit = 10, mode = "rush") {
  const supabase = await getSupabase();
  if (!supabase) return [];
  try {
    const top = (table, key, byMode) => {
      const q = supabase
        .from(table)
        .select(key + ", display_name, solved, created_at")
        .eq("duration_seconds", duration);
      return (byMode ? q.eq("mode", mode) : q)
        .order("solved", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(limit * 10);
    };
    let key = "player_key";
    let { data, error } = await top("rush_leaderboard", key, true);
    if (error && mode !== "rush") return [];
    if (error) ({ data, error } = await top("rush_leaderboard", key, false));
    if (error) { key = "client_id"; ({ data, error } = await top("rush_scores", key, false)); }
    if (error || !data) return [];
    const seen = new Set();
    const best = [];
    for (const row of data) {
      if (seen.has(row[key])) continue;
      seen.add(row[key]);
      best.push({ display_name: cleanName(row.display_name), solved: row.solved, created_at: row.created_at });
      if (best.length >= limit) break;
    }
    return best;
  } catch {
    return [];
  }
}
