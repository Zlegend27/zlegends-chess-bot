/* How Game Review turns engine evals into labels and an accuracy score.

   The curve constants were fitted to 750 public Chess.com games across six
   rating bands, and checked on 750 more they never saw: accuracy lands
   within 5 points of Chess.com's about 70% of the time. To retune, see
   scripts/review-lab. One curve serves every rating: a rating-aware
   version scored no better, and this one also works on games with no
   ratings. The label cutoffs are Chess.com's published ones. */
const EXPECTED_POINTS_K = 0.002344;
const ACCURACY_B = 0.134216;
const ACCURACY_G = 1.527457;

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

/** A side's game accuracy, the plain average of its moves. Forced moves are
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
  return count ? sum / count : null;
}
