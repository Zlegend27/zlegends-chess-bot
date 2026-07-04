import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import puzzlesData from "./puzzles-lichess.json";

/* One aggregate test instead of one per puzzle (unlike the hand-curated
   puzzles.test.js) since these 300 are machine-imported, not individually
   authored -- a per-puzzle test name wouldn't carry any real information.
   Still validates every single one replays legally against the real
   engine, since scripts/import-puzzles.mjs generates the SAN itself and a
   bug there could silently produce a puzzle whose "solution" doesn't
   actually work. */
describe("imported Lichess puzzles", () => {
  test("every puzzle's move list is legal and rating falls in its band", () => {
    const failures = [];
    for (const p of puzzlesData.puzzles) {
      const eng = createEngine();
      try {
        eng.loadFen(p.fen);
        for (const san of p.moves) {
          const legal = eng.legalMoves();
          const m = legal.find(mv => eng.sanOf(mv) === san);
          if (!m) throw new Error(`illegal/mismatched move ${san}`);
          eng.make(m);
        }
      } catch (e) {
        failures.push(`${p.id}: ${e.message}`);
      }
      const band = puzzlesData.bands.find(b => p.rating >= b.min && p.rating < b.max);
      if (!band) failures.push(`${p.id}: rating ${p.rating} doesn't fall in any band`);
    }
    expect(failures).toEqual([]);
  });

  test("has a reasonable number of puzzles per band", () => {
    for (const band of puzzlesData.bands) {
      const count = puzzlesData.puzzles.filter(p => p.rating >= band.min && p.rating < band.max).length;
      expect(count).toBeGreaterThan(0);
    }
  });
});
