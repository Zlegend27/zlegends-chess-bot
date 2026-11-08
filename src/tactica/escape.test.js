import { describe, test, expect } from "vitest";
import { isEscapeFloor, guarded, movesOf, apply, escaped, solve, makeEscape, seeded, escapePar, fenOf, strikerOf } from "./escape";
import { isStoryFloor } from "./binRun";

const level = ({ mine = [], guards = [], junk = [], light = 63 }) => ({
  mine: new Map(mine), guards: new Map(guards), junk: new Set(junk), light, limit: 5,
});

describe("escape to the light", () => {
  test("escape floors are 3, 8, 13... and never a story floor", () => {
    expect([1, 2, 3, 4, 8, 13].map(isEscapeFloor)).toEqual([false, false, true, false, true, true]);
    for (let f = 1; f <= 60; f++) if (isEscapeFloor(f)) expect(isStoryFloor(f)).toBe(false);
  });

  test("garbage blocks a rook's line but a knight jumps it", () => {
    const rook = level({ mine: [[0, 4]], junk: [16] });
    expect(movesOf(rook).map((m) => m.to)).toContain(8);
    expect(movesOf(rook).map((m) => m.to)).not.toContain(16);
    expect(movesOf(rook).map((m) => m.to)).not.toContain(24);
    const knight = level({ mine: [[1, 2]], junk: [9, 10] });
    expect(movesOf(knight).map((m) => m.to)).toContain(18);
  });

  test("garbage blocks what guards attack too", () => {
    const s = level({ guards: [[56, 4]], junk: [40] });
    expect(guarded(s).has(48)).toBe(true);
    expect(guarded(s).has(32)).toBe(false);
  });

  test("a guard pawn attacks diagonally toward you", () => {
    const s = level({ guards: [[36, 1]] });
    expect([...guarded(s)].sort()).toEqual([27, 29]);
  });

  test("ending on a guarded square is deadly; a lone guard can be taken", () => {
    /* Bishops on a4 and d6: the d6 one watches c5, b4 and a3. */
    const s = level({ mine: [[0, 4]], guards: [[24, 3], [43, 3]] });
    const moves = movesOf(s);
    expect(moves.find((m) => m.to === 24)).toMatchObject({ capture: true, deadly: false });
    expect(moves.find((m) => m.to === 16).deadly).toBe(true);
    expect(moves.find((m) => m.to === 8).deadly).toBe(false);
    const covered = level({ mine: [[0, 4]], guards: [[24, 3], [33, 1]] });
    expect(movesOf(covered).find((m) => m.to === 24).deadly).toBe(true);
  });

  test("the striker is the guard that covers the square", () => {
    const s = apply(level({ mine: [[0, 4]], guards: [[43, 3]] }), { from: 0, to: 16 });
    expect(strikerOf(s, 16)).toBe(43);
    expect(strikerOf(s, 8)).toBe(null);
  });

  test("apply moves a piece and removes a taken guard", () => {
    const s = apply(level({ mine: [[0, 4]], guards: [[24, 3]] }), { from: 0, to: 24 });
    expect([...s.mine]).toEqual([[24, 4]]);
    expect(s.guards.size).toBe(0);
  });

  test("the solver finds the fewest safe moves", () => {
    expect(solve(level({ mine: [[7, 4]], light: 63 }))).toBe(1);
    expect(solve(level({ mine: [[0, 4]], light: 63 }))).toBe(2);
    expect(escaped(level({ mine: [[63, 4]] }))).toBe(true);
    /* Walled in by garbage with no way out. */
    expect(solve(level({ mine: [[0, 4]], junk: [1, 8], light: 63 }))).toBe(null);
  });

  test("generated levels are solvable in exactly their par, with the right move limit", () => {
    for (const floor of [3, 8, 13, 23]) {
      for (let seed = 1; seed <= 4; seed++) {
        const s = makeEscape(floor, seeded(seed * 97 + floor));
        expect(s).not.toBe(null);
        const { par, spare } = escapePar(floor);
        expect(solve(s, par)).toBe(par);
        expect(s.limit).toBe(par + spare);
        expect(guarded(s).has(s.light)).toBe(false);
        expect(s.junk.has(s.light)).toBe(false);
      }
    }
  });

  test("the map board has every piece", () => {
    const fen = fenOf(level({ mine: [[0, 4]], guards: [[63, 2]] }));
    expect(fen.startsWith("7n/")).toBe(true);
    expect(fen.split(" ")[0].endsWith("/R7")).toBe(true);
  });
});
