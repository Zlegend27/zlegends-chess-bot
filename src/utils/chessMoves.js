/* Small move helpers every board needs, kept in one place. */
import { createEngine, mFrom, mTo, mPromo, M120TO64 } from "../engine/chessEngine.js";
import { replayIntoEngine } from "./share.js";

/** "e4" for a 0-63 square (a1 = 0). */
export const squareName = (i64) => "abcdefgh"[i64 % 8] + (((i64 / 8) | 0) + 1);

/** A move in the e2e4 form engines use. */
export const uciOf = (m) => squareName(M120TO64[mFrom(m)]) + squareName(M120TO64[mTo(m)]) + (["", "", "n", "b", "r", "q"][mPromo(m)] || "");

/** The legal move written `san` in `eng`'s position, or undefined. */
export const moveBySan = (eng, san) => eng.legalMoves().find((m) => eng.sanOf(m) === san);

/** { from, to } (120-squares) of the last move in a SAN list, for a
 *  last-move highlight; null for an empty or broken list. */
export function lastMoveOf(moves) {
  if (!moves.length) return null;
  const probe = createEngine();
  replayIntoEngine(probe, moves.slice(0, -1));
  const mv = moveBySan(probe, moves[moves.length - 1]);
  return mv === undefined ? null : { from: mFrom(mv), to: mTo(mv) };
}
