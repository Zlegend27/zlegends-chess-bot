import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { replayIntoEngine } from "./share";
import { OPENINGS } from "./openings";

/* Every opening's move list must fully replay against the real engine and
   match sanOf() exactly (replayIntoEngine silently stops at the first
   mismatch), and each opening needs one description per move. */
describe("openings library", () => {
  for (const opening of OPENINGS) {
    test(`${opening.name}: all moves are legal and match SAN exactly`, () => {
      const eng = createEngine();
      const { applied } = replayIntoEngine(eng, opening.moves);
      expect(applied.length).toBe(opening.moves.length);
    });

    test(`${opening.name}: has one description per move`, () => {
      expect(opening.steps.length).toBe(opening.moves.length);
    });

    test(`${opening.name}: 'for' is a valid side`, () => {
      expect(["white", "black"]).toContain(opening.for);
    });
  }
});
