import { OPENINGS } from "./openings";

/* Recognizes which curated opening (if any) the current game matches,
   by longest common SAN prefix -- once the game runs past a curated
   entry's own move list it keeps naming that opening (nothing deeper
   to compare against), same as how a live board usually keeps showing
   "last known opening" after leaving book. */
export function detectOpening(moveList) {
  let best = null;
  for (const op of OPENINGS) {
    const len = Math.min(moveList.length, op.moves.length);
    if (len === 0) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches && (!best || len > best.len)) best = { opening: op, len };
  }
  return best ? best.opening : null;
}
