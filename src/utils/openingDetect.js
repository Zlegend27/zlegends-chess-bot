import { OPENINGS } from "./openings";
import { detectEcoOpening } from "./ecoOpenings";

/* Recognizes which curated opening (if any) the game has reached: the
   longest entry whose own moves have all been played, so an opening is
   never named before it happens. Once the game runs past an entry's moves
   it keeps naming that opening (nothing deeper to compare against), same
   as how a live board usually keeps showing "last known opening". */
export function detectOpening(moveList) {
  return detectEcoOpening(moveList, OPENINGS);
}
