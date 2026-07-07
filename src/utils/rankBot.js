import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";

/** Best-effort, mirrors gameHistory.js's saveGame -- never throws, never
 *  blocks gameplay. Upserts on client_id so each browser has exactly one
 *  row, kept current with its latest Rank Bot rating/game count. */
export async function syncRankBotToSupabase({ rankElo, rankGames, displayName }) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("players").upsert({
      client_id: getClientId(),
      display_name: (displayName || "").trim().slice(0, 24) || null,
      rank_elo: rankElo,
      rank_games: rankGames,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* rating sync is a nice-to-have, not worth surfacing an error over */
  }
}

/** Returns { rankElo, rankGames } for this browser's saved row, or null
 *  if there isn't one yet (first-ever visit, or Supabase unconfigured) --
 *  used once on mount to recover a returning player's rating on a fresh
 *  localStorage (new device/browser), not to override an in-progress
 *  session's local state. */
export async function fetchRankBotFromSupabase() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("players")
      .select("rank_elo, rank_games")
      .eq("client_id", getClientId())
      .maybeSingle();
    if (error || !data || data.rank_elo == null) return null;
    return { rankElo: data.rank_elo, rankGames: data.rank_games || 0 };
  } catch {
    return null;
  }
}

/** One row per player move against Rank Bot -- best-effort, fire-and-
 *  forget, same as everything else here. gameUid links these rows back
 *  to the single games-table row for that game (see saveGame's gameUid
 *  param), so a game's whole difficulty curve can be reconstructed by
 *  querying rank_bot_moves for that game_uid ordered by ply. */
export async function logRankBotMove({ gameUid, ply, loss, eloBefore, eloAfter }) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("rank_bot_moves").insert({
      client_id: getClientId(),
      game_uid: gameUid,
      ply,
      loss: Math.round(loss),
      elo_before: eloBefore,
      elo_after: eloAfter,
    });
  } catch {
    /* analysis log is a nice-to-have, not worth surfacing an error over */
  }
}
