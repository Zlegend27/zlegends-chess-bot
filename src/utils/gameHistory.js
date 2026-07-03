import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";
import { buildPgn } from "./pgn";

/** Best-effort game save — never throws, never blocks/disrupts gameplay.
 *  No-ops entirely if Supabase isn't configured (e.g. local dev without
 *  a .env file). */
export async function saveGame({ difficultyLabel, playerColor, moveList, result, finalEval, style, engineVersion }) {
  const supabase = await getSupabase();
  if (!supabase) return;
  try {
    await supabase.from("games").insert({
      client_id: getClientId(),
      difficulty_label: difficultyLabel,
      player_color: playerColor,
      moves: moveList,
      pgn: buildPgn(moveList, result.text),
      result_text: result.text,
      result_reason: result.reason,
      winner: result.winner ?? null,
      final_eval: finalEval,
      style: style ?? null,
      engine_version: engineVersion ?? null,
    });
  } catch {
    /* stats are a nice-to-have, not worth surfacing an error over */
  }
}

/** Aggregate stats for this browser's own games. Returns { error: true }
 *  if Supabase isn't configured or the fetch fails, so the UI can show a
 *  real message instead of spinning forever. */
export async function fetchStats() {
  const supabase = await getSupabase();
  if (!supabase) return { error: true, message: "Stats aren't set up on this deployment yet." };
  try {
    const { data, error } = await supabase
      .from("games")
      .select("winner, player_color, difficulty_label")
      .eq("client_id", getClientId());
    if (error || !data) {
      return { error: true, message: error?.message || "Couldn't load stats." };
    }
    let wins = 0, losses = 0, draws = 0;
    const byDifficulty = {};
    for (const g of data) {
      byDifficulty[g.difficulty_label] = (byDifficulty[g.difficulty_label] || 0) + 1;
      if (g.winner === null || g.winner === undefined || g.winner === 0) draws++;
      else if (g.winner === g.player_color) wins++;
      else losses++;
    }
    return { total: data.length, wins, losses, draws, byDifficulty };
  } catch (e) {
    return { error: true, message: e?.message || "Couldn't load stats." };
  }
}
