import { describe, test, expect } from "vitest";
import { nextRankRating } from "./rankBotMath";

describe("the rating after a game", () => {
  test("one rough game moves it only a little", () => {
    expect(nextRankRating(1289, 470)).toBe(1214);
  });

  test("a good game counts just as much going up", () => {
    expect(nextRankRating(1000, 2000)).toBe(1075);
  });

  test("near the measured level, it closes part of the gap", () => {
    expect(nextRankRating(1000, 1060)).toBe(1020);
    expect(nextRankRating(1000, 1000)).toBe(1000);
  });
});
