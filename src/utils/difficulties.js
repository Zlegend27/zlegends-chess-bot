import { STOCKFISH_MIN_ELO } from "../engine/stockfishEngine";

/* Engine keeps this app's own homemade engine. The three tiers below it are
   backed by a real Stockfish build instead of guessed search-time
   budgets, so "1000/1500/2000" are meant to actually mean something
   against chess.com's own rating scale -- see stockfishEngine.js for why.
   Stockfish's UCI_Elo has a hard floor of 1320, so the "1000" tier adds
   an extra blunder chance on top of that floor to push it down further. */
export const DIFFICULTIES = [
  { label: "1000 Elo", stockfishElo: STOCKFISH_MIN_ELO, blunderChance: 0.3, moveTimeMs: 500 },
  { label: "1500 Elo", stockfishElo: 1500, moveTimeMs: 700 },
  { label: "2000 Elo", stockfishElo: 2000, moveTimeMs: 1000 },
  { label: "Rank Bot", id: "rank", adaptive: true, moveTimeMs: 900 },
  { label: "Engine", ms: 12000, book: true },
];

/* Levels are saved by position, and Casual used to sit at 4 with Master at 5.
   Casual players land on 1500 Elo, the nearest easy bot. */
const LIST_VERSION = 2;
export function savedLevelIdx(saved, version) {
  if (version >= LIST_VERSION || saved < 4) return saved;
  return saved === 4 ? 1 : 4;
}
export const CURRENT_LIST_VERSION = LIST_VERSION;

/** The position of a level by name, including its name before a rename. */
export function levelIdxFor(label) {
  return DIFFICULTIES.findIndex((d) => d.label === (label === "Master" ? "Engine" : label));
}
