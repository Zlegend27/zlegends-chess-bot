import { describe, test, expect } from "vitest";
import { createEngine } from "../engine/chessEngine";
import { DIFFICULTIES } from "./difficulties";
import { BALANCED, pickPersonality } from "./personalities";
import { detectOpening } from "./openingDetect";
import { dailyPuzzle, todayKey } from "./dailyPuzzle";
import { pickTrackIndex } from "./trackIndex";
import { materialState } from "./material";
import { OPENINGS } from "./openings";

describe("difficulty tiers", () => {
  test("the Elo tiers come first, then Rank Bot, then the homemade engine", () => {
    expect(DIFFICULTIES.map((d) => d.label)).toEqual(["1000 Elo", "1500 Elo", "2000 Elo", "Rank Bot", "Casual", "Master"]);
    expect(DIFFICULTIES.find((d) => d.id === "rank")).toBeTruthy();
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
