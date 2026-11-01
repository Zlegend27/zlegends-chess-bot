import { describe, test, expect } from "vitest";
import { MATE_EVAL } from "./reviewScoring";
import {
  eloFor, expectedReplyLoss, isClosing, learnFromMove, newGameState, optionsFor, pickOption, stepFor,
} from "./rankBotShadow";

const line = (uci, score) => ({ uci, score });
const safe = () => false;

describe("reading the player", () => {
  test("a move that lets the lead grow counts as a mistake of that size", () => {
    const state = { ...newGameState(50), expected: 100, expectedPly: 20 };
    expect(learnFromMove(state, 200, 22)).toBeCloseTo(55, 6);
  });

  test("a takeback measures nothing", () => {
    const state = { ...newGameState(50), expected: 100, expectedPly: 20 };
    expect(learnFromMove(state, 500, 20)).toBe(50);
  });

  test("huge blunders count only up to a limit", () => {
    const state = { ...newGameState(0), expected: 0, expectedPly: 20 };
    expect(learnFromMove(state, 2000, 22)).toBeCloseTo(30, 6);
  });

  test("one step is about one typical mistake, within limits", () => {
    expect(stepFor(50)).toBe(60);
    expect(stepFor(1)).toBe(25);
    expect(stepFor(400)).toBe(200);
  });

  test("bigger mistakes mean a lower rating, and the ends are held", () => {
    expect(eloFor(120)).toBe(470);
    expect(eloFor(10)).toBe(2740);
    expect(eloFor(70)).toBeLessThan(eloFor(50));
    expect(eloFor(60)).toBe(990);
  });

  test("the bot closes late, or once few pieces are left", () => {
    expect(isClosing(70, 66, 12)).toBe(true);
    expect(isClosing(40, 66, 6)).toBe(true);
    expect(isClosing(40, 66, 12)).toBe(false);
  });

  test("the closing move always falls in the same range", () => {
    expect(newGameState(60, () => 0).closePly).toBe(60);
    expect(newGameState(60, () => 0.999).closePly).toBe(83);
  });
});

describe("choosing what to consider", () => {
  test("level or behind, only moves as good as the best", () => {
    const lines = [line("a", 20), line("b", 12), line("c", -40)];
    expect(optionsFor(lines, 60, safe).map((l) => l.uci)).toEqual(["a", "b"]);
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
    expect(optionsFor([line("a", 40)], 60, () => true).map((l) => l.uci)).toEqual(["a"]);
  });
});

describe("picking the move", () => {
  const options = [line("a", 120), line("b", 100)];

  test("without Maia, the lowest option", () => {
    expect(pickOption(options, 60, null).uci).toBe("b");
  });

  test("the most human option wins", () => {
    expect(pickOption(options, 60, { a: 0.7, b: 0.1 }).uci).toBe("a");
  });

  test("a good trap can beat a slightly more human move", () => {
    expect(pickOption(options, 60, { a: 0.5, b: 0.4 }, { b: 200 }).uci).toBe("b");
  });

  test("expected loss weighs each reply by its chance", () => {
    const lines = [line("x", 100), line("y", 0)];
    expect(expectedReplyLoss({ x: 0.5, y: 0.25, z: 0.25 }, lines)).toBeCloseTo(50, 6);
  });
});
