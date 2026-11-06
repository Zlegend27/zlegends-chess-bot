import { describe, test, expect } from "vitest";
import { fullMoves, moveCounter } from "./moveNumber";

describe("move numbers", () => {
  test("two half-moves make one move", () => {
    expect([0, 1, 2, 3, 4, 111, 112].map(fullMoves)).toEqual([0, 1, 1, 2, 2, 56, 56]);
  });

  test("a 112-ply game ends on move 56, not 112", () => {
    expect(moveCounter(112, 112)).toBe("56…/56");
  });

  test("stepping shows White's move, then Black's reply with a dots mark", () => {
    expect([0, 1, 2, 3].map((p) => moveCounter(p, 6))).toEqual(["0/3", "1/3", "1…/3", "2/3"]);
  });

  test("a game that ends on White's move counts that move", () => {
    expect(moveCounter(5, 5)).toBe("3/3");
  });
});
