import { describe, test, expect } from "vitest";
import { xpForMove, levelFor, progress, award, levelsOf, kindOfType, LEVEL_XP, MAX_LEVEL } from "./bonds";

describe("bonds", () => {
  test("a correct move gives XP, a capture and a finishing move give more", () => {
    expect(xpForMove()).toBe(10);
    expect(xpForMove({ capture: true })).toBe(20);
    expect(xpForMove({ capture: true, final: true })).toBe(35);
  });

  test("levels start at 1 and top out", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(LEVEL_XP[1] - 1)).toBe(1);
    expect(levelFor(LEVEL_XP[1])).toBe(2);
    expect(levelFor(1e9)).toBe(MAX_LEVEL);
  });

  test("progress counts within the current level", () => {
    expect(progress(130)).toEqual({ level: 2, into: 30, need: 200 });
    expect(progress(1e9)).toEqual({ level: MAX_LEVEL, into: null, need: null });
  });

  test("award reports a level up only when the level changes", () => {
    const a = award({ knight: 90 }, "knight", 20);
    expect(a.bonds.knight).toBe(110);
    expect(a.levelUp).toBe(2);
    expect(award(a.bonds, "knight", 10).levelUp).toBe(null);
  });

  test("award does not change the bonds it was given", () => {
    const start = { pawn: 5 };
    award(start, "pawn", 10);
    expect(start.pawn).toBe(5);
  });

  test("every kind has a level, and engine types map to kinds", () => {
    expect(levelsOf({ queen: 300 })).toEqual({ pawn: 1, knight: 1, bishop: 1, rook: 1, queen: 3, king: 1 });
    expect(kindOfType(-2)).toBe("knight");
    expect(kindOfType(6)).toBe("king");
  });
});
