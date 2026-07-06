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

/* The three Stockfish-backed tiers (see stockfishEngine.js) have a real,
   calibrated Elo -- Casual and Master are the homemade engine with no
   true rating, so games against them can't anchor an estimate and are
   excluded. Games against the calibrated tiers are folded in with a
   standard sequential Elo update, starting from a neutral 1000. This is
   a personal estimate only (no login, no leaderboard) -- just "roughly
   what you'd be rated if these three bots were real opponents." */
const ANCHOR_ELO = { "1000 Elo": 1000, "1500 Elo": 1500, "2000 Elo": 2000 };
const START_RATING = 1000;
const K_FACTOR = 32;

/** Returns { rating, games } from this browser's own games against the
 *  calibrated tiers, or { error: true } if Supabase isn't configured or
 *  the fetch fails. { games: 0 } means no qualifying games yet. */
export async function estimateRating() {
  const supabase = await getSupabase();
  if (!supabase) return { error: true, message: "Rating isn't set up on this deployment yet." };
  try {
    const { data, error } = await supabase
      .from("games")
      .select("winner, player_color, difficulty_label")
      .eq("client_id", getClientId())
      .in("difficulty_label", Object.keys(ANCHOR_ELO));
    if (error || !data) return { error: true, message: error?.message || "Couldn't load rating." };
    let rating = START_RATING;
    for (const g of data) {
      const opponentElo = ANCHOR_ELO[g.difficulty_label];
      if (opponentElo === undefined) continue;
      const actual = g.winner === null || g.winner === undefined || g.winner === 0 ? 0.5
        : g.winner === g.player_color ? 1 : 0;
      const expected = 1 / (1 + 10 ** ((opponentElo - rating) / 400));
      rating += K_FACTOR * (actual - expected);
    }
    return { rating: Math.round(rating), games: data.length };
  } catch (e) {
    return { error: true, message: e?.message || "Couldn't load rating." };
  }
}
