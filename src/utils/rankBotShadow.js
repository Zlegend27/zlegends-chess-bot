/* The rules behind the one-step-ahead Rank Bot. Instead of guessing a rating
   and playing at it, the bot searches at full strength and stays one of this
   player's typical mistakes ahead in position, and at least even in material.
   Below that it stops being human and plays the engine's best moves until
   it's back in front. The numbers come from 1,500 real games and from simulated
   games in scripts/review-lab/rankbot-sim.mjs. */
import { MATE_EVAL } from "./reviewScoring.js";

const START_MISTAKE = 38;
const MAX_COUNTED_MISTAKE = 300;
/* Moves remembered, across games, and how many it takes to trust them. */
const MEMORY = 80;
/* Below this many, the estimate leans on the starting guess. */
const SETTLED_MOVES = 16;
/* Enough moves to span a couple of games, before a rating or a best level
   rests on them. */
const TRUSTED_MOVES = 40;
/* Once a game is decided, moves say little about skill, so they aren't
   counted. */
const DECIDED_CP = 400;
/* The worst of those moves are left out, so one blunder doesn't read as a
   collapse in skill. */
const KEPT_SHARE = 0.9;
const MIN_STEP = 25;
const MAX_STEP = 200;
const STEP_PER_MISTAKE = 1.5;
const MIN_GIVE_BACK = 100;
const GIVE_BACK_SHARE = 0.6;
const CLOSE_PLY_MIN = 60;
const CLOSE_PLY_MAX = 84;
const ENDGAME_PIECES = 6;
const TRAP_WEIGHT = 1;
const SLOW_SEARCH_MS = 2500;
const QUICK_SEARCH_MS = 1200;
const MIN_PACE = 0.3;

/* That average mistake against rating, from 1,500 real games. */
const MISTAKE_TO_ELO = [[53.4, 470], [38.5, 985], [31.2, 1370], [28.6, 1795], [21.8, 2215], [20.8, 2735]];
/* A player can always play above their recent form, so predictions aim
   higher than the estimate. */
const POTENTIAL_MARGIN = 200;
/* The bot plays as someone slightly better than that. */
const BOT_ELO_EDGE = 100;

export const newGameState = ({ recent = [], peakElo = 0, pace = 1 } = {}, random = Math.random) => ({
  recent,
  peakElo,
  pace,
  expected: null,
  expectedPly: null,
  lastPly: 0,
  closePly: CLOSE_PLY_MIN + Math.floor(random() * (CLOSE_PLY_MAX - CLOSE_PLY_MIN)),
});

/** The player's average mistake, leaving out their worst moves. Early on,
 *  most of it is the starting guess. */
export function mistakeFor(recent) {
  const known = [...recent, ...new Array(Math.max(0, SETTLED_MOVES - recent.length)).fill(START_MISTAKE)];
  const sorted = known.sort((a, b) => a - b).slice(0, Math.ceil(known.length * KEPT_SHARE));
  return sorted.reduce((a, b) => a + b, 0) / sorted.length;
}

export function eloFor(mistake) {
  const table = MISTAKE_TO_ELO;
  if (mistake >= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [m1, e1] = table[i - 1];
    const [m2, e2] = table[i];
    if (mistake >= m2) return Math.round(e1 + ((m1 - mistake) / (m1 - m2)) * (e2 - e1));
  }
  return table[table.length - 1][1];
}

/** Notes what the player's last move cost, measured from the bot's own search:
 *  the lead it expected after moving, against the lead it finds now. Takebacks
 *  change the ply, so they measure nothing. Returns the cost, or null if
 *  this move didn't count. */
export function learnFromMove(state, best, ply) {
  if (state.expected == null || state.expectedPly !== ply - 2 || Math.abs(state.expected) >= DECIDED_CP) return null;
  const cost = Math.min(MAX_COUNTED_MISTAKE, Math.max(0, best - state.expected));
  state.recent = [...state.recent, cost].slice(-MEMORY);
  if (state.recent.length >= TRUSTED_MOVES) state.peakElo = Math.max(state.peakElo, eloFor(mistakeFor(state.recent)));
  return cost;
}

export const isTrusted = (state) => state.recent.length >= TRUSTED_MOVES;

export const stepFor = (mistake) => Math.max(MIN_STEP, Math.min(MAX_STEP, mistake * STEP_PER_MISTAKE));

/** The ratings the bot plans around: what this player has shown, and what
 *  they might still play like. */
export function levelsFor(state) {
  const elo = eloFor(mistakeFor(state.recent));
  const potential = Math.max(elo, state.peakElo) + POTENTIAL_MARGIN;
  return { elo, potential, botElo: potential + BOT_ELO_EDGE };
}

/** How much of the full search to run next, so a slow phone still gets a
 *  reply in reasonable time. It backs off after a slow search and recovers
 *  after a quick one. */
export function nextPace(pace, searchMs) {
  if (searchMs > SLOW_SEARCH_MS) return Math.max(MIN_PACE, pace * 0.7);
  if (searchMs < QUICK_SEARCH_MS) return Math.min(1, pace * 1.2);
  return pace;
}

export const isClosing = (ply, closePly, pieces) => ply >= closePly || pieces <= ENDGAME_PIECES;

/** Behind in position or in material, even after the engine's best line. */
export const isLeadLost = (best, step) => best.score < step || best.material < 0;

/** The moves worth choosing between, out of `lines` ({ uci, score, material },
 *  best first). With the lead lost, only the engine's move. Otherwise anything
 *  that keeps him a step ahead and at least even in material, leaving only
 *  moves near the bottom of that range, so a big lead comes down. It comes
 *  down in part per move, so no one move looks like a gift. `hangs(uci)` rules
 *  out moves that leave a whole piece for free. */
export function optionsFor(lines, step, hangs) {
  const best = lines[0];
  if (best.score >= MATE_EVAL || isLeadLost(best, step)) return [best];
  const floor = Math.max(step, best.score - Math.max(MIN_GIVE_BACK, GIVE_BACK_SHARE * (best.score - step)));
  const safe = lines.filter((l, i) => i === 0 || (l.score >= floor && l.material >= 0 && !hangs(l.uci)));
  const lowest = safe[safe.length - 1].score;
  const reach = Math.max(30, step / 2);
  return safe.filter((l) => l.score <= lowest + reach);
}

/** Options from most to least wanted: the most human, with a boost for ones
 *  this player is likely to answer badly. `chances` is Maia's { uci: chance },
 *  `traps` the cp the player is expected to lose replying. Without Maia, the
 *  lowest option first still brings the lead down. */
export function rankOptions(options, step, chances, traps = {}) {
  if (!chances) return [...options].reverse();
  const likeliest = Math.max(...options.map((o) => chances[o.uci] ?? 0)) || 1;
  const value = (o) => (chances[o.uci] ?? 0) / likeliest + TRAP_WEIGHT * Math.min(1, (traps[o.uci] ?? 0) / (2 * step));
  return [...options].sort((a, b) => value(b) - value(a));
}

/** The cp a player is expected to give up replying, given Maia's chances and
 *  the engine's reply `lines`, best first. A reply outside the lines counts
 *  as being as bad as the worst one listed. */
export function expectedReplyLoss(chances, lines) {
  const best = lines[0].score;
  const worst = lines[lines.length - 1].score;
  const scores = Object.fromEntries(lines.map((l) => [l.uci, l.score]));
  return Object.entries(chances).reduce((sum, [uci, chance]) => sum + chance * (best - (scores[uci] ?? worst)), 0);
}
