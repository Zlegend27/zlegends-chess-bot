import { describe, it, expect } from "vitest";
import { believableResult, resultFor } from "./usePvpMatch.js";

const FOOLS_MATE = ["f3", "e5", "g4", "Qh4#"];

describe("believableResult: what the other player may tell my browser", () => {
  it("accepts anything that is good for me", () => {
    expect(believableResult(resultFor(1, "Resignation"), { moves: ["e4"], myColor: 1 })).toBe(true);
    expect(believableResult(resultFor(-1, "Timeout"), { moves: ["e4"], myColor: -1 })).toBe(true);
  });

  it("refuses a made-up win for them", () => {
    expect(believableResult(resultFor(-1, "Resignation"), { moves: ["e4", "e5"], myColor: 1 })).toBe(false);
    expect(believableResult(resultFor(-1, "Opponent left"), { moves: ["e4", "e5"], myColor: 1 })).toBe(false);
    expect(believableResult(resultFor(-1, "Checkmate"), { moves: ["e4", "e5"], myColor: 1 })).toBe(false);
  });

  it("accepts a real checkmate against me", () => {
    expect(believableResult(resultFor(-1, "Checkmate"), { moves: FOOLS_MATE, myColor: 1 })).toBe(true);
  });

  it("believes my timeout only when my own clock is out", () => {
    expect(believableResult(resultFor(-1, "Timeout"), { moves: ["e4"], myColor: 1, myTimeLeft: 60_000 })).toBe(false);
    expect(believableResult(resultFor(-1, "Timeout"), { moves: ["e4"], myColor: 1, myTimeLeft: 200 })).toBe(true);
  });

  it("draws by agreement only after my offer, aborts only at the start", () => {
    expect(believableResult(resultFor(0, "Agreement"), { moves: ["e4"], myColor: 1, offer: null })).toBe(false);
    expect(believableResult(resultFor(0, "Agreement"), { moves: ["e4"], myColor: 1, offer: "sent" })).toBe(true);
    expect(believableResult(resultFor(0, "Aborted"), { moves: ["e4"], myColor: 1 })).toBe(true);
    expect(believableResult(resultFor(0, "Aborted"), { moves: ["e4", "e5", "Nf3"], myColor: 1 })).toBe(false);
  });

  it("ignores junk", () => {
    expect(believableResult(null, { moves: [], myColor: 1 })).toBe(false);
    expect(believableResult({ winner: "me" }, { moves: [], myColor: 1 })).toBe(false);
  });
});
