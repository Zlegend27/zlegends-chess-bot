/* Small chess judgements for Kinnda's drills, shared by the game and the
   script that makes the drill positions (scripts/kinnda/makeDrills.mjs).
   `eng` is the main app's engine (src/engine/chessEngine.js). */
import { M120TO64, mFrom, mTo } from "../src/engine/chessEngine.js";

/* Piece values a child learns: pawn 1, knight and bishop 3, rook 5, queen 9. */
export const VALUE = [0, 1, 3, 3, 5, 9, 100];

/** Whether a move captures something. */
export function isCapture(eng, m) {
  return eng.pieceAt(M120TO64[mTo(m)]) !== 0;
}

/** A capture that wins material: the piece taken is worth more than the one
 *  taking it, or nothing can take back. */
export function goodCapture(eng, m) {
  const to = M120TO64[mTo(m)];
  const victim = Math.abs(eng.pieceAt(to)), attacker = Math.abs(eng.pieceAt(M120TO64[mFrom(m)]));
  if (!victim) return false;
  if (VALUE[victim] > VALUE[attacker]) return true;
  return !canTakeBack(eng, m);
}

/** A capture that loses material: a cheaper piece is taken with a dearer
 *  one, and it can be taken back. */
export function badCapture(eng, m) {
  const to = M120TO64[mTo(m)];
  const victim = Math.abs(eng.pieceAt(to)), attacker = Math.abs(eng.pieceAt(M120TO64[mFrom(m)]));
  return !!victim && VALUE[attacker] > VALUE[victim] && canTakeBack(eng, m);
}

function canTakeBack(eng, m) {
  const sq = mTo(m);
  if (!eng.make(m)) return false;
  const back = eng.legalMoves().some((x) => mTo(x) === sq);
  eng.unmake();
  return back;
}

/** Whether a move gives check (and whether it's mate). */
export function checkOf(eng, m) {
  if (!eng.make(m)) return { check: false, mate: false };
  const check = eng.inCheckNow();
  const mate = check && eng.legalMoves().length === 0;
  eng.unmake();
  return { check, mate };
}
