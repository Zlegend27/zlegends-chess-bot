/* The rules of a puzzle, shared by Puzzles, Puzzle Rush and Chess Tactica.
   A puzzle's `moves` alternate between the solver's move and the reply that
   follows it. Like Lichess, any move that gives checkmate solves the puzzle,
   even when it isn't the stored one, since a mate can't be wrong. */

/** Judges `move`, played by the solver in `eng`'s current position, after the
 *  moves in `played`. Returns whether it's accepted, its SAN, whether it
 *  solves the puzzle, and the reply to play if it doesn't. `eng` is left as
 *  it was. */
export function judgePuzzleMove(eng, puzzle, played, move) {
  const san = eng.sanOf(move);
  const expected = puzzle.moves[played.length];
  eng.make(move);
  const mates = eng.legalMoves().length === 0 && eng.inCheckNow();
  eng.unmake();
  const ok = san === expected || mates;
  const solved = ok && (mates || played.length + 1 >= puzzle.moves.length);
  return { ok, san, solved, reply: ok && !solved ? puzzle.moves[played.length + 1] : null };
}
