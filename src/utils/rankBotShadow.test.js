import { describe, test, expect } from "vitest";
import { MATE_EVAL } from "./reviewScoring";
import {
  eloFor, expectedReplyLoss, isClosing, isLeadLost, isTrusted, learnFromMove, levelsFor, mistakeFor, newGameState,
  nextPace, optionsFor, rankOptions, stepFor,
} from "./rankBotShadow";

const line = (uci, score, material = 0) => ({ uci, score, material });
const safe = () => false;
const full = (cost) => new Array(40).fill(cost);

describe("reading the player", () => {
  test("a move that lets the lead grow counts as a mistake of that size", () => {
    const state = { ...newGameState(), expected: 100, expectedPly: 20 };
    learnFromMove(state, 180, 22);
    expect(state.recent).toEqual([80]);
  });

  test("a takeback measures nothing", () => {
    const state = { ...newGameState(), expected: 100, expectedPly: 20 };
    learnFromMove(state, 500, 20);
    expect(state.recent).toEqual([]);
  });

  test("huge blunders count only up to a limit", () => {
    const state = { ...newGameState(), expected: 0, expectedPly: 20 };
    learnFromMove(state, 2000, 22);
    expect(state.recent).toEqual([300]);
  });

  test("moves in a decided game aren't counted", () => {
    const state = { ...newGameState(), expected: 500, expectedPly: 20 };
    learnFromMove(state, 700, 22);
    expect(state.recent).toEqual([]);
  });

  test("one blunder doesn't read as a collapse in skill", () => {
    expect(mistakeFor([...full(20).slice(1), 300])).toBeCloseTo(20, 6);
  });

  test("early on, the estimate leans on the starting guess", () => {
    expect(mistakeFor([])).toBeCloseTo(38, 6);
    expect(mistakeFor([0])).toBeLessThan(38);
  });

  test("the memory carries across games, and stays short", () => {
    const state = { ...newGameState({ recent: new Array(80).fill(10) }), expected: 0, expectedPly: 20 };
    learnFromMove(state, 50, 22);
    expect(state.recent).toHaveLength(80);
    expect(state.recent[79]).toBe(50);
    expect(newGameState({ recent: [5], peakElo: 1500 })).toMatchObject({ recent: [5], peakElo: 1500 });
  });

  test("the best level they've shown sticks, once it can be trusted", () => {
    const state = { ...newGameState({ recent: full(21) }), expected: 0, expectedPly: 20 };
    learnFromMove(state, 21, 22);
    expect(state.peakElo).toBeGreaterThan(2000);
    const few = { ...newGameState(), expected: 0, expectedPly: 20 };
    learnFromMove(few, 0, 22);
    expect(few.peakElo).toBe(0);
  });

  test("predictions aim above the estimate", () => {
    const levels = levelsFor({ recent: full(40), peakElo: 1500 });
    expect(levels.elo).toBeLessThan(1000);
    expect(levels.potential).toBe(1700);
    expect(levels.botElo).toBeGreaterThan(levels.potential);
  });

  test("bigger mistakes mean a lower rating, and the ends are held", () => {
    expect(eloFor(90)).toBe(470);
    expect(eloFor(10)).toBe(2735);
    expect(eloFor(45)).toBeLessThan(eloFor(30));
    expect(eloFor(38.5)).toBe(985);
  });

  test("one step is about one typical mistake, within limits", () => {
    expect(stepFor(40)).toBe(60);
    expect(stepFor(1)).toBe(25);
    expect(stepFor(400)).toBe(200);
  });

  test("the estimate is trusted only after enough moves", () => {
    expect(isTrusted({ recent: new Array(20).fill(10) })).toBe(false);
    expect(isTrusted({ recent: full(10) })).toBe(true);
  });

  test("the bot closes late, or once few pieces are left", () => {
    expect(isClosing(70, 66, 12)).toBe(true);
    expect(isClosing(40, 66, 6)).toBe(true);
    expect(isClosing(40, 66, 12)).toBe(false);
  });

  test("the closing move always falls in the same range", () => {
    expect(newGameState({}, () => 0).closePly).toBe(60);
    expect(newGameState({}, () => 0.999).closePly).toBe(83);
  });
});

describe("pace", () => {
  test("a slow search backs off, down to a limit", () => {
    expect(nextPace(1, 4000)).toBeCloseTo(0.7, 6);
    expect(nextPace(0.3, 4000)).toBe(0.3);
  });

  test("a quick search recovers, up to the full search", () => {
    expect(nextPace(0.5, 500)).toBeCloseTo(0.6, 6);
    expect(nextPace(1, 500)).toBe(1);
  });

  test("in between, it holds", () => {
    expect(nextPace(0.5, 2000)).toBe(0.5);
  });
});

describe("the lead", () => {
  test("it's lost when behind a step in position, or behind in material", () => {
    expect(isLeadLost(line("a", 40), 60)).toBe(true);
    expect(isLeadLost(line("a", 300, -1), 60)).toBe(true);
    expect(isLeadLost(line("a", 60, 0), 60)).toBe(false);
  });
});

describe("choosing what to consider", () => {
  test("with the lead lost, only the engine's move", () => {
    const lines = [line("a", 20), line("b", 18), line("c", -40)];
    expect(optionsFor(lines, 60, safe).map((l) => l.uci)).toEqual(["a"]);
    expect(optionsFor([line("a", 300, -1), line("b", 290, 2)], 60, safe).map((l) => l.uci)).toEqual(["a"]);
  });

  test("every other option keeps him a step ahead", () => {
    const lines = [line("a", 90), line("b", 70), line("c", 50)];
    expect(optionsFor(lines, 60, safe).map((l) => l.uci)).toEqual(["a", "b"]);
  });

  test("no option leaves him behind in material", () => {
    const lines = [line("a", 200, 1), line("b", 190, -1), line("c", 180, 0)];
    expect(optionsFor(lines, 60, safe).map((l) => l.uci)).not.toContain("b");
  });

  test("far ahead, the lead comes down but not all at once", () => {
    const lines = [line("a", 500), line("b", 420), line("c", 330), line("d", 200), line("e", 50)];
    expect(optionsFor(lines, 60, safe).map((l) => l.uci)).toEqual(["c"]);
  });

  test("a mate is always played", () => {
    expect(optionsFor([line("a", MATE_EVAL), line("b", 300)], 60, safe)).toHaveLength(1);
  });

  test("moves that hang a piece are left out, unless it's the best move", () => {
    const lines = [line("a", 200), line("b", 150), line("c", 140)];
    expect(optionsFor(lines, 60, (u) => u === "c").map((l) => l.uci)).not.toContain("c");
    expect(optionsFor([line("a", 90)], 60, () => true).map((l) => l.uci)).toEqual(["a"]);
  });
});

describe("ranking the options", () => {
  const options = [line("a", 120), line("b", 100)];

  test("without Maia, the lowest option first", () => {
    expect(rankOptions(options, 60, null).map((o) => o.uci)).toEqual(["b", "a"]);
  });

  test("the most human option comes first", () => {
    expect(rankOptions(options, 60, { a: 0.7, b: 0.1 })[0].uci).toBe("a");
  });

  test("a good trap can beat a slightly more human move", () => {
    expect(rankOptions(options, 60, { a: 0.5, b: 0.4 }, { b: 200 })[0].uci).toBe("b");
  });

  test("expected loss weighs each reply by its chance", () => {
    const lines = [line("x", 100), line("y", 0)];
    expect(expectedReplyLoss({ x: 0.5, y: 0.25, z: 0.25 }, lines)).toBeCloseTo(50, 6);
  });
});
