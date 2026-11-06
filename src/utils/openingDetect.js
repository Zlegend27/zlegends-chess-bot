import { OPENINGS } from "./openings";

/* Recognizes which curated opening (if any) the game has reached: the
   longest entry whose own moves have all been played, so an opening is
   never named before it happens. Once the game runs past an entry's moves
   it keeps naming that opening (nothing deeper to compare against), same
   as how a live board usually keeps showing "last known opening". */
export function detectOpening(moveList) {
  let best = null;
  for (const op of OPENINGS) {
    const len = op.moves.length;
    if (len === 0 || len > moveList.length) continue;
    let matches = true;
    for (let i = 0; i < len; i++) {
      if (moveList[i] !== op.moves[i]) { matches = false; break; }
    }
    if (matches && (!best || len > best.len)) best = { opening: op, len };
  }
  return best ? best.opening : null;
}
