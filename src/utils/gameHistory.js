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
