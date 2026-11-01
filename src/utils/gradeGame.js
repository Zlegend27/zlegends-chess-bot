/* Labels every move of a game from its engine results. This runs in the app
   and in scripts/review-lab, so the rules measured there are the ones players
   get. Chess.com publishes what its special labels mean but not the exact
   rules, so these are our own reading of those definitions. */
import { createEngine, EMPTY, M64TO120, M120TO64, MATE, mFrom, mTo } from "../engine/chessEngine.js";
import { PTS } from "./material.js";
import { MATE_EVAL, gradeFromLoss, pointsLost } from "./reviewScoring.js";

/* A sacrifice from a won position is mopping up, and one that leaves you
   worse wasn't a good one. */
const ALREADY_WINNING_CP = 600;
const BAD_POSITION_CP = -100;
/* Material given up, after what the move itself captured. Rook for minor
   piece counts, a minor piece for a minor piece doesn't. */
const SACRIFICE_POINTS = 2;
const LEFT_EN_PRISE_POINTS = 5;
/* Points the runner-up would have cost: a Mistake or worse. */
const ONLY_MOVE_LOSS = 10;
const MISS_AFTER_LOSS = 10;
const MISS_MIN_LOSS = 5;

const KING = 6;
const pieceValue = (eng, sq120) => {
  const piece = Math.abs(eng.pieceAt(M120TO64[sq120]));
  return piece === KING ? 100 : PTS[piece] || 0;
};

/** What the side to move wins by capturing on a square, if both sides trade
 *  there sensibly and either can stop. 0 if capturing there doesn't pay. */
export function exchangeGain(eng, sq120) {
  const prize = pieceValue(eng, sq120);
  const attackers = eng.legalMoves().filter((m) => mTo(m) === sq120);
  if (!attackers.length) return 0;
  const cheapest = attackers.reduce((a, b) => (pieceValue(eng, mFrom(a)) <= pieceValue(eng, mFrom(b)) ? a : b));
  eng.make(cheapest);
  const gain = prize - exchangeGain(eng, sq120);
  eng.unmake();
  return Math.max(0, gain);
}

/** The just-moved side's pieces (knight or better, not the king) that can be
 *  taken at a profit, as { square: points }. Call with the opponent to move. */
export function hangingPieces(eng) {
  const mover = -eng.getSide();
  const out = {};
  for (let i = 0; i < 64; i++) {
    const piece = eng.pieceAt(i);
    if (piece === EMPTY || Math.sign(piece) !== mover || (PTS[Math.abs(piece)] || 0) < 3) continue;
    const gain = exchangeGain(eng, M64TO120[i]);
    if (gain > 0) out[i] = gain;
  }
  return out;
}

/** Taking this piece loses at least as much straight back, like a knight
 *  whose taker was shielding its own queen. */
export function isPoisoned(eng, sq120, gain) {
  const takers = eng.legalMoves().filter((m) => mTo(m) === sq120);
  const cheapest = takers.reduce((a, b) => (pieceValue(eng, mFrom(a)) <= pieceValue(eng, mFrom(b)) ? a : b));
  eng.make(cheapest);
  const backSquares = new Set(eng.legalMoves().map(mTo).filter((sq) => eng.pieceAt(M120TO64[sq]) !== EMPTY));
  const back = Math.max(0, ...[...backSquares].map((sq) => exchangeGain(eng, sq)));
  eng.unmake();
  return back >= gain;
}

/** A real sacrifice is new: a piece left hanging last turn too was already
 *  given up, or was never really takeable. It also has to be offered, so
 *  it's the piece that moved, or a major piece deliberately left there. A
 *  loose knight elsewhere is usually just a loose knight. */
export function sacrificedPoints(hanging, hangingBefore, captured, movedSq) {
  let most = 0;
  for (const [sq, gain] of Object.entries(hanging)) {
    if (sq in hangingBefore) continue;
    if (Number(sq) === movedSq || gain >= LEFT_EN_PRISE_POINTS) most = Math.max(most, gain);
  }
  return most - captured;
}

export function isBrilliant({ isBest, forced, inCheck, before, after, sacrificed }) {
  return isBest && !forced && !inCheck && sacrificed >= SACRIFICE_POINTS
    && before < ALREADY_WINNING_CP && after >= BAD_POSITION_CP;
}

/** The one move that holds the position, and one that took finding: getting
 *  out of check, taking back, trading or grabbing a free piece is often the
 *  only good move too, but it's never a discovery. */
export function isGreat({ isBest, forced, inCheck, before, second, obviousCapture }) {
  if (!isBest || forced || inCheck || obviousCapture || second == null) return false;
  return second < ALREADY_WINNING_CP && pointsLost(before, second) >= ONLY_MOVE_LOSS;
}

/** The opponent just went wrong, and this move handed back at least half of
 *  what that gave away. */
export const isMiss = (lastLoss, loss) => lastLoss >= MISS_AFTER_LOSS && loss >= MISS_MIN_LOSS && loss >= lastLoss / 2;

/** Scores are per position, from the side to move's view. `secondScores` is
 *  the runner-up line at each position, `bestSans` the engine's move, and
 *  `scoreOk` marks positions whose search worked. Returns one label per ply,
 *  plus the numbers accuracy is computed from (null if a ply couldn't be
 *  scored). */
export function gradeGame({ list, scores, secondScores, bestSans, scoreOk, theoryPlies }) {
  const eng = createEngine();
  const grades = [];
  const plyScores = [];
  const losses = [];
  const hangingAfter = [];
  const reviewCp = (score) => (Math.abs(score) > MATE - 2000 ? Math.sign(score) * MATE_EVAL : score);
  const skip = (grade, ply) => { grades.push(grade); plyScores.push(ply); losses.push(0); };
  let lastCaptureSq = null;

  for (let i = 0; i < list.length; i++) {
    const legal = eng.legalMoves();
    const move = legal.find((m) => eng.sanOf(m) === list[i]);
    if (!move) { skip(null, null); continue; }
    const forced = legal.length === 1;
    const inCheck = eng.inCheckNow();
    const toSq = mTo(move);
    const captured = eng.pieceAt(M120TO64[toSq]) === EMPTY ? 0 : pieceValue(eng, toSq);
    const moverValue = pieceValue(eng, mFrom(move));
    const recapture = toSq === lastCaptureSq;
    lastCaptureSq = captured ? toSq : null;
    eng.make(move);
    /* Book comes first, before the scoreOk gate: it's derived from
       theoryPlyCount, not an engine score, so a ply inside known theory
       stays graded even if its score failed. */
    if (i < theoryPlies) { skip("book", { before: 0, after: 0, isBest: false, forced, book: true }); continue; }
    if (!scoreOk[i] || !scoreOk[i + 1]) { skip(null, null); continue; }

    /* Two searches of nearly the same position can disagree a little, so
       the engine's own choice counts as losing nothing rather than picking
       up a false inaccuracy from that noise. */
    const isBest = bestSans[i] === list[i];
    /* The search has no score at a finished game's last position, so the
       move that delivers mate would otherwise read as a blunder. */
    const mated = eng.legalMoves().length === 0 && eng.inCheckNow();
    const before = reviewCp(scores[i]);
    const after = mated ? MATE_EVAL : -reviewCp(scores[i + 1]);
    const loss = isBest ? 0 : pointsLost(before, after);
    losses.push(loss);
    plyScores.push({ before, after, isBest, forced, book: false });

    const hanging = hangingPieces(eng);
    hangingAfter[i] = hanging;
    const offered = isBest
      ? Object.fromEntries(Object.entries(hanging).filter(([sq, gain]) => !isPoisoned(eng, M64TO120[sq], gain)))
      : {};
    const sacrificed = sacrificedPoints(offered, hangingAfter[i - 2] || {}, captured, M120TO64[toSq]);
    const second = secondScores[i] == null ? null : reviewCp(secondScores[i]);
    const obviousCapture = captured > 0 && (recapture || captured >= moverValue || captured > exchangeGain(eng, toSq));

    let tag = isBest ? "best" : gradeFromLoss(loss);
    if (mated) tag = "best";
    else if (isBrilliant({ isBest, forced, inCheck, before, after, sacrificed })) tag = "brilliant";
    else if (isGreat({ isBest, forced, inCheck, before, second, obviousCapture })) tag = "great";
    else if (!isBest && i > 0 && isMiss(losses[i - 1], loss)) tag = "miss";
    grades.push(tag);
  }
  return { grades, plyScores };
}
