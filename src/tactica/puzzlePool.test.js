import { describe, test, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { BUCKETS, bucketOf, bucketsNear, lightRow, expandPuzzle } from "./puzzlePool";
import { createEngine } from "../engine/chessEngine";
import { judgePuzzleMove } from "../utils/puzzleSession";

describe("the puzzle pool's files", () => {
  test("one file per 300 rating points, from 400 to 2500 and up", () => {
    expect(BUCKETS).toEqual([400, 700, 1000, 1300, 1600, 1900, 2200, 2500]);
    expect([100, 400, 699, 700, 1549, 2499, 2500, 3100].map(bucketOf)).toEqual([400, 400, 400, 700, 1300, 2200, 2500, 2500]);
  });

  test("a floor asks only for the files near its rating", () => {
    expect(bucketsNear(550)).toEqual([400, 700]);
    expect(bucketsNear(850)).toEqual([700, 1000]);
    expect(bucketsNear(1150)).toEqual([1000, 1300]);
    expect(bucketsNear(1450, 0)).toEqual([1300]);
  });
});

describe("a puzzle from the pool", () => {
  /* Black has just blundered the back rank: 1... Kh8?? and White mates. */
  const row = ["t1", 620, "6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1", "g8h8 a1a8"];

  test("is light until chosen: the solver is the side that doesn't move first", () => {
    expect(lightRow(row)).toMatchObject({ id: "t1", rating: 620, side: 1, plies: 1 });
  });

  test("expands to the solver's position, the solution in chess notation, and the move before it", () => {
    const p = expandPuzzle(lightRow(row));
    expect(p).toMatchObject({ id: "t1", rating: 620, moves: ["Ra8#"], before: row[2], lead: "g8h8" });
    expect(p.fen.split(" ")[1]).toBe("w");
    expect(p.fen.startsWith("7k/5ppp")).toBe(true);
  });

  test("a full puzzle is left alone, and a row that doesn't replay gives nothing", () => {
    const full = { id: "x", rating: 1, fen: "8/8/8/8/8/8/8/8 w - - 0 1", moves: ["e4"] };
    expect(expandPuzzle(full)).toBe(full);
    expect(expandPuzzle(lightRow(["bad", 600, row[2], "a1a8 g8h8"]))).toBeNull();
  });
});

/* The real files, once the import has been run. */
const dir = new URL("../../public/tactica-puzzles/", import.meta.url);
describe.runIf(existsSync(new URL("400.json", dir)))("the imported files", () => {
  const load = (bucket) => JSON.parse(readFileSync(new URL(`${bucket}.json`, dir), "utf8"));

  test("every file is full, in its rating range, with both colours and long puzzles", () => {
    for (const bucket of BUCKETS) {
      const rows = load(bucket).map(lightRow);
      expect(rows.length).toBeGreaterThanOrEqual(1200);
      expect(rows.every((r) => bucketOf(r.rating) === bucket)).toBe(true);
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
      for (const side of [1, -1]) {
        expect(rows.filter((r) => r.side === side).length).toBeGreaterThan(500);
        /* Long puzzles barely exist under 700; boss floors start at 950. */
        if (bucket >= 700) expect(rows.filter((r) => r.side === side && r.plies >= 7).length).toBeGreaterThan(200);
      }
    }
  });

  test("a sample of every file plays through as a real puzzle", () => {
    const eng = createEngine();
    for (const bucket of BUCKETS) {
      const rows = load(bucket);
      for (let i = 0; i < rows.length; i += 25) {
        const p = expandPuzzle(lightRow(rows[i]));
        expect(p, rows[i][0]).not.toBeNull();
        eng.loadFen(p.fen);
        const played = [];
        for (let k = 0; k < p.moves.length; k += 2) {
          const move = eng.legalMoves().find((m) => eng.sanOf(m) === p.moves[k]);
          expect(move, `${p.id} move ${k}`).toBeDefined();
          const verdict = judgePuzzleMove(eng, p, played, move);
          expect(verdict.ok, p.id).toBe(true);
          eng.make(move);
          played.push(p.moves[k]);
          if (verdict.solved) break;
          const reply = eng.legalMoves().find((m) => eng.sanOf(m) === verdict.reply);
          expect(reply, `${p.id} reply ${k}`).toBeDefined();
          eng.make(reply);
          played.push(verdict.reply);
        }
      }
    }
  });
});
