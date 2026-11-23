/* How Game Review turns engine evals into labels and an accuracy score.

   The constants were fitted to 750 public Chess.com games across six
   rating bands, and checked on 750 more they never saw: accuracy lands
   within 5 points of Chess.com's about 83% of the time (typical miss 3.0).
   To retune, see scripts/review-lab (variants.mjs compares the ways of
   combining moves into one score). One curve serves every rating: a
   rating-aware version scored no better, and this one also works on games
   with no ratings. The label cutoffs are Chess.com's published ones. */
const EXPECTED_POINTS_K = 0.00240772;
const ACCURACY_B = 0.0699261;
const ACCURACY_G = 1.09872;
/* A side's score is its average move score with the shortfall from 100
   stretched by this much. Chess.com's scores spread wider than a plain
   average does: without the stretch weak games read several points high. */
const SHORTFALL_STRETCH = 1.84085;

/** Mate scores become this eval, so they sit at the end of the curve. */
export const MATE_EVAL = 2000;

/** Points lost that still count as nearly the engine's choice. */
export const NEAR_BEST_LOSS = 2;
/** Points a move must lose to get a deeper look, since a search this size can
 *  misjudge a position by 30cp or more, which is enough to change a label. */
export const RECHECK_LOSS = 3;
/** Points lost that count as a blunder. */
export const BLUNDER_LOSS = 20;

export const expectedPoints = (cp) => 100 / (1 + Math.exp(-EXPECTED_POINTS_K * cp));

/** Expected points a move gave up, from 0 to 100. Evals are the mover's. */
export const pointsLost = (before, after) => Math.max(0, expectedPoints(before) - expectedPoints(after));

export const moveAccuracy = (loss) => 100 * Math.exp(-ACCURACY_B * loss ** ACCURACY_G);

export function gradeFromLoss(loss) {
  if (loss >= BLUNDER_LOSS) return "blunder";
  if (loss >= 10) return "mistake";
  if (loss >= 5) return "inaccuracy";
  return loss >= NEAR_BEST_LOSS ? "good" : "excellent";
}

/** A side's game accuracy: the average of its moves, with the distance from
 *  100 stretched (see SHORTFALL_STRETCH) and kept within 0 to 100. Forced moves are
 *  skipped, since there was no choice to judge. Book moves and the engine's
 *  own choice score full marks. Each move is { before, after, isBest,
 *  forced, book }. Returns null if nothing could be scored. */
export function sideAccuracy(moves) {
  let sum = 0;
  let count = 0;
  for (const m of moves) {
    if (m.forced) continue;
    sum += m.book || m.isBest ? 100 : moveAccuracy(pointsLost(m.before, m.after));
    count++;
  }
  return count ? Math.max(0, 100 - SHORTFALL_STRETCH * (100 - sum / count)) : null;
}

/** Both sides' accuracy for a graded game, rounded: { white, black }, each
 *  null when that side had nothing to score. `plyScores` is gradeDetail's
 *  list, White's moves at even indexes. Used by the report card and by a
 *  shared review link, so the two always agree. */
export function gameAccuracies(plyScores) {
  const side = (parity) => {
    const acc = sideAccuracy((plyScores || []).filter((m, i) => m && i % 2 === parity));
    return acc == null ? null : Math.round(acc);
  };
  return { white: side(0), black: side(1) };
}

/** The "?a=87-72" part of a shared review link, and back. Only whole
 *  numbers 0 to 100; anything else reads as no accuracy. */
export const accuracyParam = ({ white, black }) => (white == null || black == null ? null : `${white}-${black}`);
export function readAccuracyParam(text) {
  const m = /^(\d{1,3})-(\d{1,3})$/.exec(text || "");
  if (!m) return null;
  const white = Number(m[1]), black = Number(m[2]);
  return white <= 100 && black <= 100 ? { white, black } : null;
}
