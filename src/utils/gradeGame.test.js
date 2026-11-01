import { describe, test, expect } from "vitest";
import { createEngine, M64TO120 } from "../engine/chessEngine";
import { exchangeGain, gradeGame, hangingPieces, isBrilliant, isGreat, isMiss, isPoisoned, sacrificedPoints } from "./gradeGame";

const square = (name) => M64TO120[(name.charCodeAt(1) - 49) * 8 + name.charCodeAt(0) - 97];
const at = (fen) => { const eng = createEngine(); eng.loadFen(fen); return eng; };

describe("exchanges", () => {
  test("an undefended piece is worth its full value", () => {
    expect(exchangeGain(at("4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1"), square("d5"))).toBe(3);
  });

  test("a square nobody attacks is worth nothing", () => {
    expect(exchangeGain(at("4k3/8/8/3n4/8/8/8/4K2R w - - 0 1"), square("d5"))).toBe(0);
  });

  test("a defended piece costs the taker its own piece", () => {
    expect(exchangeGain(at("4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1"), square("d5"))).toBe(0);
    expect(exchangeGain(at("4k3/8/2p5/3r4/4P3/8/8/4K3 w - - 0 1"), square("d5"))).toBe(4);
  });

  test("hanging means the opponent can take at a profit", () => {
    const hung = at("4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1");
    expect(Object.values(hangingPieces(hung))).toEqual([3]);
    const safe = at("4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1");
    expect(hangingPieces(safe)).toEqual({});
  });

  test("a piece isn't really offered if taking it loses the queen", () => {
    const pinned = at("rnbqkb1r/ppp2ppp/4pn2/6B1/3PN3/8/PPP2PPP/R2QKBNR b KQkq - 0 5");
    expect(isPoisoned(pinned, square("e4"), 3)).toBe(true);
    const plain = at("rnbqkb1r/ppp2ppp/4pn2/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq - 0 5");
    expect(isPoisoned(plain, square("e4"), 3)).toBe(false);
  });
});

describe("sacrifices", () => {
  test("a piece that stays hanging from last turn isn't new", () => {
    expect(sacrificedPoints({ 10: 3 }, { 10: 3 }, 0, 10)).toBe(0);
    expect(sacrificedPoints({ 10: 3 }, {}, 0, 10)).toBe(3);
  });

  test("what the move captured is paid back first", () => {
    expect(sacrificedPoints({ 10: 3 }, {}, 3, 10)).toBe(0);
  });

  test("a loose minor piece elsewhere isn't an offer, a major piece is", () => {
    expect(sacrificedPoints({ 20: 3 }, {}, 0, 10)).toBe(0);
    expect(sacrificedPoints({ 20: 9 }, {}, 0, 10)).toBe(9);
  });

  const good = { isBest: true, forced: false, inCheck: false, before: 50, after: 50, sacrificed: 3 };

  test("needs the engine's move, from a live position, that still holds", () => {
    expect(isBrilliant(good)).toBe(true);
    expect(isBrilliant({ ...good, isBest: false })).toBe(false);
    expect(isBrilliant({ ...good, forced: true })).toBe(false);
    expect(isBrilliant({ ...good, inCheck: true })).toBe(false);
    expect(isBrilliant({ ...good, before: 900 })).toBe(false);
    expect(isBrilliant({ ...good, after: -300 })).toBe(false);
    expect(isBrilliant({ ...good, sacrificed: 1 })).toBe(false);
  });
});

describe("great and miss", () => {
  const good = { isBest: true, forced: false, inCheck: false, before: 0, second: -300, obviousCapture: false };

  test("great is the only move that holds", () => {
    expect(isGreat(good)).toBe(true);
    expect(isGreat({ ...good, second: -30 })).toBe(false);
  });

  test("obvious moves and already-won positions aren't great", () => {
    expect(isGreat({ ...good, obviousCapture: true })).toBe(false);
    expect(isGreat({ ...good, inCheck: true })).toBe(false);
    expect(isGreat({ ...good, before: 2000, second: 700 })).toBe(false);
  });

  test("a miss hands back at least half of the opponent's mistake", () => {
    expect(isMiss(25, 15)).toBe(true);
    expect(isMiss(25, 8)).toBe(false);
    expect(isMiss(12, 6)).toBe(true);
    expect(isMiss(5, 5)).toBe(false);
  });
});

describe("gradeGame", () => {
  const base = {
    list: ["f3", "e5", "g4", "Qh4#"],
    scores: [0, 40, -500, 90000, 0],
    secondScores: [null, null, null, null, null],
    bestSans: ["e4", "e5", "e4", "Qh4#"],
    scoreOk: [true, true, true, true, true],
    theoryPlies: 0,
  };

  test("labels a whole game, and the mating move is best", () => {
    const { grades, plyScores } = gradeGame(base);
    expect(grades).toHaveLength(4);
    expect(grades[1]).toBe("best");
    expect(grades[2]).toBe("blunder");
    expect(grades[3]).toBe("best");
    expect(plyScores[1].isBest).toBe(true);
  });

  test("book moves are labelled before their scores matter", () => {
    const { grades, plyScores } = gradeGame({ ...base, theoryPlies: 2, scoreOk: [false, false, true, true, true] });
    expect(grades.slice(0, 2)).toEqual(["book", "book"]);
    expect(plyScores[0].book).toBe(true);
  });

  test("a failed search leaves the move unlabelled and unscored", () => {
    const { grades, plyScores } = gradeGame({ ...base, scoreOk: [true, true, false, true, true] });
    expect(grades[1]).toBeNull();
    expect(plyScores[1]).toBeNull();
  });
});
