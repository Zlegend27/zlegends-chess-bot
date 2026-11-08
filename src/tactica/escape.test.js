import { describe, test, expect } from "vitest";
import { guarded, movesOf, apply, escaped, solve, makeEscape, seeded, escapePar, fenOf, strikerOf, ringOf, outerRing, closeRing, allStuck, solveTimed, escapeClock } from "./escape";
import { isStoryFloor, isBonusAfter } from "./binRun";

const level = ({ mine = [], guards = [], junk = [], light = 63 }) => ({
  mine: new Map(mine), guards: new Map(guards), junk: new Set(junk), light, limit: 5,
});

describe("escape to the light", () => {
  test("bonus escapes never come right after a story floor", () => {
    for (let f = 1; f <= 60; f++) if (isBonusAfter(f)) expect(isStoryFloor(f)).toBe(false);
  });

  test("rings are counted in king steps from the light", () => {
    const s = level({ light: 63 });
    expect(ringOf(s, 63)).toBe(0);
    expect(ringOf(s, 54)).toBe(1);
    expect(ringOf(s, 0)).toBe(7);
    expect(outerRing(s)).toBe(7);
  });

  test("a closing ring buries squares: your pieces there are stuck, guards are gone", () => {
    const s = closeRing(level({ mine: [[0, 4], [9, 2]], guards: [[7, 3]], light: 63 }), 7);
    expect(s.junk.has(0) && s.junk.has(7) && s.junk.has(56)).toBe(true);
    expect(s.junk.has(9)).toBe(false);
    expect([...s.stuck]).toEqual([0]);
    expect(s.guards.size).toBe(0);
    expect(movesOf(s).every((m) => m.from === 9)).toBe(true);
    expect(allStuck(s)).toBe(false);
    expect(allStuck(closeRing(s, 6))).toBe(true);
  });

  test("the timed solver fails when the garbage gets there first", () => {
    /* A rook on a1 needs 2 moves to reach h8. */
    const s = level({ mine: [[0, 4]], light: 63 });
    expect(solveTimed(s, 1, 10)).toBe(2);
    /* The outer ring (a1 included) closes before the first move. */
    expect(solveTimed(s, 5, 2)).toBe(null);
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
        const { total, interval } = escapeClock(s);
        expect(solveTimed(s, total / (par + 2), interval, par)).toBe(par);
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
