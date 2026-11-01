import { describe, test, expect } from "vitest";
import { isResumable } from "./liveGame";

const HOUR = 60 * 60 * 1000;

describe("resuming a game", () => {
  test("a recent game with moves can be resumed", () => {
    expect(isResumable({ moves: ["e4"], savedAt: 0 }, 23 * HOUR)).toBe(true);
  });

  test("a day-old game can't", () => {
    expect(isResumable({ moves: ["e4"], savedAt: 0 }, 24 * HOUR)).toBe(false);
  });

  test("nothing saved, or a game with no moves, can't", () => {
    expect(isResumable(null)).toBe(false);
    expect(isResumable({ moves: [], savedAt: 0 }, 1)).toBe(false);
  });
});
