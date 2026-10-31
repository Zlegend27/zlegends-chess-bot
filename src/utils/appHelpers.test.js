import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { DIFFICULTIES } from "./difficulties";
import { rankBotLossToPerf, rankBotBlunderChance } from "./rankBotMath";
import { BALANCED, pickPersonality } from "./personalities";
import { detectOpening } from "./openingDetect";
import { dailyPuzzle, todayKey } from "./dailyPuzzle";
import { pickTrackIndex } from "./trackIndex";
import { materialState } from "./material";
import { winPctOf, moveAccuracy } from "./accuracy";
import { OPENINGS } from "./openings";

describe("difficulty tiers", () => {
  test("the Elo tiers come first, then Rank Bot, then the homemade engine", () => {
    expect(DIFFICULTIES.map((d) => d.label)).toEqual(["1000 Elo", "1500 Elo", "2000 Elo", "Rank Bot", "Casual", "Master"]);
    expect(DIFFICULTIES.find((d) => d.id === "rank")).toBeTruthy();
  });
});

describe("Rank Bot maths", () => {
  test("a move's centipawn loss maps to the strength it resembles", () => {
    expect(rankBotLossToPerf(0)).toBe(3000);
    expect(rankBotLossToPerf(25)).toBe(1700);
    expect(rankBotLossToPerf(500)).toBe(450);
  });

  test("the blunder chance only applies below Stockfish's floor", () => {
    expect(rankBotBlunderChance(2000)).toBe(0);
    expect(rankBotBlunderChance(1000)).toBeGreaterThanOrEqual(0.3);
    expect(rankBotBlunderChance(0)).toBeLessThanOrEqual(0.75);
  });
});

describe("personalities", () => {
  test("a long game switches to the endgame style", () => {
    expect(pickPersonality(BALANCED, 60, 0).label).toBe("Endgame");
  });

  test("losing badly complicates the position, winning big plays it safe", () => {
    expect(pickPersonality(BALANCED, 20, -3).label).toBe("Tactical");
    expect(pickPersonality(BALANCED, 20, 4).label).toBe("Defensive");
  });

  test("otherwise the chosen style stands", () => {
    expect(pickPersonality(BALANCED, 20, 0)).toBe(BALANCED);
  });
});

describe("opening detection", () => {
  test("a game that starts like a curated opening is named after it", () => {
    const op = OPENINGS.find((o) => o.moves.length >= 3);
    expect(detectOpening(op.moves.slice(0, 3))).toBe(op);
  });

  test("a game that matches nothing has no opening", () => {
    expect(detectOpening(["zz9"])).toBeNull();
  });
});

describe("the daily puzzle", () => {
  const pool = [{ id: "a" }, { id: "b" }, { id: "c" }];

  test("is the same for everyone on a given day", () => {
    expect(dailyPuzzle(pool)).toBe(dailyPuzzle(pool));
    expect(pool).toContain(dailyPuzzle(pool));
  });

  test("an empty pool has no daily puzzle", () => {
    expect(dailyPuzzle([])).toBeNull();
  });

  test("the key is a UTC date", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/);
  });
});

describe("picking the next track", () => {
  test("steps forward and wraps at the end", () => {
    expect(pickTrackIndex(2, 3, 1, false)).toBe(0);
  });

  test("steps back and wraps at the start", () => {
    expect(pickTrackIndex(0, 3, -1, false)).toBe(2);
  });

  test("a single track is always track zero", () => {
    expect(pickTrackIndex(0, 1, 1, false)).toBe(0);
  });

  test("shuffle never repeats the current track", () => {
    for (let i = 0; i < 50; i++) expect(pickTrackIndex(1, 3, 1, true)).not.toBe(1);
  });
});

describe("material count", () => {
  test("the starting position is level with nothing captured", () => {
    const m = materialState(createEngine());
    expect(m.diff).toBe(0);
    expect(m.capturedWhite).toEqual([]);
    expect(m.capturedBlack).toEqual([]);
  });
});

describe("move accuracy", () => {
  test("a win percentage of an equal position is 50", () => {
    expect(winPctOf(0)).toBeCloseTo(50, 6);
  });

  test("a move that loses nothing scores near full accuracy, and a big drop scores low", () => {
    expect(moveAccuracy(60, 60)).toBeGreaterThan(95);
    expect(moveAccuracy(80, 20)).toBeLessThan(20);
  });

  test("accuracy always stays between 0 and 100", () => {
    for (const [before, after] of [[0, 100], [100, 0], [50, 50], [90, 10]]) {
      const a = moveAccuracy(before, after);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(100);
    }
  });
});
