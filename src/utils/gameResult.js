/* Whether a game is over and why, from the rules alone. Every board in the
   app asks this one function, so a draw rule can't be counted on one
   screen and missed on another. Screens word the result their own way. */

/** null while the game goes on, otherwise { text, reason, winner? } with
 *  `text` the result as a scoresheet writes it and `winner` 1 or -1. */
export function gameResult(eng) {
  if (eng.legalMoves().length === 0) {
    if (eng.inCheckNow()) {
      const winner = -eng.getSide();
      return { text: winner === 1 ? "1–0" : "0–1", reason: "Checkmate", winner };
    }
    return { text: "½–½", reason: "Stalemate" };
  }
  if (eng.halfClock() >= 100) return { text: "½–½", reason: "Fifty-move rule" };
  if (eng.repetitionCount() >= 3) return { text: "½–½", reason: "Threefold repetition" };
  if (eng.insufficientMaterial()) return { text: "½–½", reason: "Insufficient material" };
  return null;
}

/** The result as a trainer says it to the player playing `you` (1 or -1). */
export function resultSentence(result, you) {
  if (!result) return null;
  if (result.reason === "Checkmate") return result.winner === you ? "Checkmate, you win!" : "Checkmate, you lose.";
  return `Draw by ${result.reason === "Stalemate" ? "stalemate" : result.reason.toLowerCase()}.`;
}
