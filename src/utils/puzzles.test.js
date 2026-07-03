import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { PUZZLES, RATING_BANDS } from "./puzzles";

/* Every puzzle's move list must fully replay against the real engine and
   match sanOf() exactly, starting from its own FEN (not the standard
   starting position) — this is the same validation openings.test.js does,
   just loading a custom position first instead of playing from move one. */
describe("puzzles", () => {
  for (const puzzle of PUZZLES) {
    test(`${puzzle.id}: all moves are legal and match SAN exactly from its FEN`, () => {
      const eng = createEngine();
      eng.loadFen(puzzle.fen);
      let applied = 0;
      for (const san of puzzle.moves) {
        const legal = eng.legalMoves();
        const move = legal.find(m => eng.sanOf(m) === san);
        if (move === undefined) break;
        eng.make(move);
        applied++;
      }
      expect(applied).toBe(puzzle.moves.length);
    });

    test(`${puzzle.id}: has a valid rating and at least one theme`, () => {
      expect(typeof puzzle.rating).toBe("number");
      expect(puzzle.themes.length).toBeGreaterThan(0);
    });
  }

  test("every puzzle rating falls inside exactly one rating band", () => {
    for (const puzzle of PUZZLES) {
      const matches = RATING_BANDS.filter(b => puzzle.rating >= b.min && puzzle.rating < b.max);
      expect(matches.length).toBe(1);
    }
  });
});
