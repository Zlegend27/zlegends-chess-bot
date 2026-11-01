/* The rules behind the one-step-ahead Rank Bot. Instead of guessing a rating
   and playing at it, the bot searches at full strength and picks a move that
   keeps its lead at about one of this player's typical mistakes. The numbers
   come from simulated games in scripts/review-lab/rankbot-sim.mjs. */
import { MATE_EVAL } from "./reviewScoring.js";

export const START_MISTAKE = 60;
const MISTAKE_RATE = 0.1;
const MAX_COUNTED_MISTAKE = 300;
const MIN_STEP = 25;
const MAX_STEP = 200;
const STEP_PER_MISTAKE = 1.2;
const MIN_GIVE_BACK = 100;
const GIVE_BACK_SHARE = 0.6;
/* Moves this close to the engine's first choice are as good as equal. */
const EQUAL_CP = 12;
const CLOSE_PLY_MIN = 60;
const CLOSE_PLY_MAX = 84;
const ENDGAME_PIECES = 6;
const TRAP_WEIGHT = 1;

/* Average mistake size against rating, from 1,500 real games. */
const MISTAKE_TO_ELO = [[90, 470], [60, 990], [47, 1370], [41, 1790], [32, 2220], [29, 2740]];
/* The bot plays as someone slightly better than the player. */
export const BOT_ELO_EDGE = 100;

export const newGameState = (mistake = START_MISTAKE, random = Math.random) => ({
  mistake,
  expected: null,
  expectedPly: null,
  lastPly: 0,
  closePly: CLOSE_PLY_MIN + Math.floor(random() * (CLOSE_PLY_MAX - CLOSE_PLY_MIN)),
});

/** What the player's last move cost, measured from the bot's own search: the
 *  lead it expected after moving, against the lead it finds now. Takebacks
 *  change the ply, so they measure nothing. */
export function learnFromMove(state, best, ply) {
  if (state.expected == null || state.expectedPly !== ply - 2) return state.mistake;
  const cost = Math.min(MAX_COUNTED_MISTAKE, Math.max(0, best - state.expected));
  return state.mistake + (cost - state.mistake) * MISTAKE_RATE;
}

export const stepFor = (mistake) => Math.max(MIN_STEP, Math.min(MAX_STEP, mistake * STEP_PER_MISTAKE));

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

export const isClosing = (ply, closePly, pieces) => ply >= closePly || pieces <= ENDGAME_PIECES;

/** The moves worth choosing between, out of `lines` ({ uci, score }, best
 *  first). Far ahead, that means giving some of the lead back, but only part
 *  of it per move so no single move looks like a gift. Otherwise it means
 *  anything as good as the best move. `hangs(uci)` rules out moves that would
 *  leave a whole piece for free. */
export function optionsFor(lines, step, hangs) {
  const best = lines[0].score;
  if (best >= MATE_EVAL) return [lines[0]];
  const floor = best > step
    ? Math.max(step, best - Math.max(MIN_GIVE_BACK, GIVE_BACK_SHARE * (best - step)))
    : best - EQUAL_CP;
  const safe = lines.filter((l, i) => l.score >= floor && (i === 0 || !hangs(l.uci)));
  if (best <= step) return safe;
  /* Keep to the low end, or a human-looking move would stop the lead coming
     down at all. */
  const lowest = safe[safe.length - 1].score;
  const reach = Math.max(30, step / 2);
  return safe.filter((l) => l.score <= lowest + reach);
}

/** The most human option, with a boost for ones this player is likely to
 *  answer badly. `chances` is Maia's { uci: chance }, `traps` the cp the
 *  player is expected to lose replying. Without Maia, the lowest option still
 *  brings the lead down. */
export function pickOption(options, step, chances, traps = {}) {
  if (!chances) return options[options.length - 1];
  const likeliest = Math.max(...options.map((o) => chances[o.uci] ?? 0)) || 1;
  const value = (o) => (chances[o.uci] ?? 0) / likeliest + TRAP_WEIGHT * Math.min(1, (traps[o.uci] ?? 0) / (2 * step));
  return options.reduce((a, b) => (value(b) > value(a) ? b : a));
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
