import { getSupabase } from "./supabase";
import { getClientId } from "./clientId";
import { buildPgn } from "./pgn";

/** Best-effort game save — never throws, never blocks/disrupts gameplay.
 *  No-ops entirely if Supabase isn't configured (e.g. local dev without
 *  a .env file). */
export async function saveGame({ difficultyLabel, playerColor, moveList, result, finalEval, style, engineVersion, gameUid, rankEloAtGame }) {
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
      game_uid: gameUid ?? null,
      rank_elo_at_game: rankEloAtGame ?? null,
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
    /* Abandoned games (saved for the analysis dataset with winner:null)
       must not reach the fold below -- a null winner scores 0.5 there,
       so every walked-away game would silently count as a draw.
       Explicitly ordered, too: the fold is a *sequential* Elo update, so
       the same set of games in a different order yields a different
       final rating. Postgres guarantees no ordering without an ORDER BY,
       so without this the estimate could drift between loads even though
       the player hadn't played anything. */
    const { data, error } = await supabase
      .from("games")
      .select("winner, player_color, difficulty_label, created_at")
      .eq("client_id", getClientId())
      .neq("result_reason", "Abandoned")
      .in("difficulty_label", Object.keys(ANCHOR_ELO))
      .order("created_at", { ascending: true });
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

const GAMES_UNREACHABLE = "Couldn't reach your game history right now. Check your connection and try again.";

/** Most recent saved games for this browser, newest first. Each row
 *  carries the PGN so tapping one can load it straight into review mode
 *  through the same path as a pasted game. Returns { games } or
 *  { error } -- an unconfigured or unreachable backend should read as
 *  "couldn't load", not as "you haven't played any games". */
export async function fetchRecentGames(limit = 15) {
  const supabase = await getSupabase();
  if (!supabase) return { error: "Game history isn't set up on this deployment yet." };
  try {
    const { data, error } = await supabase
      .from("games")
      .select("id, created_at, difficulty_label, player_color, winner, result_text, result_reason, pgn")
      .eq("client_id", getClientId())
      .not("pgn", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) { console.warn("[recent games]", error); return { error: GAMES_UNREACHABLE }; }
    return { games: data };
  } catch (e) {
    /* Raw fetch failures read as "TypeError: Failed to fetch" -- true, but
       not something to show a player. The detail stays in the console. */
    console.warn("[recent games]", e);
    return { error: GAMES_UNREACHABLE };
  }
}

/** Turns one saved row into what the list shows. Pure, so it can be
 *  tested without a backend. Outcome is from the player's side: an
 *  abandoned game is reported as such rather than as a loss, since
 *  walking away isn't losing. */
export function summarizeGame(row) {
  const abandoned = row.result_reason === "Abandoned";
  let outcome;
  if (abandoned) outcome = "abandoned";
  else if (row.winner == null || row.winner === 0) outcome = "draw";
  else outcome = row.winner === row.player_color ? "win" : "loss";
  const when = new Date(row.created_at);
  return {
    id: row.id,
    opponent: row.difficulty_label || "Unknown",
    playerColor: row.player_color === -1 ? -1 : 1,
    outcome,
    reason: row.result_reason || "",
    date: when.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    pgn: row.pgn,
  };
}
